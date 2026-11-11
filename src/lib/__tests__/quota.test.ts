import { describe, it, expect, vi, beforeEach } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));

import { metered, ensureGuestSession } from "../ai-action";
import { QUOTA_EVENT, parseQuotaError, quotaMessage, type QuotaEventDetail } from "../quota";

type Call = (o: { data: Record<string, unknown> }) => Promise<unknown>;
const run = (fn: unknown): Call => metered(fn as (o: { data: never }) => Promise<unknown>) as unknown as Call;

beforeEach(() => {
  auth.getSession.mockReset();
  auth.signInAnonymously.mockReset();
});

describe("quotaMessage", () => {
  it("asks guests to sign in", () => {
    expect(quotaMessage("quota_exceeded", { plan: "anonymous", limit: 5, period: "lifetime", is_anonymous: true })).toMatch(
      /انتهت التجربة المجانية \(5 طلبات\).*سجّل الدخول/,
    );
  });
  it("tells free users about the monthly limit and paid plans", () => {
    const m = quotaMessage("quota_exceeded", { plan: "free", limit: 30, period: "month", is_anonymous: false });
    expect(m).toContain("30");
    expect(m).toContain("الخطط المدفوعة");
  });
  it("login_required and action_limit have their own text", () => {
    expect(quotaMessage("login_required")).toMatch(/سجّل الدخول/);
    expect(quotaMessage("action_limit")).toMatch(/مرات كثيرة/);
  });
});

describe("parseQuotaError", () => {
  it("reads a 429 body from /api/chat", () => {
    expect(parseQuotaError(JSON.stringify({ code: "quota_exceeded", error: "x" }))?.code).toBe("quota_exceeded");
  });
  it("ignores other errors", () => {
    expect(parseQuotaError("Unauthorized")).toBeNull();
    expect(parseQuotaError(JSON.stringify({ code: "other" }))).toBeNull();
  });
});

describe("ensureGuestSession", () => {
  it("does not create a guest when a session exists", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: {} } } });
    expect(await ensureGuestSession()).toBe(true);
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
  it("signs in anonymously once even for concurrent callers", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signInAnonymously.mockResolvedValue({ error: null });
    const r = await Promise.all([ensureGuestSession(), ensureGuestSession(), ensureGuestSession()]);
    expect(r).toEqual([true, true, true]);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });
  it("returns false when anonymous sign-in is disabled", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signInAnonymously.mockResolvedValue({ error: new Error("disabled") });
    expect(await ensureGuestSession()).toBe(false);
  });
});

describe("metered", () => {
  const events: QuotaEventDetail[] = [];
  beforeEach(() => {
    events.length = 0;
    window.addEventListener(QUOTA_EVENT, (e) => events.push((e as CustomEvent<QuotaEventDetail>).detail), { once: true });
    auth.getSession.mockResolvedValue({ data: { session: { user: {} } } });
  });

  it("sends the same actionId on every call of one action", async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true });
    const m = run(fn);
    await m({ data: { q: 1 } });
    await m({ data: { q: 2 } });
    const ids = fn.mock.calls.map((c) => c[0].data.actionId);
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).toBe(ids[1]);
    expect(fn.mock.calls[1]![0].data.q).toBe(2);
  });

  it("uses distinct ids for separate actions", async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true });
    await run(fn)({ data: {} });
    await run(fn)({ data: {} });
    expect(fn.mock.calls[0]![0].data.actionId).not.toBe(fn.mock.calls[1]![0].data.actionId);
  });

  it("notifies the UI when the quota is exhausted and still returns the response", async () => {
    const quota = { plan: "anonymous", limit: 5, is_anonymous: true };
    const fn = vi.fn().mockResolvedValue({ ok: false, error: "e", code: "quota_exceeded", quota });
    const res = await run(fn)({ data: {} });
    expect((res as { code: string }).code).toBe("quota_exceeded");
    expect(events[0]?.code).toBe("quota_exceeded");
  });

  it("does not call the server and asks for login if no session can be created", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signInAnonymously.mockResolvedValue({ error: new Error("disabled") });
    const fn = vi.fn();
    const res = await run(fn)({ data: {} });
    expect(fn).not.toHaveBeenCalled();
    expect((res as { code: string }).code).toBe("login_required");
    expect(events[0]?.code).toBe("login_required");
  });
});
