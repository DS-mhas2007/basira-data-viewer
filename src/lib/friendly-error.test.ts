import { describe, expect, it, vi } from "vitest";
import { friendlyError } from "./friendly-error";

describe("friendlyError", () => {
  it("يترجم عمود غير موجود", () => {
    const e = new Error('Binder Error: Referenced column "sales" not found in FROM clause!');
    expect(friendlyError(e)).toContain("«sales»");
  });
  it("يترجم أخطاء تسجيل الدخول", () => {
    expect(friendlyError(new Error("Invalid login credentials"))).toContain("غير صحيحة");
  });
  it("يترجم أخطاء الشبكة", () => {
    expect(friendlyError(new TypeError("Failed to fetch"))).toContain("الشبكة");
  });
  it("يبقي الرسائل العربية كما هي", () => {
    expect(friendlyError(new Error("تعذّر فتح الملف"))).toBe("تعذّر فتح الملف");
  });
  it("لا يعرض إنجليزية مجهولة", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(friendlyError(new Error("ECONNRESET xyz"), "فشل")).toBe("فشل");
    spy.mockRestore();
  });
  it("يتعامل مع قيم غير Error", () => {
    expect(friendlyError(undefined, "x")).toBe("x");
  });
});
