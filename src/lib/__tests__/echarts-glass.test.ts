import { describe, expect, it } from "vitest";
import { buildEChartsOption } from "@/lib/echarts-adapter";
import { glassify } from "@/lib/echarts-glass";
import { defaultConfig } from "@/lib/chart-studio";

const table = {
  table: "t",
  rowCount: 1,
  schema: [
    { name: "city", type: "VARCHAR" },
    { name: "sales", type: "DOUBLE" },
  ],
} as never;
const points = [
  { label: "A", value: 3 },
  { label: "B", value: 2 },
];

describe("glassify", () => {
  it("turns bars into rounded gradient bars and hides a single-series legend", () => {
    const out = glassify(buildEChartsOption({ ...defaultConfig(table), kind: "bar" }, points));
    const s = out.series[0]!;
    expect((s["itemStyle"] as { color: { type: string } }).color.type).toBe("linear");
    expect(out["legend"]).toEqual({ show: false });
    expect((out["xAxis"] as { axisLabel: { rotate: number } }).axisLabel.rotate).toBe(0);
  });

  it("draws a gradient donut ring and keeps the legend for pies", () => {
    const out = glassify(buildEChartsOption({ ...defaultConfig(table), kind: "pie" }, points));
    const s = out.series[0]!;
    expect(s["radius"]).toEqual(["62%", "82%"]);
    expect(((s["data"] as { itemStyle: { color: { type: string } } }[])[0]!).itemStyle.color.type).toBe("linear");
    expect((out["legend"] as { show?: boolean }).show).not.toBe(false);
  });

  it("adds a glow and gradient area to area charts without mutating the input", () => {
    const base = buildEChartsOption({ ...defaultConfig(table), kind: "area" }, points);
    const snapshot = JSON.stringify(base);
    const out = glassify(base);
    expect((out.series[0]!["lineStyle"] as { shadowBlur: number }).shadowBlur).toBeGreaterThan(0);
    expect(out.series[0]!["symbol"]).toBe("none");
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
