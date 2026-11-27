import { describe, expect, it } from "vitest";
import {
  isZoomable,
  nextZoomRange,
  withInteraction,
  ZOOM_MIN_POINTS,
} from "@/lib/echarts-interaction";
import type { ChartConfig } from "@/lib/chart-studio";

const cfg = (kind: ChartConfig["kind"]) =>
  ({ kind, prefix: "", suffix: "ر.س", compact: false, legend: "hidden" }) as unknown as ChartConfig;
const opt = (n: number) => ({
  xAxis: { type: "category", data: Array.from({ length: n }, (_, i) => `c${i}`) },
  yAxis: { type: "value" },
  grid: { bottom: 24 },
  tooltip: { trigger: "axis" },
  series: [{ type: "bar", data: Array.from({ length: n }, (_, i) => i + 1) }],
});

describe("chart interaction", () => {
  it("zoom only for many categories on cartesian kinds", () => {
    expect(isZoomable(opt(ZOOM_MIN_POINTS), cfg("bar"))).toBe(true);
    expect(isZoomable(opt(ZOOM_MIN_POINTS - 1), cfg("bar"))).toBe(false);
    expect(isZoomable(opt(40), cfg("pie"))).toBe(false);
  });
  it("adds dataZoom and room for slider", () => {
    const o = withInteraction(opt(30), cfg("bar")) as any;
    expect(o.dataZoom).toHaveLength(2);
    expect(o.grid.bottom).toBeGreaterThan(24);
  });
  it("rich tooltip shows share and rank", () => {
    const o = withInteraction(opt(5), cfg("bar")) as any;
    const html = o.tooltip.formatter([{ name: "c4", value: 5 }]);
    expect(html).toContain("33.3%");
    expect(html).toContain("ر.س");
  });
  it("no rich tooltip with negatives", () => {
    const o = opt(5);
    o.series[0]!.data = [1, -2, 3, 4, 5];
    expect((withInteraction(o, cfg("bar")) as any).tooltip.formatter).toBeUndefined();
  });
  it("multi-series gets focus emphasis", () => {
    const o = opt(5);
    o.series = [o.series[0]!, { ...o.series[0]! }];
    const r = withInteraction(o, cfg("stacked")) as any;
    expect(r.series[1].emphasis.focus).toBe("series");
  });
  it("zoom ranges stay within 0..100 and reset", () => {
    let r = { start: 0, end: 100 };
    for (let i = 0; i < 20; i++) r = nextZoomRange(r.start, r.end, "in");
    expect(r.end - r.start).toBeGreaterThanOrEqual(8);
    r = nextZoomRange(r.start, r.end, "left");
    expect(r.start).toBeGreaterThanOrEqual(0);
    expect(r.end).toBeLessThanOrEqual(100);
    expect(nextZoomRange(10, 40, "reset")).toEqual({ start: 0, end: 100 });
    expect(nextZoomRange(0, 100, "out")).toEqual({ start: 0, end: 100 });
  });
});
