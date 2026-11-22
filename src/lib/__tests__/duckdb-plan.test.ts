import { describe, expect, it } from "vitest";
import { summarizeDuckDbExplain } from "../duckdb-plan";

describe("summarizeDuckDbExplain", () => {
  it("normalizes DuckDB EXPLAIN rows with a JSON physical plan", () => {
    const raw = [{
      explain_key: "physical_plan",
      explain_value: JSON.stringify([{
        name: "PROJECTION",
        extra_info: { Projections: ["city", "sum(revenue)"] },
        children: [{
          name: "HASH_GROUP_BY",
          extra_info: { Groups: ["city"], Aggregates: ["sum(#1)"] },
          children: [{
            name: "SEQ_SCAN",
            extra_info: { Table: "orders", Projections: ["city", "revenue"], Filters: ["revenue > 0"] },
            children: [],
          }],
        }],
      }]),
    }];

    expect(summarizeDuckDbExplain(raw)).toEqual(expect.objectContaining({
      source: "duckdb-explain-json",
      operators: ["PROJECTION", "HASH_GROUP_BY", "SEQ_SCAN"],
      scannedTables: ["orders"],
      projections: expect.arrayContaining(["city", "sum(revenue)", "revenue"]),
      filters: ["revenue > 0"],
      groups: ["city"],
      aggregates: ["sum(#1)"],
    }));
  });

  it("accepts a direct JSON string payload", () => {
    const raw = JSON.stringify({
      name: "SEQ_SCAN",
      extra_info: { "Table": "dataset" },
      children: [],
    });
    expect(summarizeDuckDbExplain(raw)?.scannedTables).toEqual(["dataset"]);
  });

  it("returns null for unknown or malformed formats", () => {
    expect(summarizeDuckDbExplain("not-json")).toBeNull();
    expect(summarizeDuckDbExplain([{ explain_key: "logical_plan", explain_value: "x" }])).toBeNull();
    expect(summarizeDuckDbExplain(null)).toBeNull();
  });

  it("does not recurse indefinitely on deeply nested input", () => {
    let node: Record<string, unknown> = { name: "SEQ_SCAN", extra_info: { Table: "dataset" }, children: [] };
    for (let i = 0; i < 120; i++) node = { name: "PROJECTION", extra_info: {}, children: [node] };
    const result = summarizeDuckDbExplain(node);
    expect(result?.operators).toContain("SEQ_SCAN");
  });
});
