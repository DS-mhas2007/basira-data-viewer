import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ANALYTICS_CONSENT_EVENT,
  getAnalyticsConsent,
  hasAnalyticsOptOutSignal,
  setAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analytics-consent";
import { normalizeTrackPath } from "@/lib/visit-tracking";

const VID_KEY = "mizya:vid";
const SID_KEY = "mizya:sid";
const PING_MS = 120_000;

function randomId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((part) => part.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function persistent(storage: Storage, key: string): string {
  try {
    let value = storage.getItem(key);
    if (!value) {
      value = randomId();
      storage.setItem(key, value);
    }
    return value;
  } catch {
    return randomId();
  }
}

async function send(
  consent: AnalyticsConsent,
  kind: "view" | "ping",
  path: string,
  referrer: string | null,
) {
  const safePath = normalizeTrackPath(path);
  if (!safePath || consent !== "granted" || hasAnalyticsOptOutSignal()) return;

  try {
    // IDs are created only after opt-in; no tracking identifier is written before consent.
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    await fetch("/api/track", {
      method: "POST",
      mode: "same-origin",
      credentials: "same-origin",
      keepalive: true,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        consent: true,
        visitorId: persistent(window.localStorage, VID_KEY),
        sessionId: persistent(window.sessionStorage, SID_KEY),
        path: safePath,
        referrer,
        kind,
      }),
    });
  } catch {
    // Analytics must never interrupt the user's work.
  }
}

export function VisitTracker() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const first = useRef(true);
  const [consent, setConsent] = useState<AnalyticsConsent>("unknown");
  const optOut = hasAnalyticsOptOutSignal();

  useEffect(() => {
    setConsent(getAnalyticsConsent());
    const onConsentChange = (event: Event) => {
      const selected = (event as CustomEvent<AnalyticsConsent>).detail;
      setConsent(selected ?? getAnalyticsConsent());
    };
    window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsentChange);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsentChange);
  }, []);

  useEffect(() => {
    if (consent !== "granted" || optOut) return;
    const path = normalizeTrackPath(pathname);
    if (!path) return;
    const referrer = first.current && document.referrer ? document.referrer : null;
    first.current = false;
    void send(consent, "view", path, referrer);
  }, [consent, optOut, pathname]);

  useEffect(() => {
    if (consent !== "granted" || optOut) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void send(consent, "ping", window.location.pathname, null);
      }
    }, PING_MS);
    return () => window.clearInterval(id);
  }, [consent, optOut]);

  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  if (isAdminPage || consent !== "unknown" || optOut) return null;

  return (
    <aside
      role="region"
      aria-label="اختيار تحليلات الاستخدام"
      className="mz-glass-card fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-2xl rounded-2xl border border-border/70 bg-card/95 p-4 shadow-xl backdrop-blur-xl sm:inset-x-6 sm:bottom-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground">هل تسمح بتحليلات استخدام اختيارية؟</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            الغرض فهم استخدام الميزات وتحسين MIZYAi. نسجّل المسار ونوع الجهاز ومعلومات موقع تقريبية،
            وقد نربط الزيارة بحسابك عند تسجيل الدخول. لا نسجّل عنوان IP أو ملفاتك، وتُحذف السجلات
            بعد 180 يوماً.
            <Link
              to="/guide/data-privacy-browser"
              className="ms-1 font-semibold text-primary underline underline-offset-2"
            >
              التفاصيل والتحكم
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setAnalyticsConsent("denied")}>
            لا أوافق
          </Button>
          <Button size="sm" onClick={() => setAnalyticsConsent("granted")}>
            أوافق
          </Button>
        </div>
      </div>
    </aside>
  );
}
