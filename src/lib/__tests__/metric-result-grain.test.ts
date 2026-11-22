import { describe, expect, it } from "vitest";
import {
  buildResultGrainProbeSql,
  canVerifyResultGrain,
  containsVolatileSqlExpression,
  interpretResultGrainProbe,
} from "@/lib/metric-result-grain";

describe("result Grain verification", () => {
  it("requires complete lineage, no explicit limit, a non-truncated result and declared dimensions", () => {
    const base = {
      lineageStatus: "complete" as const,
      hasExplicitLimit: false,
      returnedRows: 12,
      maxRows: 5000,
      grainColumns: ["patient_id", "month"],
    };
    expect(canVerifyResultGrain(base)).toBe(true);
    expect(canVerifyResultGrain({ ...base, lineageStatus: "partial" })).toBe(false);
    expect(canVerifyResultGrain({ ...base, hasExplicitLimit: true })).toBe(false);
    expect(canVerifyResultGrain({ ...base, returnedRows: 5000 })).toBe(false);
    expect(canVerifyResultGrain({ ...base, grainColumns: [] })).toBe(false);
  });

  it("blocks result-Grain verification for volatile expressions", () => {
    const base = {
      lineageStatus: "complete" as const,
      hasExplicitLimit: false,
      returnedRows: 12,
      maxRows: 5000,
      grainColumns: ["patient_id"],
    };
    expect(canVerifyResultGrain({ ...base, hasVolatileExpressions: true })).toBe(false);
    expect(canVerifyResultGrain({ ...base, hasVolatileExpressions: false })).toBe(true);
  });

  it("detects volatile SQL functions without matching string literals or comments", () => {
    expect(containsVolatileSqlExpression("SELECT random(), patient_id FROM t")).toBe(true);
    expect(containsVolatileSqlExpression("SELECT current_timestamp, patient_id FROM t")).toBe(true);
    expect(containsVolatileSqlExpression("SELECT 'random()' AS note FROM t")).toBe(false);
    expect(containsVolatileSqlExpression("SELECT 1 -- now()\\nFROM t")).toBe(false);
    expect(containsVolatileSqlExpression("SELECT 1 /* uuid() */ FROM t")).toBe(false);
  });

  it("wraps only SELECT queries and safely quotes output aliases", () => {
    expect(buildResultGrainProbeSql("DELETE FROM dataset", ["id"])).toBeNull();
    expect(buildResultGrainProbeSql("SELECT id FROM dataset", [])).toBeNull();
    const sql = buildResultGrainProbeSql('SELECT "patient id" AS "patient id" FROM dataset', ['patient"id']);
    expect(sql).toContain('"patient""id"');
    expect(sql).toContain('FROM (SELECT "patient id" AS "patient id" FROM dataset) AS "__metric_result"');
  });

  it("accepts only non-empty duplicate-free result groups", () => {
    expect(interpretResultGrainProbe({ group_count: 10, duplicate_groups: 0 })).toBe(true);
    expect(interpretResultGrainProbe({ group_count: 10, duplicate_groups: 1 })).toBe(false);
    expect(interpretResultGrainProbe({ group_count: 0, duplicate_groups: 0 })).toBe(false);
    expect(interpretResultGrainProbe(undefined)).toBe(false);
    expect(interpretResultGrainProbe({ group_count: "bad", duplicate_groups: 0 })).toBe(false);
  });
});
