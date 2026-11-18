import { describe, expect, it } from "vitest";
import { extractDateTryCasts, getSourceColumnQuality } from "./evidence";
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

describe("extractDateTryCasts", () => {
  it("detects explicit DATE and TIMESTAMP TRY_CAST expressions", () => {
    expect(extractDateTryCasts('SELECT TRY_CAST("OrderDate" AS DATE), TRY_CAST(created_at AS TIMESTAMP) FROM dataset')).toEqual([
      { column: "OrderDate", target: "DATE" },
      { column: "created_at", target: "TIMESTAMP" },
    ]);
  });

  it("ignores string literals, comments, and unsupported target types", () => {
    expect(extractDateTryCasts("SELECT 'TRY_CAST(OrderDate AS DATE)' AS note, TRY_CAST(amount AS DOUBLE) FROM dataset -- TRY_CAST(x AS DATE)")).toEqual([]);
  });

  it("does not guess from CAST or column names", () => {
    expect(extractDateTryCasts("SELECT CAST(OrderDate AS DATE), OrderDate FROM dataset")).toEqual([]);
  });
});
