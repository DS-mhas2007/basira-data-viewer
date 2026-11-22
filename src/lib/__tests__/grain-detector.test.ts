import { describe, expect, it } from "vitest";
import { validateQuery } from "../sql-validator";
import {
  buildCompositeKeyProfileSql,
  buildGrainProbeSql,
  buildKeyProfileSql,
  grainHintsByColumn,
  inferStructuralCompositeKeyCandidates,
  inferStructuralKeyCandidates,
  interpretGrainProbeRows,
  selectGrainCandidates,
  type GrainProbeRow,
} from "../grain-detector";

describe("selectGrainCandidates", () => {
  it("finds entity-key candidates and numeric measures without relying on file extensions", () => {
    const selected = selectGrainCandidates([
      { name: "OrderID", type: "VARCHAR" },
      { name: "ProductID", type: "INTEGER" },
      { name: "OrderDate", type: "DATE" },
      { name: "TotalAmount", type: "DECIMAL(12,2)" },
      { name: "Quantity", type: "INTEGER" },
      { name: "CustomerName", type: "VARCHAR" },
    ]);

    expect(selected.keys.map((column) => column.name)).toEqual(["OrderID", "ProductID"]);
    expect(selected.measures.map((column) => column.name)).toEqual(["TotalAmount", "Quantity"]);
  });

  it("accepts structurally inferred keys even when their names contain no ID hint", () => {
    const selected = selectGrainCandidates([
      { name: "Reference", type: "VARCHAR" },
      { name: "Amount", type: "DOUBLE" },
    ], ["Reference"]);
    expect(selected.keys.map((column) => column.name)).toEqual(["Reference"]);
  });

  it("caps candidate counts to keep profiling bounded", () => {
    const schema = [
      ...Array.from({ length: 10 }, (_, i) => ({ name: "OrderID_" + i, type: "VARCHAR" })),
      ...Array.from({ length: 15 }, (_, i) => ({ name: "Metric_" + i, type: "DOUBLE" })),
    ];
    const selected = selectGrainCandidates(schema);
    expect(selected.keys).toHaveLength(6);
    expect(selected.measures).toHaveLength(10);
  });
});

describe("structural key inference", () => {
  it("builds a bounded full-table profile query without relying on key names", () => {
    const sql = buildKeyProfileSql("sales dataset", [
      { name: "Reference", type: "VARCHAR" },
      { name: "Status", type: "VARCHAR" },
    ]);
    if (sql === null) throw new Error("Expected a structural key profile query");
    expect(sql).toContain('FROM "sales dataset"');
    expect(sql).toContain("UNNEST(['Reference', 'Status'])");
    expect(sql).toContain("GROUP BY column_name, column_value");
    expect(sql).toContain("repeated_groups");
    expect(validateQuery(sql, { tables: { "sales dataset": ["Reference", "Status"] } }).isValid).toBe(true);
  });

  it("does not profile integer measures as structural entity keys", () => {
    const sql = buildKeyProfileSql("orders", [
      { name: "OrderNumber", type: "INTEGER" },
      { name: "Age", type: "INTEGER" },
      { name: "Quantity", type: "INTEGER" },
      { name: "Revenue", type: "BIGINT" },
      { name: "CustomerCode", type: "VARCHAR" },
    ]);
    if (sql === null) throw new Error("Expected a structural key profile query");
    expect(sql).toContain("'OrderNumber'");
    expect(sql).toContain("'CustomerCode'");
    expect(sql).not.toContain("'Age'");
    expect(sql).not.toContain("'Quantity'");
    expect(sql).not.toContain("'Revenue'");
  });

  it("infers repeated high-cardinality columns but excludes low-cardinality categories", () => {
    const inferred = inferStructuralKeyCandidates([
      { column_name: "Reference", distinct_values: 40, non_null_values: 100, repeated_groups: 30, max_frequency: 5 },
      { column_name: "Status", distinct_values: 3, non_null_values: 100, repeated_groups: 3, max_frequency: 70 },
      { column_name: "SparseRef", distinct_values: 35, non_null_values: 50, repeated_groups: 20, max_frequency: 4 },
      { column_name: "UniqueRow", distinct_values: 100, non_null_values: 100, repeated_groups: 0, max_frequency: 1 },
    ], 100);
    expect(inferred).toEqual(["Reference"]);
  });
});

describe("composite key inference", () => {
  it("profiles pairs of candidate columns without requiring ID-like names", () => {
    const sql = buildCompositeKeyProfileSql("ledger", [
      { name: "Branch", type: "VARCHAR" },
      { name: "Account", type: "VARCHAR" },
      { name: "Amount", type: "DOUBLE" },
    ], ["Branch", "Account"]);
    if (sql === null) throw new Error("Expected composite profile SQL");
    expect(sql).toContain('GROUP BY "Branch", "Account"');
    expect(sql).toContain("'[\"Branch\",\"Account\"]' AS component_columns");
    expect(validateQuery(sql, { tables: { ledger: ["Branch", "Account", "Amount"] } }).isValid).toBe(true);
  });

  it("includes low-cardinality components in a bounded structural pair search", () => {
    const sql = buildCompositeKeyProfileSql("transactions", [
      { name: "Region", type: "VARCHAR" },
      { name: "InvoiceSequence", type: "INTEGER" },
      { name: "Amount", type: "DECIMAL(12,2)" },
      { name: "OccurredAt", type: "TIMESTAMP" },
    ], []);
    if (sql === null) throw new Error("Expected structural composite profile SQL");
    expect(sql).toContain('GROUP BY "Region", "InvoiceSequence"');
    expect(sql).toContain("LIMIT 15");
    expect(sql).not.toContain('"Amount"');
    expect(sql).not.toContain('"OccurredAt"');
    expect(validateQuery(sql, { tables: { transactions: ["Region", "InvoiceSequence", "Amount", "OccurredAt"] } }).isValid).toBe(true);
  });

  it("selects repeated composite entities and rejects near-unique pairs", () => {
    const inferred = inferStructuralCompositeKeyCandidates([
      { column_name: "Branch + Account", component_columns: '["Branch","Account"]', distinct_values: 45, non_null_values: 100, repeated_groups: 35, max_frequency: 5 },
      { column_name: "Region + Row", component_columns: '["Region","Row"]', distinct_values: 99, non_null_values: 100, repeated_groups: 1, max_frequency: 2 },
    ], 100);
    expect(inferred).toEqual([["Branch", "Account"]]);
  });

  it("uses composite keys in the full-dataset grain probe", () => {
    const sql = buildGrainProbeSql("ledger", [
      { name: "Branch", type: "VARCHAR" },
      { name: "Account", type: "VARCHAR" },
      { name: "Balance", type: "DECIMAL(12,2)" },
    ], [], [["Branch", "Account"]]);
    if (sql === null) throw new Error("Expected composite grain SQL");
    expect(sql).toContain("'Branch + Account' AS entity_column");
    expect(sql).toContain('length(CAST("Branch" AS VARCHAR))');
    expect(sql).toContain('GROUP BY entity_key, measure_column');
    expect(validateQuery(sql, { tables: { ledger: ["Branch", "Account", "Balance"] } }).isValid).toBe(true);
  });
});

describe("buildGrainProbeSql", () => {
  it("builds read-only full-dataset probes for key/measure pairs", () => {
    const sql = buildGrainProbeSql("sales dataset", [
      { name: "OrderID", type: "VARCHAR" },
      { name: "TotalAmount", type: "DECIMAL(12,2)" },
    ]);
    if (sql === null) throw new Error("Expected a grain probe query for a key/measure pair");

    expect(sql).toContain('FROM "sales dataset"');
    expect(sql).toContain('CAST("OrderID" AS VARCHAR)');
    expect(sql).toContain('CAST("TotalAmount" AS VARCHAR)');
    expect(sql).toContain("stable_groups");
    expect(validateQuery(sql as string, { tables: { "sales dataset": ["OrderID", "TotalAmount"] } }).isValid).toBe(true);
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|INSERT)\b/i);
  });

  it("escapes SQL identifiers and returns null when no usable key/measure pair exists", () => {
    const sql = buildGrainProbeSql('data"set', [
      { name: 'order"id', type: "VARCHAR" },
      { name: "GrossAmount", type: "DOUBLE" },
    ]);
    if (sql === null) throw new Error("Expected a grain probe query for a key/measure pair");
    expect(sql).toContain('"data""set"');
    expect(sql).toContain('"order""id"');
    expect(buildGrainProbeSql("dataset", [{ name: "name", type: "VARCHAR" }])).toBeNull();
  });
});

describe("interpretGrainProbeRows", () => {
  const row = (overrides: Partial<GrainProbeRow> = {}): GrainProbeRow => ({
    entity_column: "OrderID",
    measure_column: "TotalAmount",
    repeated_groups: 10,
    repeated_rows: 30,
    stable_groups: 9,
    variable_groups: 1,
    ...overrides,
  });

  it("flags a likely repeated aggregate when the value is stable within entity groups", () => {
    const [finding] = interpretGrainProbeRows([row()]);
    expect(finding?.likelyAggregate).toBe(true);
    expect(finding?.confidence).toBe("high");
    expect(finding?.hint).toContain("لا تستخدم SUM");
  });

  it("does not flag mostly variable values or a single repeated group", () => {
    expect(interpretGrainProbeRows([row({ stable_groups: 3, variable_groups: 7 })])).toHaveLength(0);
    expect(interpretGrainProbeRows([row({ repeated_groups: 1, stable_groups: 1 })])).toHaveLength(0);
  });

  it("uses a cautious note for constant non-aggregate measures", () => {
    const [finding] = interpretGrainProbeRows([
      row({ measure_column: "Quantity", stable_groups: 8, variable_groups: 2 }),
    ]);
    expect(finding?.likelyAggregate).toBe(false);
    expect(finding?.hint).toContain("تحقق من مستوى هذا المقياس");
  });

  it("attaches findings to both the key and the measure columns", () => {
    const hints = grainHintsByColumn(interpretGrainProbeRows([row()]));
    expect(hints["OrderID"]).toContain("مفتاح مرشح");
    expect(hints["TotalAmount"]).toContain("تحذير Grain");
  });
});
