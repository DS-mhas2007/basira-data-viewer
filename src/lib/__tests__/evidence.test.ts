import { describe, expect, it } from "vitest";
import { isSimpleBaseScan } from "../evidence";

describe("isSimpleBaseScan", () => {
  it("accepts a plain projection from the source table", () => {
    expect(isSimpleBaseScan('SELECT * FROM "dataset"')).toBe(true);
    expect(isSimpleBaseScan('SELECT city, revenue FROM dataset LIMIT 1000')).toBe(true);
  });

  it("accepts comments without mistaking their contents for SQL clauses", () => {
    expect(isSimpleBaseScan("SELECT city FROM dataset -- WHERE fake = 1")).toBe(true);
  });

  it("rejects filters because the current counter cannot safely parse them", () => {
    expect(isSimpleBaseScan("SELECT * FROM dataset WHERE city = 'Gaza'")).toBe(false);
  });

  it("rejects joins, grouping, aggregates, CTEs, and subqueries", () => {
    const queries = [
      "SELECT * FROM dataset JOIN other ON dataset.id = other.id",
      "SELECT city, count(*) FROM dataset GROUP BY city",
      "SELECT sum(revenue) FROM dataset",
      "WITH t AS (SELECT * FROM dataset) SELECT * FROM t",
      "SELECT * FROM dataset WHERE id IN (SELECT id FROM dataset)",
    ];
    for (const query of queries) expect(isSimpleBaseScan(query)).toBe(false);
  });

  it("rejects malformed SQL and non-source tables", () => {
    expect(isSimpleBaseScan("SELECT * FROM other")).toBe(false);
    expect(isSimpleBaseScan("SELECT * FROM dataset /* unterminated")).toBe(false);
  });
});
