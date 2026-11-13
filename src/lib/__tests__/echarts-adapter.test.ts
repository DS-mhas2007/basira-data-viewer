import { describe, expect, it } from "vitest";
import { defaultConfig } from "../chart-studio";
import { buildEChartsOption } from "../echarts-adapter";
import type { TableInfo } from "../duckdb-service";

const table = {
  table: "sample",
  schema: [
    { name: "category", type: "VARCHAR" },
    { name: "amount", type: "DOUBLE" },
  ],
  rowCount: 2,
} as TableInfo;

describe("buildEChartsOption", () => {
  const points = [
    { label: "A", value: 12 },
    { label: "B", value: 0 },
  ];

  it("maps categorical and numeric points to a bar series without recalculating values", () => {
    const config = defaultConfig(table);
    const option = buildEChartsOption(config, points);
    expect(option["xAxis"]).toMatchObject({ type: "category", data: ["A", "B"] });
    expect(option.series[0]).toMatchObject({ type: "bar", data: [12, 0] });
  });

  it("keeps grid lines horizontal and respects the configured legend", () => {
    const config = { ...defaultConfig(table), legend: "bottom" as const, grid: true };
    const option = buildEChartsOption(config, points);
    const xAxis = option["xAxis"] as { splitLine: { show: boolean } };
    const yAxis = option["yAxis"] as { splitLine: { show: boolean } };

    expect(xAxis.splitLine.show).toBe(false);
    expect(yAxis.splitLine.show).toBe(true);
    expect(option["legend"]).toMatchObject({ show: true, bottom: 0 });
    expect(buildEChartsOption({ ...config, legend: "hidden" }, points)["legend"]).toMatchObject({
      show: false,
    });
  });

  it("maps line and area chart types to smooth line series", () => {
    const config = { ...defaultConfig(table), kind: "area" as const, curve: "monotone" as const };
    const series = buildEChartsOption(config, points).series[0];
    expect(series).toMatchObject({ type: "line", smooth: true, areaStyle: { opacity: 0.22 } });
  });

  it("maps stacked and combo types explicitly", () => {
    const base = defaultConfig(table);
    expect(buildEChartsOption({ ...base, kind: "stacked" }, points).series[0]).toMatchObject({
      type: "bar",
      stack: "total",
    });
    expect(buildEChartsOption({ ...base, kind: "combo" }, points).series).toHaveLength(2);
    expect(buildEChartsOption({ ...base, kind: "combo" }, points).series[1]).toMatchObject({
      type: "line",
      data: [12, 0],
    });
  });

  it("uses the configured Y field as the series label and formats pie labels as values", () => {
    const config = { ...defaultConfig(table), y: "revenue", title: "Monthly revenue", dataLabels: true };
    const bar = buildEChartsOption(config, points);
    expect(bar.series[0].name).toBe("revenue");

    const pie = buildEChartsOption({ ...config, kind: "pie" }, points);
    const label = pie.series[0].label as { formatter: (params: { name: string; value: number }) => string };
    expect(label.formatter({ name: "A", value: 1200 })).toBe("A: 1.2K");
  });

  it("maps stacked bar colors per category and keeps regular bars on one series color", () => {
    const config = { ...defaultConfig(table), colors: ["#111111", "#222222"] };
    const regular = buildEChartsOption(config, points).series[0];
    const stacked = buildEChartsOption({ ...config, kind: "stacked" }, points).series[0];

    expect(regular.itemStyle).toMatchObject({ color: "#111111" });
    expect(stacked.data).toEqual([
      { name: "A", value: 12, itemStyle: { color: "#111111" } },
      { name: "B", value: 0, itemStyle: { color: "#222222" } },
    ]);
  });

  it("maps pie points into name/value pairs and suppresses axes", () => {
    const option = buildEChartsOption({ ...defaultConfig(table), kind: "pie" }, points);
    expect(option.series[0]).toMatchObject({
      type: "pie",
      data: [{ name: "A", value: 12 }, { name: "B", value: 0 }],
    });
    expect(option["grid"]).toBeUndefined();
    expect(option["xAxis"]).toBeUndefined();
  });

  it("accepts only valid 3, 4, 6, or 8 digit hex colors", () => {
    const option = buildEChartsOption({ ...defaultConfig(table), colors: ["#abc", "#abcd", "#123456", "#12345678", "#12345", "#1234567"] }, points);
    expect(option.color).toEqual(["#abc", "#abcd", "#123456", "#12345678"]);
  });

  it("rejects malformed hex lengths and falls back to the Basira palette", () => {
    const option = buildEChartsOption({ ...defaultConfig(table), colors: ["#12345", "#1234567", "url(javascript:alert(1))"] }, points);
    expect(option.color).toEqual(["#60F5D2", "#D6B2FC", "#7FB2FF", "#F5C978"]);
    expect(JSON.stringify(option)).not.toContain("var(--");
  });

  it("formats tooltip and value-axis numbers with the chart configuration", () => {
    const config = { ...defaultConfig(table), prefix: "$", suffix: "USD", compact: true };
    const option = buildEChartsOption(config, points);
    const formatter = option.tooltip["valueFormatter"] as (value: unknown) => string;
    const yAxis = option["yAxis"] as { axisLabel: { formatter: (value: number) => string } };

    expect(formatter(1200)).toBe("$1.2K USD");
    expect(formatter(null)).toBe("—");
    expect(yAxis.axisLabel.formatter(1200)).toBe("$1.2K USD");
  });

  it("falls back when the persisted palette itself is not an array", () => {
    const config = {
      ...defaultConfig(table),
      colors: null,
    } as unknown as ReturnType<typeof defaultConfig>;
    expect(buildEChartsOption(config, points).color).toEqual([
      "#60F5D2", "#D6B2FC", "#7FB2FF", "#F5C978",
    ]);
  });

  it("ignores non-string color values from malformed persisted configuration", () => {
    const config = {
      ...defaultConfig(table),
      colors: ["#abc", null, 42] as unknown as string[],
    };
    expect(buildEChartsOption(config, points).color).toEqual(["#abc"]);
  });

});
