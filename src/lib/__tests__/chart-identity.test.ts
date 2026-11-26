import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  defaultConfig,
  PALETTES,
  PALETTE_SURFACES,
  type ChartConfig,
  type ChartPoint,
} from "../chart-studio";
import { buildEChartsOption, decorateAxes, valueAxisTitle } from "../echarts-adapter";
import { glassify } from "../echarts-glass";

const info = {
  table: "t",
  rowCount: 1,
  schema: [
    { name: "cat", type: "VARCHAR" },
    { name: "المبيعات", type: "DOUBLE" },
  ],
} as never;
const cfg = (extra: Partial<ChartConfig> = {}): ChartConfig => ({
  ...defaultConfig(info),
  x: "cat",
  y: "المبيعات",
  ...extra,
});
const pts: ChartPoint[] = [
  { label: "a", value: 3 },
  { label: "b", value: 5 },
];

describe("palettes", () => {
  it("every palette has 8 valid, unique colors", () => {
    for (const p of PALETTES) {
      expect(p.colors).toHaveLength(8);
      expect(new Set(p.colors.map((c) => c.toLowerCase())).size).toBe(8);
      for (const c of p.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it("all colors read on the dark surface (>= 3:1)", () => {
    for (const p of PALETTES)
      for (const c of p.colors)
        expect(contrastRatio(c, PALETTE_SURFACES.dark), `${p.id} ${c}`).toBeGreaterThanOrEqual(3);
  });
  it("'both' palettes also read on the light surface (>= 3:1)", () => {
    const both = PALETTES.filter((p) => p.surfaces === "both");
    expect(both.length).toBeGreaterThanOrEqual(3);
    for (const p of both)
      for (const c of p.colors)
        expect(contrastRatio(c, PALETTE_SURFACES.light), `${p.id} ${c}`).toBeGreaterThanOrEqual(3);
  });
  it("contrastRatio matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });
});

describe("axis titles and grid", () => {
  it("builds a unit-aware value title", () => {
    expect(valueAxisTitle(cfg({ agg: "SUM", suffix: "ر.س" }))).toBe("مجموع · المبيعات (ر.س)");
    expect(valueAxisTitle(cfg({ agg: "COUNT" }))).toBe("عدد");
    expect(valueAxisTitle(cfg({ kind: "histogram" }))).toBe("التكرار");
  });
  it("adds titles only when enabled and enlarges margins", () => {
    const base = buildEChartsOption(cfg(), pts) as Record<string, unknown>;
    expect(decorateAxes(base, cfg())).toBe(base);
    const c = cfg({ axisTitles: true });
    const out = decorateAxes(base, c) as Record<string, any>;
    expect(out["xAxis"].name).toBe("cat");
    expect(out["yAxis"].name).toContain("المبيعات");
    expect(out["grid"].top).toBeGreaterThan((base["grid"] as any).top);
    expect(out["grid"].bottom).toBeGreaterThan((base["grid"] as any).bottom);
  });
  it("swaps title roles for horizontal bars", () => {
    const c = cfg({ kind: "horizontalBar", axisTitles: true });
    const out = decorateAxes(buildEChartsOption(c, pts) as Record<string, unknown>, c) as Record<
      string,
      any
    >;
    expect(out["yAxis"].name).toBe("cat");
    expect(out["xAxis"].name).toContain("المبيعات");
  });
  it("never decorates axis-less charts", () => {
    const c = cfg({ kind: "pie", axisTitles: true });
    const o = buildEChartsOption(c, pts) as Record<string, unknown>;
    expect(decorateAxes(o, c)).toBe(o);
  });
  it("grid style reaches the value axis and survives the glass skin", () => {
    const solid = buildEChartsOption(cfg({ gridStyle: "solid" }), pts) as Record<string, any>;
    expect(solid["yAxis"].splitLine.lineStyle.type).toBe("solid");
    const skinned = glassify(solid) as Record<string, any>;
    expect(skinned["yAxis"].splitLine.lineStyle.type).toBe("solid");
    const hidden = glassify(buildEChartsOption(cfg({ grid: false }), pts)) as Record<string, any>;
    expect(hidden["yAxis"].splitLine.show).toBe(false);
  });
  it("truncates long category labels", () => {
    const o = buildEChartsOption(cfg(), pts) as Record<string, any>;
    expect(o["xAxis"].axisLabel.overflow).toBe("truncate");
  });
});
