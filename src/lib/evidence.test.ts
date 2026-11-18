import { describe, expect, it } from "vitest";
import { getCastFailureQuality, getSourceColumnQuality } from "./evidence";
import type { HealthReport } from "./data-health";

const health = {
  columns: [
    { name: "OrderDate", type: "VARCHAR", nullCount: 12, nullRatio: 0.1 },
    { name: "TotalAmount", type: "DOUBLE", nullCount: 2, nullRatio: 0.02 },
    { name: "Customer Name", type: "VARCHAR", nullCount: 5, nullRatio: 0.04 },
  ],
} as HealthReport;

describe("getSourceColumnQuality", () => {
  it("returns only source columns referenced by the SQL", () => {
    expect(
      getSourceColumnQuality(
        'SELECT MAX(TRY_CAST("OrderDate" AS DATE)) AS latest FROM "dataset" LIMIT 1',
        health,
      ),
    ).toEqual([
      { name: "OrderDate", type: "VARCHAR", nullCount: 12, nullRatio: 0.1 },
    ]);
  });

  it("matches bare identifiers and ignores names that only occur inside string literals", () => {
    expect(
      getSourceColumnQuality(
        "SELECT COUNT(*) AS n FROM dataset WHERE TotalAmount > 0 AND note = 'OrderDate' LIMIT 1",
        health,
      ).map((column) => column.name),
    ).toEqual(["TotalAmount"]);
  });

  it("returns no source metadata when the health report is unavailable", () => {
    expect(getSourceColumnQuality('SELECT "OrderDate" FROM dataset', null)).toEqual([]);
  });
});


describe("getCastFailureQuality", () => {
  it("returns no inferred exclusions for CTEs or joins", async () => {
    const schema = { tables: { dataset: ["OrderDate"] } };
    expect(await getCastFailureQuality('WITH x AS (SELECT TRY_CAST(OrderDate AS DATE) d FROM dataset) SELECT d FROM x', schema)).toEqual([]);
    expect(await getCastFailureQuality('SELECT TRY_CAST(a.OrderDate AS DATE) FROM dataset a JOIN dataset b ON a.OrderDate=b.OrderDate', schema)).toEqual([]);
  });
});
