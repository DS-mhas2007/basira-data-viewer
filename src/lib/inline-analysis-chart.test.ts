import { describe, expect, it } from "vitest";
import { buildInlineAnalysisChart } from "./inline-analysis-chart";

describe("buildInlineAnalysisChart", () => {
  const rows = [{ month: "2026-01", revenue: 120 }, { month: "2026-02", revenue: 180 }, { month: "2026-03", revenue: 150 }];
  it("builds a line chart from supported time series", () => {
    const option = buildInlineAnalysisChart({ type: "line", x: "month", y: ["revenue"] }, rows);
    expect(option).not.toBeNull();
    expect(option?.["xAxis"]).toMatchObject({ type: "category", data: ["2026-01", "2026-02", "2026-03"] });
    expect(option?.["series"]).toMatchObject([{ type: "line", name: "revenue", data: [120, 180, 150] }]);
  });
  it("skips scalar, table, and invalid schemas", () => {
    expect(buildInlineAnalysisChart({ type: "bar", x: "month", y: ["revenue"] }, rows.slice(0, 1))).toBeNull();
    expect(buildInlineAnalysisChart({ type: "table", x: "month", y: ["revenue"] }, rows)).toBeNull();
    expect(buildInlineAnalysisChart({ type: "bar", x: "missing", y: ["revenue"] }, rows)).toBeNull();
  });
  it("builds scatter points only from valid numeric pairs", () => {
    const option = buildInlineAnalysisChart({ type: "scatter", x: "ad_spend", y: ["revenue"] }, [{ ad_spend: 10, revenue: 100 }, { ad_spend: 20, revenue: 160 }, { ad_spend: null, revenue: 200 }]);
    expect(option?.["series"]).toMatchObject([{ type: "scatter", data: [[10, 100], [20, 160]] }]);
  });
});