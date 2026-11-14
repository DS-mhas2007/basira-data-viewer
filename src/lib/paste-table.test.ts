import { describe, expect, it } from "vitest";
import { looksLikeTable, pastedTableToFile } from "./paste-table";

describe("looksLikeTable", () => {
  it("جدول منسوخ من Excel (TAB)", () => {
    expect(looksLikeTable("الاسم\tالعمر\tالمدينة\nأحمد\t30\tغزة\nسارة\t25\tعمّان")).toBe(true);
  });
  it("CSV بفواصل", () => {
    expect(looksLikeTable("a,b,c\n1,2,3\n4,5,6")).toBe(true);
  });
  it("فاصلة منقوطة", () => {
    expect(looksLikeTable("a;b\n1;2\n3;4")).toBe(true);
  });
  it("نص عادي من سطر واحد ليس جدولاً", () => {
    expect(looksLikeTable("مرحبا، كيف حالك؟ هذا سطر واحد")).toBe(false);
  });
  it("نص من عدة أسطر بلا بنية ليس جدولاً", () => {
    expect(looksLikeTable("سطر أول\nسطر ثاني\nسطر ثالث")).toBe(false);
  });
  it("أعمدة غير متسقة ليست جدولاً", () => {
    expect(looksLikeTable("a,b,c\nمجرد نص\nنص آخر\nثالث\nرابع")).toBe(false);
  });
  it("نص ضخم يُرفض", () => {
    expect(looksLikeTable("a\tb\n" + "1\t2\n".repeat(2_000_000))).toBe(false);
  });
});

describe("pastedTableToFile", () => {
  it("يعيد ملف CSV بالاسم والنوع", () => {
    const f = pastedTableToFile("a\tb\n1\t2")!;
    expect(f.name).toBe("جدول ملصوق.csv");
    expect(f.type).toBe("text/csv");
  });
  it("null لغير الجداول", () => {
    expect(pastedTableToFile("hello")).toBeNull();
  });
});
