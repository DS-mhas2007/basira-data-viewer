import { describe, expect, it } from "vitest";
import {
  chartToCsv,
  missingColumns,
  parseChartConfigFile,
  serializeChartConfig,
} from "@/lib/chart-export";

describe("chart export", () => {
  it("csv escapes, BOM and formula guard", () => {
    const csv = chartToCsv(
      [
        { label: "=SUM(A1)", value: 1 },
        { label: 'a,"b"', value: 2.5 },
      ],
      { x: "الفئة", y: "v" },
    );
    expect(csv.startsWith("﻿الفئة,v\r\n")).toBe(true);
    expect(csv).toContain("'=SUM(A1),1");
    expect(csv).toContain('"a,""b""",2.5');
  });
  it("csv includes series and value2 columns when present", () => {
    const csv = chartToCsv([{ label: "a", series: "s", value: 1, value2: 2 }], { x: "x", y: "y" });
    expect(csv).toContain("x,series,y,value2");
  });
  it("config roundtrip keeps valid fields only", () => {
    const text = serializeChartConfig({
      kind: "bar",
      x: "a",
      y: "b",
      agg: "SUM",
      limit: 10,
      grid: false,
      colors: ["#112233"],
    } as never);
    const r = parseChartConfigFile(text);
    expect(r).toEqual({
      ok: true,
      config: expect.objectContaining({ kind: "bar", x: "a", limit: 10, grid: false }),
    });
  });
  it("rejects hostile or foreign files", () => {
    expect(parseChartConfigFile("nope").ok).toBe(false);
    expect(parseChartConfigFile('{"kind":"x"}').ok).toBe(false);
    const r = parseChartConfigFile(
      JSON.stringify({
        kind: "mizyai-chart",
        version: 1,
        config: { agg: "DROP", limit: 9999, colors: ["red"], __proto__: { a: 1 } },
      }),
    );
    expect(r.ok).toBe(false);
  });
  it("reports missing columns", () => {
    expect(missingColumns({ x: "a", y: "zz" }, ["a", "b"])).toEqual(["zz"]);
  });
});
