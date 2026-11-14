import { describe, expect, it } from "vitest";
import { wrapWords } from "./finding-card";

describe("wrapWords", () => {
  const m = (s: string) => s.length * 10;
  it("يلتف عند تجاوز العرض", () => {
    expect(wrapWords(m, "aa bb cc dd", 50)).toEqual(["aa bb", "cc dd"]);
  });
  it("كلمة طويلة تبقى في سطر", () => {
    expect(wrapWords(m, "abcdefghij kk", 50)).toEqual(["abcdefghij", "kk"]);
  });
  it("نص فارغ", () => {
    expect(wrapWords(m, "  ", 50)).toEqual([]);
  });
});
