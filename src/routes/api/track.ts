/**
 * تسجيل اختياري للزيارات (خادم فقط).
 * لا يُخزَّن IP؛ تستخدم ترويسة Cloudflare بصمة HMAC مؤقتة في الذاكرة للحد من الإغراق فقط.
 * يحترم DNT/GPC، ويتطلب موافقة صريحة وعنوان أصل مطابقاً، ويعيد 204 كي لا يتأثر المستخدم.
 */
import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  FixedWindowRateLimiter,
  isSameOriginRequest,
  normalizeTrackPath,
} from "@/lib/visit-tracking";

const BodyZ = z.object({
  consent: z.literal(true),
  visitorId: z.string().uuid(),
  sessionId: z.string().uuid(),
  path: z.string().min(1).max(500).startsWith("/"),
  referrer: z.string().max(1_000).nullable().optional(),
  kind: z.enum(["view", "ping"]).default("view"),
});

const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget/i;
const rateLimiter = new FixedWindowRateLimiter(120, 60_000, 5_000);
const RETENTION_MS = 180 * 24 * 60 * 60 * 1_000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1_000;
let hmacKeyPromise: Promise<CryptoKey> | null = null;
let lastCleanupAttempt = 0;

function hasPrivacyOptOut(headers: Headers): boolean {
  const dnt = headers.get("dnt")?.trim().toLowerCase();
  const gpc = headers.get("sec-gpc")?.trim().toLowerCase();
  return dnt === "1" || dnt === "yes" || gpc === "1" || gpc === "?1";
}

function parseUa(ua: string) {
  const device =
    /Android/.test(ua) && !/Mobile/.test(ua)
      ? "tablet"
      : /iPad|Tablet/i.test(ua)
        ? "tablet"
        : /Mobi|Android|iPhone/i.test(ua)
          ? "mobile"
          : "desktop";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS/.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "other";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iOS/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "other";
  return { device, browser, os };
}

function clean(value: string | null): string | null {
  if (!value) return null;
  // eslint-disable-next-line no-control-regex
  const controlCharacters = /[\u0000-\u001f\u007f]/g;
  try {
    return decodeURIComponent(value).replace(controlCharacters, "").trim().slice(0, 80) || null;
  } catch {
    return value.replace(controlCharacters, "").trim().slice(0, 80) || null;
  }
}

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.host.toLowerCase().slice(0, 253) || null;
  } catch {
    return null;
  }
}

function clientIpForRateLimit(headers: Headers): string | null {
  // Only trust headers installed by the hosting proxy; the IP is never persisted or logged.
  const cfIp = headers.get("cf-connecting-ip")?.trim();
  if (cfIp && cfIp.length <= 64) return cfIp;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded && forwarded.length <= 64 ? forwarded : null;
}

async function rateKeyFor(
  ip: string | null,
  visitorId: string,
  sessionId: string,
): Promise<string> {
  if (!ip) return `session:${visitorId}:${sessionId}`;
  if (!hmacKeyPromise) {
    const randomSecret = crypto.getRandomValues(new Uint8Array(32));
    hmacKeyPromise = crypto.subtle.importKey(
      "raw",
      randomSecret,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  }
  const key = await hmacKeyPromise;
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  const prefix = [...new Uint8Array(digest).slice(0, 16)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `ip:${prefix}`;
}

async function cleanupExpiredVisits(db: SupabaseClient): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupAttempt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAttempt = now;
  const cutoff = new Date(now - RETENTION_MS).toISOString();
  const { error } = await db.from("site_visits").delete().lt("created_at", cutoff);
  if (error) console.warn("[track] retention cleanup failed:", error.code ?? "database-error");
}

export const Route = createFileRoute("/api/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const done = () =>
          new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
        const headers = request.headers;

        // Opt-out is honored before reading the body, session, or location headers.
        if (hasPrivacyOptOut(headers)) return done();
        if (!isSameOriginRequest(headers.get("origin"), request.url)) return done();
        const fetchSite = headers.get("sec-fetch-site");
        if (fetchSite && fetchSite !== "same-origin") return done();
        if (!(headers.get("content-type") ?? "").toLowerCase().startsWith("application/json"))
          return done();
        const contentLength = Number(headers.get("content-length") ?? 0);
        if (Number.isFinite(contentLength) && contentLength > 2_000) return done();

        try {
          const raw = await request.text();
          if (new TextEncoder().encode(raw).byteLength > 2_000) return done();
          const parsed = BodyZ.safeParse(JSON.parse(raw));
          if (!parsed.success) return done();
          const body = parsed.data;
          const path = normalizeTrackPath(body.path);
          if (!path) return done();

          const ua = headers.get("user-agent")?.slice(0, 512) ?? "";
          if (!ua || BOT_RE.test(ua)) return done();
          const key = await rateKeyFor(
            clientIpForRateLimit(headers),
            body.visitorId,
            body.sessionId,
          );
          if (!rateLimiter.allow(key)) return done();

          const cc = (headers.get("cf-ipcountry") ?? headers.get("x-vercel-ip-country") ?? "")
            .trim()
            .toUpperCase();
          const country = /^[A-Z]{2}$/.test(cc) && cc !== "XX" && cc !== "T1" ? cc : null;
          const city = clean(headers.get("cf-ipcity") ?? headers.get("x-vercel-ip-city"));
          const region = clean(
            headers.get("cf-region") ?? headers.get("x-vercel-ip-country-region"),
          );

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          let userId: string | null = null;
          const token = headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
          if (token) {
            const { data } = await supabaseAdmin.auth.getUser(token);
            userId = data.user?.id ?? null;
          }

          const { device, browser, os } = parseUa(ua);
          // The visits table is added by a migration and is intentionally not in generated client types.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const db = supabaseAdmin as unknown as SupabaseClient<any, "public", any>;
          const { error } = await db.from("site_visits").insert({
            kind: body.kind,
            visitor_id: body.visitorId,
            session_id: body.sessionId,
            user_id: userId,
            path,
            referrer: hostOf(body.referrer),
            country,
            region,
            city,
            device,
            browser,
            os,
          });
          if (error) {
            console.warn("[track] insert failed:", error.code ?? "database-error");
            return done();
          }

          await cleanupExpiredVisits(db);
        } catch {
          // Never log request bodies, tokens, IP addresses, or provider headers.
          console.warn("[track] request failed");
        }
        return done();
      },
    },
  },
});
