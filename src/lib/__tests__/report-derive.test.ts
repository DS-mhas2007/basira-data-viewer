import { describe, expect, it } from "vitest";
import { buildSqlLineageReport } from "@/lib/report-derive";
import type { PinnedInsight } from "@/lib/report";

function insight(lineage?: NonNullable<PinnedInsight["evidence"]["lineage"]>): PinnedInsight {
  return {
    evidence: {
      id: "insight-1", title: "إيرادات حسب المنطقة", sql: "SELECT 1", filters: [],
      baseRowCount: 10, resultRowCount: 2, highlights: [], warnings: [],
      ...(lineage ? { lineage } : {}),
    },
    plan: { intent: "summary", intro_ar: "", analysis_ar: "", chart: { type: "bar", x: "region", y: "revenue" } } as PinnedInsight["plan"],
    rows: [],
  };
}

describe("buildSqlLineageReport", () => {
  it("preserves distinct semantic dependency groups and qualified references", () => {
    const rows = buildSqlLineageReport([insight({
      version: 1, status: "complete", confidence: "high", sourceTable: "sales",
      sourceColumns: ["amount", "status", "region"], operations: [], warnings: [],
      outputColumns: [{
        outputName: "net_revenue", expression: "SUM(CASE WHEN status = 'paid' THEN amount END)",
        sourceColumns: ["amount", "status"], sourceReferences: [],
        valueSourceColumns: ["amount"], valueSourceReferences: [{ table: "sales", column: "amount" }],
        conditionSourceColumns: ["status"], conditionSourceReferences: [{ table: "sales", column: "status" }],
        rowFilterSourceColumns: ["region"], rowFilterSourceReferences: [{ table: "sales", column: "region" }],
        operations: ["aggregate", "conditional"], role: "metric", confidence: "high",
      }],
    })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      outputName: "net_revenue",
      valueDependencies: ["sales.amount"],
      conditionDependencies: ["sales.status"],
      rowFilterDependencies: ["sales.region"],
    });
  });

  it("keeps legacy lineage and returns empty groups when semantic fields are absent", () => {
    const rows = buildSqlLineageReport([insight({
      version: 1, status: "partial", confidence: "medium", sourceTable: "sales",
      sourceColumns: ["amount"], operations: [], warnings: [],
      outputColumns: [{
        outputName: "total", expression: "SUM(amount)", sourceColumns: ["amount"],
        operations: ["aggregate"], role: "metric", confidence: "medium",
      }],
    })]);
    expect(rows[0]).toMatchObject({
      outputName: "total", valueDependencies: [], conditionDependencies: [], rowFilterDependencies: [],
    });
  });

  it("ignores pinned insights without SQL lineage", () => {
    expect(buildSqlLineageReport([insight(), insight(undefined)])).toEqual([]);
  });
});
