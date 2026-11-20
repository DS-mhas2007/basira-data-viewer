const APP_ORIGIN = "https://mizya.invalid";
const EXCLUDED_PREFIXES = ["/admin", "/api", "/auth"] as const;

function hasPathPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Keep only a same-site pathname; drop query/hash and never record admin, API, or auth routes. */
export function normalizeTrackPath(input: string): string | null {
  if (!input || input.length > 500 || !input.startsWith("/") || input.startsWith("//")) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(input)) return null;

  try {
    const parsed = new URL(input, APP_ORIGIN);
    if (parsed.origin !== APP_ORIGIN) return null;
    const path = parsed.pathname;
    if (path.length > 300 || EXCLUDED_PREFIXES.some((prefix) => hasPathPrefix(path, prefix)))
      return null;
    return path;
  } catch {
    return null;
  }
}

/** Analytics requests are accepted only when a browser supplies the exact request origin. */
export function isSameOriginRequest(origin: string | null, requestUrl: string): boolean {
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

/** Best-effort per-process fixed-window limiter; production WAF limits should remain enabled too. */
export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, { startedAt: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 5_000,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const current = this.buckets.get(key);
    if (!current || now - current.startedAt >= this.windowMs || now < current.startedAt) {
      this.buckets.set(key, { startedAt: now, count: 1 });
      this.prune(now);
      return true;
    }
    if (current.count >= this.limit) return false;
    current.count += 1;
    return true;
  }

  private prune(now: number): void {
    if (this.buckets.size <= this.maxKeys) return;
    for (const [key, value] of this.buckets) {
      if (now - value.startedAt >= this.windowMs || now < value.startedAt) this.buckets.delete(key);
    }
    while (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next().value as string | undefined;
      if (!oldest) break;
      this.buckets.delete(oldest);
    }
  }
}
