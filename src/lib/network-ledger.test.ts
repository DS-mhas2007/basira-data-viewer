import { describe, expect, it } from "vitest";
import { bodyBytes, classifyUrl, fileStayedLocal, summarize, type LedgerEntry } from "./network-ledger";

const e = (bytes: number, category: LedgerEntry["category"] = "server"): LedgerEntry => ({
  id: 1, at: 0, method: "POST", host: "x", path: "/", category, bytes,
});

describe("network-ledger", () => {
  it("يصنّف الوجهات", () => {
    const o = "https://app.test";
    expect(classifyUrl(new URL("https://abc.supabase.co/rest/v1/x"), o)).toBe("account");
    expect(classifyUrl(new URL("https://app.test/api/chat"), o)).toBe("server");
    expect(classifyUrl(new URL("https://app.test/_serverFn/abc"), o)).toBe("server");
    expect(classifyUrl(new URL("https://cdn.jsdelivr.net/npm/x"), o)).toBe("engine");
    expect(classifyUrl(new URL("https://evil.example/x"), o)).toBe("other");
  });
  it("يقدّر أحجام الأجسام", () => {
    expect(bodyBytes(null)).toBe(0);
    expect(bodyBytes("مرحبا")).toBe(10);
    expect(bodyBytes(new Uint8Array(5))).toBe(5);
    expect(bodyBytes(new Blob(["abc"]))).toBe(3);
    expect(bodyBytes({})).toBe(-1);
  });
  it("يلخّص الطلبات", () => {
    const s = summarize([e(0), e(1200), e(300, "account"), e(-1)]);
    expect(s.requests).toBe(4);
    expect(s.withBody).toBe(2);
    expect(s.maxBytes).toBe(1200);
    expect(s.unknownSize).toBe(1);
    expect(s.byCategory.account).toBe(1);
  });
  it("لا يجزم إلا بدليل", () => {
    expect(fileStayedLocal(summarize([e(1200)]), 5_000_000)).toBe(true);
    expect(fileStayedLocal(summarize([e(4_900_000)]), 5_000_000)).toBe(false);
    expect(fileStayedLocal(summarize([e(10), e(-1)]), 5_000_000)).toBe(false);
    expect(fileStayedLocal(summarize([]), 0)).toBe(false);
  });
});
