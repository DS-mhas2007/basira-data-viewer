import { describe, expect, it } from "vitest";
import { resolveDuckDbSqlScope } from "../sql-ast-scope";
import type { LineageSchema } from "../metric-lineage";

const orders: LineageSchema = {
  table: "orders",
  columns: [
    { name: "city", type: "VARCHAR" },
    { name: "revenue", type: "DOUBLE" },
    { name: "quantity", type: "INTEGER" },
    { name: "customer_id", type: "INTEGER" },
  ],
};

describe("resolveDuckDbSqlScope", () => {
  it("resolves direct and qualified projections through a table alias", () => {
    const result = resolveDuckDbSqlScope(
      "SELECT o.city, SUM(o.revenue) AS total FROM orders o GROUP BY o.city",
      [orders],
    );
    expect(result.status).toBe("resolved");
    expect(result.projections).toEqual([
      expect.objectContaining({ outputName: "city", sourceColumns: ["city"], status: "resolved" }),
      expect.objectContaining({ outputName: "total", sourceColumns: ["revenue"], status: "resolved" }),
    ]);
  });

  it("propagates CTE projection lineage to its underlying source", () => {
    const result = resolveDuckDbSqlScope(
      "WITH regional AS (SELECT city, SUM(revenue) AS sales FROM orders GROUP BY city) SELECT r.city, r.sales FROM regional r",
      [orders],
    );
    expect(result.status).toBe("resolved");
    expect(result.sourceColumns).toEqual(["city", "revenue"]);
    expect(result.projections[1]).toMatchObject({
      outputName: "sales",
      sourceColumns: ["revenue"],
      status: "resolved",
    });
  });

  it("resolves derived-table projections recursively", () => {
    const result = resolveDuckDbSqlScope(
      "SELECT q.city, q.total FROM (SELECT city, SUM(revenue) AS total FROM orders GROUP BY city) q",
      [orders],
    );
    expect(result.status).toBe("resolved");
    expect(result.sourceColumns).toEqual(["city", "revenue"]);
  });

  it("marks unqualified columns ambiguous when multiple joined sources expose them", () => {
    const customers: LineageSchema = {
      table: "customers",
      columns: [{ name: "city", type: "VARCHAR" }, { name: "name", type: "VARCHAR" }],
    };
    const result = resolveDuckDbSqlScope(
      "SELECT city FROM orders o JOIN customers c ON o.customer_id = c.customer_id",
      [orders, customers],
    );
    expect(result.status).toBe("partial");
    expect(result.projections[0]).toMatchObject({ status: "ambiguous" });
  });

  it("does not claim lineage for unknown source relations", () => {
    const result = resolveDuckDbSqlScope("SELECT x.city FROM unknown_table x", [orders]);
    expect(result.status).toBe("unsupported");
    expect(result.projections[0]?.status).toBe("unresolved");
  });

  it("does not treat function names or string literals as column references", () => {
    const result = resolveDuckDbSqlScope(
      "SELECT COALESCE(city, 'revenue') AS label FROM orders",
      [orders],
    );
    expect(result.status).toBe("resolved");
    expect(result.projections[0]?.sourceColumns).toEqual(["city"]);
  });
});
