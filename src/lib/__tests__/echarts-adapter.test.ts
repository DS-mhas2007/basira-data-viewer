import { describe, expect, it } from "vitest";
import { defaultConfig } from "../chart-studio";
import { buildEChartsOption } from "../echarts-adapter";
import type { TableInfo } from "../duckdb-service";

const table = {
  table: "sample",
  schema: [
    { name: "category", type: "VARCHAR", nullable: true },
    { name: "amount", type: "DOUBLE", nullable: true },
  ],
} as TableInfo;

describe("buildEChartsOption", () => {
  const points = [
    { label: "A", value: 12 },
    { label: "B", value: 0 },
  ];

  it("maps categorical and numeric points to a bar series without recalculating values", () => {
    const config = defaultConfig(table);
    const option = buildEChartsOption(config, points);
    expect(option.xAxis).toMatchObject({ type: "category", data: ["A", "B"] });
    expect(option.series[0]).toMatchObject({ type: "bar", data: [12, 0] });
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

  it("maps pie points into name/value pairs and suppresses axes", () => {
    const option = buildEChartsOption({ ...defaultConfig(table), kind: "pie" }, points);
    expect(option.series[0]).toMatchObject({
      type: "pie",
      data: [{ name: "A", value: 12 }, { name: "B", value: 0 }],
    });
    expect(option.grid).toBeUndefined();
    expect(option.xAxis).toBeUndefined();
  });

  it("falls back to the Basira palette when configured colors are invalid", () => {
    const option = buildEChartsOption({ ...defaultConfig(table), colors: ["url(javascript:alert(1))"] }, points);
    expect(option.color).toEqual(["#60F5D2", "#D6B2FC", "#7FB2FF", "#F5C978"]);
  });
});
