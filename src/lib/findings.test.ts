import { describe, expect, it } from "vitest";
import { aggFor, concentrationFinding, isUsableCategory, pct, shareFinding, trendFinding } from "./findings";

const plain = (s: string) => s.replace(/[\u2066\u2069]/g, "");

describe("findings", () => {
  it("aggFor: إجمالي مالي وكمية = SUM، والسعر = AVG", () => {
    expect(aggFor("revenue")).toBe("SUM");
    expect(aggFor("quantity")).toBe("SUM");
    expect(aggFor("unit_price")).toBe("AVG");
    expect(aggFor("rating")).toBe("AVG");
    expect(aggFor("age")).toBe("AVG");
  });
  it("share: جملة بالنسبة", () => {
    const f = shareFinding({ measure: "revenue", cat: "category", agg: "SUM", top: { label: "ملابس", value: 41 }, overall: 100, groups: 5 })!;
    expect(f.text).toContain("41%");
    expect(f.text).toContain("«ملابس»");
    expect(f.bar).toBe(41);
  });
  it("share: لا شيء لفئة واحدة أو إجمالي صفر", () => {
    expect(shareFinding({ measure: "m", cat: "c", agg: "SUM", top: { label: "a", value: 1 }, overall: 1, groups: 1 })).toBeNull();
    expect(shareFinding({ measure: "m", cat: "c", agg: "SUM", top: { label: "a", value: 1 }, overall: 0, groups: 3 })).toBeNull();
  });
  it("share AVG: مقارنة بالمتوسط العام", () => {
    const f = shareFinding({ measure: "price", cat: "c", agg: "AVG", top: { label: "x", value: 112 }, overall: 100, groups: 3 })!;
    expect(plain(f.text)).toContain("أعلى بـ 12%");
  });
  it("trend: ارتفاع وانخفاض", () => {
    const up = trendFinding({ measure: "revenue", agg: "SUM", prev: { label: "2025-02", value: 100 }, last: { label: "2025-03", value: 127 } })!;
    expect(plain(up.text)).toContain("ارتفع بنسبة 27%");
    expect(up.direction).toBe(1);
    const down = trendFinding({ measure: "revenue", agg: "SUM", prev: { label: "a", value: 200 }, last: { label: "b", value: 150 } })!;
    expect(plain(down.text)).toContain("انخفض بنسبة 25%");
    expect(down.direction).toBe(-1);
  });
  it("trend: لا يقسم على صفر ولا يعرض تغيراً أقل من 1%", () => {
    expect(trendFinding({ measure: "m", agg: "SUM", prev: { label: "a", value: 0 }, last: { label: "b", value: 5 } })).toBeNull();
    expect(trendFinding({ measure: "m", agg: "SUM", prev: { label: "a", value: 100 }, last: { label: "b", value: 100.5 } })).toBeNull();
  });
  it("concentration: يتطلب 10 قيم وتركّزاً ≥50%", () => {
    expect(concentrationFinding({ measure: "m", cat: "c", groups: 9, topGroups: 2, topShare: 90 })).toBeNull();
    expect(concentrationFinding({ measure: "m", cat: "c", groups: 50, topGroups: 10, topShare: 40 })).toBeNull();
    const f = concentrationFinding({ measure: "revenue", cat: "customer", groups: 50, topGroups: 10, topShare: 82 })!;
    expect(f.text).toContain("82%");
    expect(f.detail).toContain("تركّز عالٍ");
  });
  it("pct", () => {
    expect(pct(12.345, 1)).toContain("12.3%");
  });
});

describe("findings quality guards", () => {
  it("pct never shows a misleading 0% for small shares", () => {
    expect(pct(0.1)).toContain("0.1%");
    expect(pct(0)).toContain("0%");
    expect(pct(12.4)).toContain("12%");
  });
  it("rejects near-unique columns and single-value columns as categories", () => {
    expect(isUsableCategory(1200, 1200)).toBe(false); // أسماء فريدة
    expect(isUsableCategory(1, 1200)).toBe(false);
    expect(isUsableCategory(5, 1200)).toBe(true);
    expect(isUsableCategory(4, 8)).toBe(true); // عينات صغيرة
  });
  it("skips a 'top group' that is barely above an even split", () => {
    expect(
      shareFinding({ measure: "m", cat: "c", agg: "SUM", top: { label: "a", value: 21 }, overall: 100, groups: 5 }),
    ).toBeNull();
    expect(
      shareFinding({ measure: "m", cat: "c", agg: "SUM", top: { label: "a", value: 35 }, overall: 100, groups: 5 }),
    ).not.toBeNull();
  });
});
