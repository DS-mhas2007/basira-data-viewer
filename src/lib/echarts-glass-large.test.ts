import { describe, expect, it } from "vitest";
import { applyLargeDataGuards, LARGE_POINTS } from "./echarts-glass";

const pts = (n: number) => Array.from({ length: n }, (_, i) => [i, i * 2]);

describe("large-data chart guards", () => {
  it("leaves small charts untouched", () => {
    const out: Record<string, unknown> = { animation: true };
    const series = [{ type: "line", data: pts(50), lineStyle: { shadowBlur: 12 } }];
    applyLargeDataGuards(out, series);
    expect(out["animation"]).toBe(true);
    expect(series[0]).not.toHaveProperty("sampling");
  });

  it("simplifies big line/scatter/bar series and turns animation off", () => {
    const out: Record<string, unknown> = { animation: true };
    const series: Record<string, unknown>[] = [
      { type: "line", data: pts(LARGE_POINTS), lineStyle: { width: 2, shadowBlur: 12 } },
      { type: "scatter", data: pts(10), itemStyle: { shadowBlur: 10 } },
      { type: "bar", data: pts(10) },
    ];
    applyLargeDataGuards(out, series);
    expect(out["animation"]).toBe(false);
    expect(series[0]).toMatchObject({ sampling: "lttb", showSymbol: false, lineStyle: { width: 2, shadowBlur: 0 } });
    expect(series[1]).toMatchObject({ large: true, itemStyle: { shadowBlur: 0 } });
    expect(series[2]).toMatchObject({ large: true });
  });
});
