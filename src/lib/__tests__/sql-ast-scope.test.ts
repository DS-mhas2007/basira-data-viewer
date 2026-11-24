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

  it("preserves table identity when joined sources share column names", () => {
    const customers: LineageSchema = {
      table: "customers",
      columns: [
        { name: "customer_id", type: "INTEGER" },
        { name: "name", type: "VARCHAR" },
      ],
    };
    const result = resolveDuckDbSqlScope(
      "SELECT o.customer_id AS order_customer_id, c.customer_id AS customer_customer_id FROM orders o JOIN customers c ON o.customer_id = c.customer_id",
      [orders, customers],
    );
    expect(result.projections[0]?.sourceReferences).toEqual([
      { table: "orders", column: "customer_id" },
    ]);
    expect(result.projections[1]?.sourceReferences).toEqual([
      { table: "customers", column: "customer_id" },
    ]);
    expect(result.sourceReferences).toEqual([
      { table: "customers", column: "customer_id" },
      { table: "orders", column: "customer_id" },
    ]);
  });

  it("propagates relation-aware references through CTE and derived-table projections", () => {
    const result = resolveDuckDbSqlScope(
      "WITH c AS (SELECT customer_id FROM orders) SELECT q.customer_id FROM c q",
      [orders],
    );
    expect(result.status).toBe("resolved");
    expect(result.projections[0]?.sourceReferences).toEqual([
      { table: "orders", column: "customer_id" },
    ]);
  });

  it("does not treat function names or string literals as column references", () => {
    const result = resolveDuckDbSqlScope(
      "SELECT COALESCE(city, 'revenue') AS label FROM orders",
      [orders],
    );
    expect(result.status).toBe("resolved");
    expect(result.projections[0]?.sourceColumns).toEqual(["city"]);
  });
  it("includes filter, grouping, having, ordering and join-key dependencies", () => {
    const customers: LineageSchema = {
      table: "customers",
      columns: [
        { name: "customer_id", type: "INTEGER" },
        { name: "segment", type: "VARCHAR" },
      ],
    };
    const result = resolveDuckDbSqlScope(
      "SELECT o.city, SUM(o.revenue) AS sales FROM orders o JOIN customers c ON o.customer_id = c.customer_id WHERE o.quantity > 0 GROUP BY o.city HAVING SUM(o.revenue) > 100 ORDER BY sales DESC",
      [orders, customers],
    );
    expect(result.status).toBe("resolved");
    expect(result.sourceColumns).toEqual(["city", "customer_id", "quantity", "revenue"]);
  });

  it("fails closed for wildcard projections in derived scopes", () => {
    const result = resolveDuckDbSqlScope(
      "WITH all_orders AS (SELECT * FROM orders) SELECT all_orders.city FROM all_orders",
      [orders],
    );
    expect(result.status).toBe("partial");
    expect(result.warnings.join(" ")).toContain("wildcard");
  });

  it("does not ignore unknown qualified aliases", () => {
    const result = resolveDuckDbSqlScope("SELECT x.city FROM orders o", [orders]);
    expect(result.status).toBe("partial");
    expect(result.projections[0]?.status).toBe("unresolved");
  });

  it("resolves ORDER BY output aliases to their source dependencies", () => {
    const result = resolveDuckDbSqlScope(
      "SELECT SUM(revenue) AS sales FROM orders ORDER BY sales DESC",
      [orders],
    );
    expect(result.status).toBe("resolved");
    expect(result.sourceColumns).toEqual(["revenue"]);
  });

  it("propagates unresolved nested-scope evidence instead of hiding it", () => {
    const result = resolveDuckDbSqlScope(
      "WITH regional AS (SELECT missing_column FROM orders) SELECT regional.missing_column FROM regional",
      [orders],
    );
    expect(result.status).toBe("partial");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("preserves filter-only source dependencies through a CTE", () => {
    const result = resolveDuckDbSqlScope(
      "WITH regional AS (SELECT city FROM orders WHERE revenue > 100) SELECT regional.city FROM regional",
      [orders],
    );
    expect(result.status).toBe("resolved");
    expect(result.sourceColumns).toEqual(["city", "revenue"]);
  });

  it("preserves filter-only dependencies through a derived table", () => {
    const result = resolveDuckDbSqlScope(
      "SELECT q.city FROM (SELECT city FROM orders WHERE revenue > 100) q",
      [orders],
    );
    expect(result.status).toBe("resolved");
    expect(result.sourceColumns).toEqual(["city", "revenue"]);
  });

  it("fails closed for recursive CTEs", () => {
    const result = resolveDuckDbSqlScope(
      "WITH RECURSIVE regional AS (SELECT city FROM orders UNION ALL SELECT city FROM regional) SELECT city FROM regional",
      [orders],
    );
    expect(result.status).toBe("unsupported");
  });

  it("does not resolve a missing qualified relation by an unrelated matching table leaf", () => {
    const result = resolveDuckDbSqlScope(
      "SELECT id FROM reporting.orders",
      [{ table: "archive.orders", columns: [{ name: "id", type: "INTEGER" }] }],
    );
    expect(result.status).toBe("unsupported");
    expect(result.warnings.join(" ")).toContain("تعذر حل مصدر البيانات");
  });

  it("fails closed when an unqualified relation name matches multiple schemas", () => {
    const result = resolveDuckDbSqlScope(
      "SELECT id FROM orders",
      [
        { table: "sales.orders", columns: [{ name: "id", type: "INTEGER" }] },
        { table: "archive.orders", columns: [{ name: "id", type: "INTEGER" }] },
      ],
    );
    expect(result.status).toBe("unsupported");
    expect(result.warnings.join(" ")).toContain("تعذر حل مصدر البيانات");
  });

  it("flags CROSS JOIN because row multiplication is unconstrained", () => {
    const result = resolveDuckDbSqlScope(
      "SELECT o.city FROM orders o CROSS JOIN customers c",
      [orders, { table: "customers", columns: [{ name: "id", type: "INTEGER" }] }],
    );
    expect(result.status).toBe("partial");
    expect(result.warnings.join(" ")).toContain("حاصل الضرب الديكارتي");
  });

  it("flags non-equality JOIN predicates as insufficient for key-cardinality assessment", () => {
    const result = resolveDuckDbSqlScope(
      "SELECT o.city FROM orders o JOIN customers c ON o.customer_id > c.id",
      [orders, { table: "customers", columns: [{ name: "id", type: "INTEGER" }] }],
    );
    expect(result.status).toBe("partial");
    expect(result.warnings.join(" ")).toContain("ليس مساواة مباشرة");
  });

  it("resolves logical registered-source aliases but emits canonical physical identity", () => {
    const result = resolveDuckDbSqlScope(
      "SELECT c.customer_id FROM customer_directory c",
      [{
        table: "dataset__source__customer_abc",
        aliases: ["customer_directory"],
        columns: [{ name: "customer_id", type: "INTEGER" }],
      }],
    );
    expect(result.status).toBe("resolved");
    expect(result.sourceReferences).toEqual([
      { table: "dataset__source__customer_abc", column: "customer_id" },
    ]);
  });

  it("does not mistake CAST target types for source columns", () => {
    const result = resolveDuckDbSqlScope(
      "SELECT CAST(revenue AS DOUBLE) AS normalized FROM orders",
      [orders],
    );
    expect(result.status).toBe("resolved");
    expect(result.sourceColumns).toEqual(["revenue"]);
  });

  it("recognizes SQL special values without treating them as columns", () => {
    const result = resolveDuckDbSqlScope(
      "SELECT CURRENT_DATE AS report_date, city FROM orders",
      [orders],
    );
    expect(result.status).toBe("resolved");
    expect(result.sourceColumns).toEqual(["city"]);
  });
  it("merges UNION branch value lineage by output column position", () => {
    const archived: LineageSchema = {
      table: "archived_orders",
      columns: [
        { name: "town", type: "VARCHAR" },
        { name: "total", type: "DOUBLE" },
      ],
    };
    const result = resolveDuckDbSqlScope(
      "SELECT city, revenue FROM orders UNION ALL SELECT town, total FROM archived_orders",
      [orders, archived],
    );
    expect(result.status).toBe("resolved");
    expect(result.projections[0]).toMatchObject({
      outputName: "city",
      sourceColumns: ["city", "town"],
      status: "resolved",
    });
    expect(result.projections[0]?.sourceReferences).toEqual([
      { table: "archived_orders", column: "town" },
      { table: "orders", column: "city" },
    ]);
    expect(result.sourceColumns).toEqual(["city", "revenue", "total", "town"]);
  });

  it("keeps INTERSECT right-branch dependencies separate from output-value lineage", () => {
    const archived: LineageSchema = {
      table: "archived_orders",
      columns: [{ name: "town", type: "VARCHAR" }],
    };
    const result = resolveDuckDbSqlScope(
      "SELECT city FROM orders INTERSECT SELECT town FROM archived_orders",
      [orders, archived],
    );
    expect(result.status).toBe("resolved");
    expect(result.projections[0]).toMatchObject({
      sourceColumns: ["city"],
      rowFilterSourceColumns: ["town"],
    });
    expect(result.projections[0]?.sourceReferences).toEqual([
      { table: "orders", column: "city" },
    ]);
    expect(result.projections[0]?.rowFilterSourceReferences).toEqual([
      { table: "archived_orders", column: "town" },
    ]);
    expect(result.sourceColumns).toEqual(["city", "town"]);
  });

  it("retains EXCEPT right-branch filter-only dependencies", () => {
    const archived: LineageSchema = {
      table: "archived_orders",
      columns: [
        { name: "town", type: "VARCHAR" },
        { name: "status", type: "VARCHAR" },
      ],
    };
    const result = resolveDuckDbSqlScope(
      "SELECT city FROM orders EXCEPT SELECT town FROM archived_orders WHERE status = 'blocked'",
      [orders, archived],
    );
    expect(result.status).toBe("resolved");
    expect(result.projections[0]).toMatchObject({
      sourceColumns: ["city"],
      rowFilterSourceColumns: ["town"],
    });
    expect(result.sourceColumns).toEqual(["city", "status", "town"]);
    expect(result.sourceReferences).toContainEqual({ table: "archived_orders", column: "status" });
  });

  it("resolves nested UNION branches recursively", () => {
    const archived: LineageSchema = {
      table: "archived_orders",
      columns: [{ name: "town", type: "VARCHAR" }],
    };
    const priority: LineageSchema = {
      table: "priority_orders",
      columns: [{ name: "district", type: "VARCHAR" }],
    };
    const result = resolveDuckDbSqlScope(
      "SELECT city FROM orders UNION SELECT town FROM archived_orders UNION SELECT district FROM priority_orders",
      [orders, archived, priority],
    );
    expect(result.status).toBe("resolved");
    expect(result.projections[0]?.sourceColumns).toEqual(["city", "district", "town"]);
    expect(result.sourceReferences).toEqual([
      { table: "archived_orders", column: "town" },
      { table: "orders", column: "city" },
      { table: "priority_orders", column: "district" },
    ]);
  });

  it("fails closed when a set-operation branch references an unknown source", () => {
    const result = resolveDuckDbSqlScope(
      "SELECT city FROM orders UNION ALL SELECT town FROM unknown_archive",
      [orders],
    );
    expect(result.status).toBe("unsupported");
    expect(result.warnings.join(" ")).toContain("تعذر حل مصدر البيانات");
  });

});
