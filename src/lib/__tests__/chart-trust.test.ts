import { describe, expect, it } from "vitest";
import { buildSourceStatsSql, buildTrustSummary, parseSourceStats } from "@/lib/chart-trust";
import type { ChartConfig } from "@/lib/chart-studio";

const info = {
  table: "مبيعات",
  schema: [
    { name: "الفئة", type: "VARCHAR" },
    { name: "التاريخ", type: "DATE" },
    { name: "المبلغ", type: "DOUBLE" },
  ],
} as never;
const cfg = (o: Partial<ChartConfig>) =>
  ({
    kind: "bar",
    x: "الفئة",
    y: "المبلغ",
    agg: "SUM",
    sort: "value_desc",
    limit: 0,
    ...o,
  }) as ChartConfig;

describe("chart trust", () => {
  it("stats sql quotes identifiers", () => {
    expect(buildSourceStatsSql({ table: 't"x' }, cfg({}))).toContain('"t""x"');
  });
  it("parses stats safely", () => {
    expect(parseSourceStats(undefined)).toBeNull();
    expect(parseSourceStats({ total: 10, x_filled: 8, y_filled: 9, categories: 3 })).toEqual({
      total: 10,
      xFilled: 8,
      yFilled: 9,
      categories: 3,
    });
  });
  it("reports missing and truncated categories", () => {
    const s = buildTrustSummary(
      info,
      cfg({ limit: 5 }),
      { total: 100, xFilled: 90, yFilled: 95, categories: 40 },
      5,
    );
    expect(s.basis).toContain("مجموع المبلغ");
    expect(s.warnings.join(" ")).toMatch(/10.*«الفئة»/);
    expect(s.warnings.join(" ")).toMatch(/5.*40.*فئة/);
  });
  it("warns line on nominal axis and avg", () => {
    const s = buildTrustSummary(info, cfg({ kind: "line", agg: "AVG" }), null, 3);
    expect(s.warnings.length).toBe(2);
  });
  it("no warnings for clean time line", () => {
    const s = buildTrustSummary(
      info,
      cfg({ kind: "line", x: "التاريخ", sort: "label_asc" }),
      { total: 5, xFilled: 5, yFilled: 5, categories: 5 },
      5,
    );
    expect(s.warnings).toEqual([]);
  });
});
