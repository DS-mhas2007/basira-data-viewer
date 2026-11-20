import { describe, expect, it } from "vitest";
import { buildKnnWorkSql, knnTableName, pickKnnFeatures } from "./knn-impute";
import { buildStepSql, columnExpr, makeFillGroupStep, makeKnnStep } from "./cleaning";

const col = (name: string, over: Partial<{ isNumeric: boolean; nullRatio: number; distinctCount: number }> = {}) => ({
  name,
  type: "DOUBLE",
  isNumeric: true,
  nullRatio: 0,
  distinctCount: 50,
  ...over,
});

describe("pickKnnFeatures", () => {
  it("skips the target, ids, constants, text and mostly-empty columns, best-filled first", () => {
    const features = pickKnnFeatures(
      [
        col("income"),
        col("order_id"),
        col("flag", { distinctCount: 1 }),
        col("name", { isNumeric: false }),
        col("mostly_empty", { nullRatio: 0.95 }),
        col("score", { nullRatio: 0.2 }),
        col("age", { nullRatio: 0.05 }),
      ],
      "income",
    );
    expect(features).toEqual(["age", "score"]);
  });

  it("caps the number of features", () => {
    const many = Array.from({ length: 20 }, (_, i) => col(`f${i}`));
    expect(pickKnnFeatures(many, "x")).toHaveLength(8);
  });
});

describe("buildKnnWorkSql", () => {
  const sql = buildKnnWorkSql({
    allColumns: ["id", "age", "income"],
    column: "income",
    columnType: "BIGINT",
    features: ["age", "income", "score"],
    k: 5,
  });

  it("standardizes features, excludes the target from distance, and uses a repeatable sample", () => {
    expect(sql).toContain("stddev_samp");
    expect(sql).toContain("REPEATABLE (42)");
    expect(sql).not.toContain('"income") AS DOUBLE) - st'); // target is not a feature
    expect(sql).toContain("LIMIT 5");
  });

  it("rounds imputed values for integer columns and clamps k", () => {
    expect(sql).toContain("CAST(round(imp.__val) AS BIGINT)");
    const huge = buildKnnWorkSql({ allColumns: ["a", "b"], column: "a", columnType: "DOUBLE", features: ["b"], k: 999 });
    expect(huge).toContain("LIMIT 25");
  });
});

describe("step kinds", () => {
  it("knn step reads from its materialized table", () => {
    const step = makeKnnStep(["a", "b"], "a", "DOUBLE", ["b"], 5, 3);
    expect(buildStepSql(step, "SELECT 1")).toContain(knnTableName(step.id));
    expect(step.label).toContain("مقدَّرة");
  });

  it("fillgroup uses a per-group median with a global fallback", () => {
    const step = makeFillGroupStep(["dept", "sal"], "sal", "DOUBLE", "dept", 2);
    const expr = columnExpr(step, "sal");
    expect(expr).toContain('PARTITION BY "dept"');
    expect(expr).toContain("median(CAST(\"sal\" AS DOUBLE)) OVER ()");
    expect(columnExpr(step, "dept")).toBe('"dept"');
  });
});
