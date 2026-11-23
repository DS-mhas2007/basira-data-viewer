import { describe, expect, it } from "vitest";
import { parseDuckDbSqlAst } from "../sql-ast-lineage";

describe("parseDuckDbSqlAst", () => {
  it("parses projection aliases, filters, grouping and ordering", () => {
    const result = parseDuckDbSqlAst(
      "SELECT city, SUM(revenue) AS total FROM sales WHERE quantity > 0 GROUP BY city HAVING SUM(revenue) > 10 ORDER BY total DESC LIMIT 20",
    );
    expect(result.status).toBe("parsed");
    expect(result.query?.projections).toEqual([
      { expression: "city", alias: null },
      { expression: "SUM(revenue)", alias: "total" },
    ]);
    expect(result.query?.from).toMatchObject({ name: "sales", kind: "table" });
    expect(result.query?.where).toBe("quantity > 0");
    expect(result.query?.groupBy).toEqual(["city"]);
    expect(result.query?.having).toBe("SUM(revenue) > 10");
    expect(result.query?.orderBy).toEqual(["total DESC"]);
    expect(result.query?.limit).toBe("20");
  });

  it("parses CTE definitions and resolves CTE relation identity", () => {
    const result = parseDuckDbSqlAst(
      "WITH regional AS (SELECT city, SUM(revenue) AS sales FROM orders GROUP BY city) SELECT r.city, r.sales FROM regional AS r",
    );
    expect(result.status).toBe("parsed");
    expect(result.query?.ctes).toHaveLength(1);
    expect(result.query?.ctes[0]?.query.from?.name).toBe("orders");
    expect(result.query?.from).toMatchObject({ name: "regional", alias: "r", kind: "cte" });
  });

  it("parses joins and preserves ON predicates", () => {
    const result = parseDuckDbSqlAst(
      "SELECT o.id, c.name FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.total > 0",
    );
    expect(result.status).toBe("parsed");
    expect(result.query?.joins).toHaveLength(1);
    expect(result.query?.joins[0]).toMatchObject({
      type: "left",
      relation: { name: "customers", alias: "c" },
      condition: "o.customer_id = c.id",
    });
  });

  it("models comma-separated FROM sources as explicit cross joins", () => {
    const result = parseDuckDbSqlAst("SELECT a.id FROM accounts a, regions r");
    expect(result.status).toBe("parsed");
    expect(result.query?.from).toMatchObject({ name: "accounts", alias: "a" });
    expect(result.query?.joins).toEqual([
      expect.objectContaining({
        type: "cross",
        relation: { name: "regions", alias: "r", kind: "table" },
      }),
    ]);
  });

  it("fails closed for table-valued functions until their grammar is supported", () => {
    const result = parseDuckDbSqlAst("SELECT * FROM read_csv('data.csv')");
    expect(result.status).toBe("unsupported");
    expect(result.warnings[0]).toContain("Table Function");
  });

  it("parses nested subquery relations", () => {
    const result = parseDuckDbSqlAst(
      "SELECT q.city FROM (SELECT city FROM orders) AS q",
    );
    expect(result.status).toBe("parsed");
    expect(result.query?.from?.kind).toBe("subquery");
    expect(result.query?.from?.subquery?.projections[0]?.expression).toBe("city");
  });

  it("preserves string literals and quoted identifiers", () => {
    const result = parseDuckDbSqlAst(
      'SELECT "region""name" AS region FROM sales WHERE city = \'New, York\'',
    );
    expect(result.status).toBe("parsed");
    expect(result.query?.projections[0]).toEqual({
      expression: '"region""name"',
      alias: "region",
    });
    expect(result.query?.where).toBe("city = 'New, York'");
  });

  it("fails closed for malformed SQL and unsupported statements", () => {
    expect(parseDuckDbSqlAst("SELECT * FROM sales /*").status).toBe("invalid");
    expect(parseDuckDbSqlAst("DELETE FROM sales").status).toBe("unsupported");
  });

  it("keeps set operations explicit rather than silently dropping later branches", () => {
    const result = parseDuckDbSqlAst(
      "SELECT city FROM sales UNION ALL SELECT city FROM archived_sales",
    );
    expect(result.status).toBe("parsed");
    expect(result.query?.setOperations[0]).toMatchObject({
      operator: "union",
      all: true,
      query: { kind: "select" },
    });
    expect(result.query?.setOperations[0]?.query?.from?.name).toBe("archived_sales");
  });
});

import { resolveDuckDbSqlAstScope } from "../sql-ast-lineage";

describe("resolveDuckDbSqlAstScope", () => {
  const scopeSchema = { table: "dataset", columns: [{ name: "city" }, { name: "revenue" }, { name: "quantity" }] };

  it("resolves qualified columns through a table alias", () => {
    const parsed = parseDuckDbSqlAst("SELECT d.city, SUM(d.revenue) AS total FROM dataset d GROUP BY d.city");
    const result = resolveDuckDbSqlAstScope(parsed, scopeSchema);
    expect(result.status).toBe("resolved");
    expect(result.sourceColumns).toEqual(["city", "revenue"]);
  });

  it("propagates dependencies through a CTE projection", () => {
    const parsed = parseDuckDbSqlAst("WITH regional AS (SELECT city, revenue AS sales FROM dataset) SELECT regional.city, regional.sales FROM regional");
    const result = resolveDuckDbSqlAstScope(parsed, scopeSchema);
    expect(result.status).toBe("resolved");
    expect(result.sourceColumns).toEqual(["city", "revenue"]);
    expect(result.outputColumns.map((column) => column.sourceColumns)).toEqual([["city"], ["revenue"]]);
  });

  it("fails closed for joins until multi-relation schema resolution exists", () => {
    const parsed = parseDuckDbSqlAst("SELECT d.city FROM dataset d JOIN other o ON d.city = o.city");
    const result = resolveDuckDbSqlAstScope(parsed, scopeSchema);
    expect(result.status).toBe("unsupported");
    expect(result.sourceColumns).toEqual([]);
  });

  it("reports unresolved projected identifiers without inventing dependencies", () => {
    const parsed = parseDuckDbSqlAst("SELECT missing_metric FROM dataset");
    const result = resolveDuckDbSqlAstScope(parsed, scopeSchema);
    expect(result.status).toBe("partial");
    expect(result.sourceColumns).toEqual([]);
    expect(result.outputColumns[0]?.status).toBe("unresolved");
  });

  it("does not ignore qualified references from an unknown relation alias", () => {
    const parsed = parseDuckDbSqlAst("SELECT other.city FROM dataset d");
    const result = resolveDuckDbSqlAstScope(parsed, scopeSchema);
    expect(result.status).toBe("partial");
    expect(result.outputColumns[0]?.status).toBe("unresolved");
  });
});
