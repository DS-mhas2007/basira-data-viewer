import { describe, expect, it } from "vitest";
import { altTableRows, describeChart, withA11y } from "@/lib/chart-a11y";

const cfg = {
  kind: "bar",
  x: "الفئة",
  y: "المبيعات",
  prefix: "",
  suffix: "ر.س",
  compact: false,
  title: "مبيعات",
} as never;
describe("chart a11y", () => {
  it("describes extremes", () => {
    const d = describeChart(cfg, [
      { label: "أ", value: 5 },
      { label: "ب", value: 1 },
    ]);
    expect(d).toContain("2 نقطة");
    expect(d).toContain("الأعلى «أ»");
    expect(d).toContain("الأدنى «ب»");
  });
  it("handles empty", () => expect(describeChart(cfg, [])).toContain("لا توجد نقاط"));
  it("reduced motion and contrast", () => {
    const o = withA11y({ animation: true }, { reducedMotion: true, moreContrast: true }) as any;
    expect(o.animation).toBe(false);
    expect(o.aria.decal.show).toBe(true);
    expect(
      (withA11y({ animation: true }, { reducedMotion: false, moreContrast: false }) as any).aria,
    ).toBeUndefined();
  });
  it("caps alt table", () => {
    const r = altTableRows(Array.from({ length: 70 }, (_, i) => ({ label: `${i}`, value: i })));
    expect(r.rows).toHaveLength(50);
    expect(r.hidden).toBe(20);
  });
});
