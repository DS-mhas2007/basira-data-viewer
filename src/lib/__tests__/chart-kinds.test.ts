import { describe, expect, it } from "vitest";
import {
  buildSql,
  defaultConfig,
  kindFieldProblem,
  normalizeChartRows,
  resolveChartFit,
  type ChartConfig,
  type ChartKind,
  type ChartPoint,
} from "../chart-studio";
import { buildEChartsOption } from "../echarts-adapter";

const info = {
  table: "t",
  rowCount: 100,
  schema: [
    { name: "cat", type: "VARCHAR" },
    { name: "a", type: "DOUBLE" },
    { name: "b", type: "BIGINT" },
  ],
} as never;

const cfg = (kind: ChartKind, extra: Partial<ChartConfig> = {}): ChartConfig => ({
  ...defaultConfig(info),
  kind,
  x: "cat",
  y: "a",
  ...extra,
});

const pts = (...v: number[]): ChartPoint[] => v.map((value, i) => ({ label: `c${i}`, value }));
const seriesType = (c: ChartConfig, p: ChartPoint[]) =>
  (buildEChartsOption(c, p).series[0] as { type: string }).type;

describe("field requirements", () => {
  it("histogram and boxplot need a numeric Y", () => {
    expect(kindFieldProblem(info, cfg("histogram", { y: "cat" }))).toMatch(/رقمياً/);
    expect(kindFieldProblem(info, cfg("histogram"))).toBeNull();
    expect(kindFieldProblem(info, cfg("boxplot", { y: "cat" }))).not.toBeNull();
  });
  it("scatter needs numeric X and Y", () => {
    expect(kindFieldProblem(info, cfg("scatter"))).not.toBeNull();
    expect(kindFieldProblem(info, cfg("scatter", { x: "b" }))).toBeNull();
  });
});

describe("special SQL", () => {
  it("histogram builds 20 bins without grouping by category", () => {
    const sql = buildSql(info, cfg("histogram"));
    expect(sql).toContain("generate_series(0, 19)");
    expect(sql).not.toContain('"cat"');
  });
  it("falls back to the ordinary aggregate when fields do not fit", () => {
    const sql = buildSql(info, cfg("scatter"));
    expect(sql).toContain("GROUP BY 1");
  });
  it("boxplot selects quartiles per category", () => {
    const sql = buildSql(info, cfg("boxplot"));
    expect(sql).toContain("quantile_cont");
    expect(sql).toContain("GROUP BY 1");
  });
  it("scatter samples deterministically", () => {
    const sql = buildSql(info, cfg("scatter", { x: "b" }));
    expect(sql).toContain("ORDER BY hash(");
  });
});

describe("normalizeChartRows extras", () => {
  it("keeps scatter x, box stats and histogram bins", () => {
    const { points } = normalizeChartRows([
      { label: "1", x: 1, value: 2 },
      { label: "g", value: 5, lo: 1, q1: 3, q3: 7, hi: 9 },
      { label: "0 – 1", value: 4, k: 0 },
    ]);
    expect(points[0]!.x).toBe(1);
    expect(points[1]!.stats).toEqual([1, 3, 5, 7, 9]);
    expect(points[2]!.bin).toBe(0);
  });
});

describe("resolveChartFit", () => {
  it("falls back to bars for negatives in funnel/treemap/radar", () => {
    for (const kind of ["funnel", "treemap"] as const) {
      expect(resolveChartFit(kind, pts(3, -1))).toMatchObject({ kind: "bar" });
    }
    expect(resolveChartFit("radar", pts(3, -1, 2))).toMatchObject({ kind: "bar" });
  });
  it("radar needs 3..12 categories", () => {
    expect(resolveChartFit("radar", pts(1, 2)).kind).toBe("bar");
    expect(resolveChartFit("radar", pts(1, 2, 3)).kind).toBe("radar");
    expect(resolveChartFit("radar", pts(...Array(13).fill(1))).kind).toBe("bar");
  });
  it("waterfall allows negative deltas but not a negative running total", () => {
    expect(resolveChartFit("waterfall", pts(10, -4, 3)).kind).toBe("waterfall");
    expect(resolveChartFit("waterfall", pts(2, -5, 3)).kind).toBe("bar");
  });
  it("boxplot/scatter/histogram require their markers", () => {
    expect(resolveChartFit("boxplot", pts(1, 2)).kind).toBe("bar");
    expect(resolveChartFit("scatter", pts(1, 2)).kind).toBe("bar");
    expect(resolveChartFit("histogram", pts(1, 2)).kind).toBe("bar");
  });
  it("always gives a notice when it falls back", () => {
    expect(resolveChartFit("funnel", pts(1)).notice).toBeTruthy();
  });
});

describe("adapter output per kind", () => {
  it("renders the expected series types", () => {
    expect(seriesType(cfg("funnel"), pts(9, 5, 2))).toBe("funnel");
    expect(seriesType(cfg("treemap"), pts(9, 5, 2))).toBe("treemap");
    expect(seriesType(cfg("radar"), pts(9, 5, 2))).toBe("radar");
    expect(seriesType(cfg("waterfall"), pts(9, -2, 2))).toBe("bar");
    const box = pts(5).map((p) => ({
      ...p,
      stats: [1, 3, 5, 7, 9] as [number, number, number, number, number],
    }));
    expect(seriesType(cfg("boxplot"), box)).toBe("boxplot");
    const sc = pts(2, 4).map((p, i) => ({ ...p, x: i }));
    expect(seriesType(cfg("scatter", { x: "b" }), sc)).toBe("scatter");
    const hist = pts(2, 4).map((p, i) => ({ ...p, bin: i }));
    expect(seriesType(cfg("histogram"), hist)).toBe("bar");
  });
  it("waterfall adds a total bar and a transparent base", () => {
    const o = buildEChartsOption(cfg("waterfall"), pts(10, -4, 3));
    expect(o.series).toHaveLength(4);
    const total = (o.series[3] as { data: unknown[] }).data;
    expect(total[total.length - 1]).toBe(9);
    expect((o["xAxis"] as { data: string[] }).data.at(-1)).toBe("الإجمالي");
  });
  it("misfit data never produces a misleading special chart", () => {
    expect(seriesType(cfg("funnel"), pts(3, -1))).toBe("bar");
    expect(seriesType(cfg("scatter"), pts(3, 1))).toBe("bar");
  });
});
