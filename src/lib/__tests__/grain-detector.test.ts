import { describe, expect, it } from "vitest";
import { validateQuery } from "../sql-validator";
import {
  buildGrainProbeSql,
  grainHintsByColumn,
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

describe("buildGrainProbeSql", () => {
  it("builds read-only full-dataset probes for key/measure pairs", () => {
    const sql = buildGrainProbeSql("sales dataset", [
      { name: "OrderID", type: "VARCHAR" },
      { name: "TotalAmount", type: "DECIMAL(12,2)" },
    ]);

    expect(sql).toContain('FROM "sales dataset"');
    expect(sql).toContain('CAST("OrderID" AS VARCHAR)');
    expect(sql).toContain('TRY_CAST("TotalAmount" AS DOUBLE)');
    expect(sql).toContain("UNION ALL");
    expect(sql).toContain("stable_groups");
    expect(validateQuery(sql, { tables: { "sales dataset": ["OrderID", "TotalAmount"] } }).isValid).toBe(true);
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|INSERT)\b/i);
  });

  it("escapes SQL identifiers and returns null when no usable key/measure pair exists", () => {
    const sql = buildGrainProbeSql('data"set', [
      { name: 'order"id', type: "VARCHAR" },
      { name: "GrossAmount", type: "DOUBLE" },
    ]);
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
    expect(hints.OrderID).toContain("مفتاح مرشح");
    expect(hints.TotalAmount).toContain("تحذير Grain");
  });
});
