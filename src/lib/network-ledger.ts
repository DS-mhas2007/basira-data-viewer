/**
 * سجل الخصوصية: يسجّل (في ذاكرة المتصفح فقط) كل طلب شبكة صادر من الصفحة:
 * الوجهة، الطريقة، وحجم الجسم المُرسَل. يُستخدم لإثبات أن الملف الأصلي لم يُرفع.
 * لا يخزّن محتوى الطلبات إطلاقاً — فقط الأحجام.
 */

export type LedgerCategory = "engine" | "account" | "server" | "other";

export interface LedgerEntry {
  id: number;
  at: number;
  method: string;
  host: string;
  path: string;
  category: LedgerCategory;
  /** حجم الجسم المُرسَل بالبايت؛ 0 = بلا جسم؛ -1 = غير معروف. */
  bytes: number;
}

export interface LedgerSummary {
  requests: number;
  withBody: number;
  unknownSize: number;
  maxBytes: number;
  totalBytes: number;
  byCategory: Record<LedgerCategory, number>;
}

const MAX_ENTRIES = 200;
let entries: LedgerEntry[] = [];
let fileBytes = 0;
let counter = 0;
let installed = false;
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  for (const l of listeners) l();
}

export function subscribeLedger(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export const getLedgerVersion = () => version;
export const getLedgerEntries = () => entries;
export const getLedgerFileBytes = () => fileBytes;

export function setLedgerFileBytes(bytes: number) {
  fileBytes = Math.max(0, bytes);
  emit();
}

export function classifyUrl(url: URL, origin: string): LedgerCategory {
  if (/supabase\.(co|in)$/i.test(url.hostname)) return "account";
  if (url.origin === origin)
    return url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn")
      ? "server"
      : "engine";
  if (/jsdelivr|gstatic|googleapis|cdnjs|unpkg/i.test(url.hostname)) return "engine";
  return "other";
}

/** يقدّر حجم جسم الطلب بالبايت (-1 إن تعذّر). */
export function bodyBytes(body: unknown): number {
  if (body == null) return 0;
  if (typeof body === "string") return new TextEncoder().encode(body).length;
  if (typeof Blob !== "undefined" && body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams)
    return new TextEncoder().encode(body.toString()).length;
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    let total = 0;
    for (const [k, v] of body.entries())
      total += k.length + (typeof v === "string" ? new TextEncoder().encode(v).length : v.size);
    return total;
  }
  return -1;
}

export function record(
  method: string,
  rawUrl: string,
  bytes: number,
  origin = typeof location !== "undefined" ? location.origin : "http://localhost",
) {
  let url: URL;
  try {
    url = new URL(rawUrl, origin);
  } catch {
    return;
  }
  const e: LedgerEntry = {
    id: ++counter,
    at: Date.now(),
    method: method.toUpperCase(),
    host: url.host,
    path: url.pathname,
    category: classifyUrl(url, origin),
    bytes,
  };
  entries = [...entries.slice(-(MAX_ENTRIES - 1)), e];
  emit();
}

export function summarize(list: LedgerEntry[]): LedgerSummary {
  const byCategory: Record<LedgerCategory, number> = { engine: 0, account: 0, server: 0, other: 0 };
  let withBody = 0;
  let unknownSize = 0;
  let maxBytes = 0;
  let totalBytes = 0;
  for (const e of list) {
    byCategory[e.category]++;
    if (e.bytes > 0) {
      withBody++;
      totalBytes += e.bytes;
      if (e.bytes > maxBytes) maxBytes = e.bytes;
    } else if (e.bytes < 0) unknownSize++;
  }
  return { requests: list.length, withBody, unknownSize, maxBytes, totalBytes, byCategory };
}

/** هل يمكن الجزم بأن الملف لم يُرسَل كاملاً؟ (لا طلب بجسم بحجم الملف أو أكبر، ولا طلب بحجم مجهول) */
export function fileStayedLocal(s: LedgerSummary, file: number): boolean {
  if (file <= 0) return false;
  return s.unknownSize === 0 && s.maxBytes < file * 0.9;
}

export function installNetworkLedger() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const origFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const isReq = typeof Request !== "undefined" && input instanceof Request;
      const url = isReq ? input.url : String(input);
      const method = init?.method ?? (isReq ? input.method : "GET");
      const bytes =
        init?.body !== undefined
          ? bodyBytes(init.body)
          : isReq && method.toUpperCase() !== "GET" && method.toUpperCase() !== "HEAD"
            ? -1
            : 0;
      record(method, url, bytes);
    } catch {
      /* السجل لا يجب أن يكسر الطلب أبداً */
    }
    return origFetch(input, init);
  };

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      try {
        record("POST", String(url), bodyBytes(data ?? null));
      } catch {
        /* تجاهل */
      }
      return origBeacon(url, data);
    };
  }

  if (typeof XMLHttpRequest !== "undefined") {
    const proto = XMLHttpRequest.prototype;
    const origOpen = proto.open;
    const origSend = proto.send;
    const meta = new WeakMap<XMLHttpRequest, { method: string; url: string }>();
    proto.open = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      meta.set(this, { method, url: String(url) });
      return (origOpen as (...a: unknown[]) => void).call(this, method, url, ...rest);
    } as typeof proto.open;
    proto.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
      try {
        const m = meta.get(this);
        if (m) record(m.method, m.url, bodyBytes(body ?? null));
      } catch {
        /* تجاهل */
      }
      return origSend.call(this, body);
    };
  }
}
