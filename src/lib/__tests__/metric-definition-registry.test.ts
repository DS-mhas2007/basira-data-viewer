import { describe, expect, it } from "vitest";
import {
  assessMetricAlignment,
  normalizeMetricFormula,
  validateMetricDefinition,
  validateMetricRegistry,
  type MetricDefinition,
} from "../metric-definition-registry";

const schema = {
  columns: [
    { name: "revenue", type: "DOUBLE" },
    { name: "order_id", type: "VARCHAR" },
    { name: "month", type: "DATE" },
  ],
};

function definition(overrides: Partial<MetricDefinition> = {}): MetricDefinition {
  return {
    id: "gross_revenue",
    name: "Gross revenue",
    description: "Sum of recorded revenue before exclusions.",
    formula: "SUM(revenue)",
    sourceColumns: ["revenue"],
    grain: ["month"],
    filters: [],
    exclusions: [],
    unit: "USD",
    expectedDomain: { kind: "numeric", min: 0 },
    assumptions: ["Revenue values are recorded in USD."],
    limitations: ["Refund treatment is not represented."],
    source: { dataset: "orders", version: "2026-11" },
    status: "approved",
    updatedAt: "2026-11-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("metric definition registry", () => {
  it("validates a complete definition against the active schema", () => {
    const result = validateMetricDefinition(definition(), schema);
    expect(result.valid).toBe(true);
    expect(result.resolvedSourceColumns).toEqual(["revenue"]);
  });

  it("rejects executable SQL and unbalanced expressions", () => {
    expect(validateMetricDefinition(definition({ formula: "SELECT SUM(revenue)" }), schema)
      .issues.map((issue) => issue.code)).toContain("formula-not-expression");
    expect(validateMetricDefinition(definition({ formula: "SUM(revenue" }), schema)
      .issues.map((issue) => issue.code)).toContain("formula-unbalanced");
  });

  it("does not reject SQL keywords inside quoted formula literals", () => {
    expect(validateMetricDefinition(
      definition({ formula: "CASE WHEN status = 'select' THEN revenue ELSE 0 END" }),
      schema,
    ).valid).toBe(true);
    expect(validateMetricDefinition(
      definition({ formula: "SUM(revenue) -- comment" }),
      schema,
    ).issues.map((issue) => issue.code)).toContain("formula-not-expression");
  });

  it("rejects unknown and duplicate source columns", () => {
    const result = validateMetricDefinition(
      definition({ sourceColumns: ["revenue", "Revenue", "missing"] }),
      schema,
    );
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["duplicate-source-column", "unknown-source-column"]),
    );
  });

  it("rejects invalid numeric domains", () => {
    const result = validateMetricDefinition(
      definition({ expectedDomain: { kind: "numeric", min: 10, max: 2 } }),
      schema,
    );
    expect(result.issues.map((issue) => issue.code)).toContain("invalid-domain");
  });

  it("detects duplicate registry ids and names", () => {
    const result = validateMetricRegistry(
      [definition(), definition({ id: "gross_revenue_2" })],
      schema,
    );
    expect(result[1]?.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["duplicate-name"]),
    );
  });

  it("requires an approved definition and sufficient observed grain", () => {
    expect(assessMetricAlignment(definition({ status: "draft" }), {
      expression: "SUM(revenue)", sourceColumns: ["revenue"], grain: ["month"],
    }).status).toBe("insufficient-evidence");
    expect(assessMetricAlignment(definition(), {
      expression: "SUM(revenue)", sourceColumns: ["revenue"],
    }).status).toBe("insufficient-evidence");
  });

  it("aligns only when expression, dependencies and grain all agree", () => {
    const result = assessMetricAlignment(definition(), {
      expression: "sum( revenue )",
      sourceColumns: ["revenue"],
      grain: ["month"],
    });
    expect(result.status).toBe("aligned");
  });

  it("reports mismatches instead of silently accepting semantic drift", () => {
    const result = assessMetricAlignment(definition(), {
      expression: "SUM(revenue) - SUM(refunds)",
      sourceColumns: ["revenue", "refunds"],
      grain: ["order_id"],
    });
    expect(result.status).toBe("mismatch");
    expect(result.reasons).toHaveLength(3);
  });

  it("normalizes whitespace without changing expression tokens", () => {
    expect(normalizeMetricFormula(" SUM(  revenue ) ")).toBe("sum( revenue )");
  });
});
