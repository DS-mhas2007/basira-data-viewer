import { describe, expect, it, vi } from "vitest";
import {
  buildSqlJoinDiagnosticPlan,
  runSqlJoinDiagnostics,
  type SqlJoinDiagnosticSpec,
} from "../join-cardinality-diagnostics";
import { buildJoinDiagnosticsSql } from "../duckdb-service";
import type { LineageSchema } from "../metric-lineage";

const schemas: LineageSchema[] = [
  {
    table: "dataset",
    columns: [
      { name: "customer_id", type: "INTEGER" },
      { name: "region_id", type: "INTEGER" },
      { name: "order_id", type: "INTEGER" },
    ],
  },
  {
    table: "customers_physical",
    aliases: ["customers"],
    columns: [
      { name: "id", type: "INTEGER" },
      { name: "region_id", type: "INTEGER" },
      { name: "name", type: "VARCHAR" },
    ],
  },
  {
    table: "regions_physical",
    aliases: ["regions"],
    columns: [
      { name: "region_id", type: "INTEGER" },
      { name: "customer_id", type: "INTEGER" },
    ],
  },
];

describe("SQL join cardinality diagnostic planning", () => {
  it("extracts a composite equality key and maps logical aliases to canonical relations", () => {
    const plan = buildSqlJoinDiagnosticPlan(
      "SELECT o.order_id, c.name FROM dataset o LEFT JOIN customers c ON o.customer_id = c.id AND o.region_id = c.region_id",
      schemas,
    );

    expect(plan.status).toBe("supported");
    expect(plan.specs).toMatchObject([{
      index: 1,
      joinType: "left",
      leftTable: "dataset",
      rightTable: "customers_physical",
      leftAlias: "o",
      leftColumns: ["customer_id", "region_id"],
      rightColumns: ["id", "region_id"],
    }]);
    expect(plan.unsupported).toEqual([]);
  });

  it("resolves USING keys only when the left relation is unambiguous", () => {
    const plan = buildSqlJoinDiagnosticPlan(
      "SELECT o.order_id, c.name FROM dataset o INNER JOIN customers c USING (region_id)",
      schemas,
    );

    expect(plan.specs[0]).toMatchObject({
      leftTable: "dataset",
      rightTable: "customers_physical",
      leftColumns: ["region_id"],
      rightColumns: ["region_id"],
    });
  });

  it("fails closed for OR, non-equality, unqualified, and multi-relation predicates", () => {
    const orPlan = buildSqlJoinDiagnosticPlan(
      "SELECT o.order_id FROM dataset o JOIN customers c ON o.customer_id = c.id OR o.region_id = c.region_id",
      schemas,
    );
    const nonEquality = buildSqlJoinDiagnosticPlan(
      "SELECT o.order_id FROM dataset o JOIN customers c ON o.customer_id > c.id",
      schemas,
    );
    const unqualified = buildSqlJoinDiagnosticPlan(
      "SELECT o.order_id FROM dataset o JOIN customers c ON customer_id = id",
      schemas,
    );

    expect(orPlan.specs).toEqual([]);
    expect(nonEquality.specs).toEqual([]);
    expect(unqualified.specs).toEqual([]);
    expect(orPlan.unsupported).toHaveLength(1);
  });

  it("does not query a table-valued function or an unregistered relation", () => {
    const unknown = buildSqlJoinDiagnosticPlan(
      "SELECT o.order_id FROM dataset o JOIN unknown_customers c ON o.customer_id = c.id",
      schemas,
    );
    const tableFunction = buildSqlJoinDiagnosticPlan(
      "SELECT o.order_id FROM dataset o JOIN read_csv('customers.csv') c ON o.customer_id = c.id",
      schemas,
    );

    expect(unknown.specs).toEqual([]);
    expect(tableFunction.specs).toEqual([]);
  });

  it("executes supported joins sequentially and preserves measured row expansion evidence", async () => {
    const order: string[] = [];
    const diagnose = vi.fn(async (spec: SqlJoinDiagnosticSpec) => {
      order.push(spec.rightTable);
      return {
        relationship: "one-to-many" as const,
        leftRows: 100,
        rightRows: 20,
        joinedRows: 140,
        matchedLeftRows: 100,
        matchedRightRows: 20,
        unmatchedLeftRows: 0,
        unmatchedRightRows: 0,
        leftDuplicateKeyGroups: 0,
        rightDuplicateKeyGroups: 4,
        matchedKeyGroups: 16,
        leftMaxKeyFrequency: 1,
        rightMaxKeyFrequency: 3,
        expansionFactor: 1.4,
        warning: true,
        reasons: ["عدد صفوف الدمج أكبر من أكبر مصدر بنسبة 1.40x."],
      };
    });

    const report = await runSqlJoinDiagnostics(
      "SELECT o.order_id FROM dataset o LEFT JOIN customers c ON o.customer_id = c.id",
      schemas,
      diagnose,
    );

    expect(diagnose).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["customers_physical"]);
    expect(report.version).toBe("join-cardinality-v2");
    expect(report.status).toBe("complete");
    expect(report.joins[0]?.diagnostics?.joinedRows).toBe(140);
    expect(report.warnings[0]).toContain("1.40x");
  });

  it("profiles a chained JOIN against the actual preceding JOIN tree", () => {
    const plan = buildSqlJoinDiagnosticPlan(
      "SELECT o.order_id FROM dataset o JOIN customers c ON o.customer_id = c.id JOIN customers c2 ON c.id = c2.id",
      schemas,
    );

    expect(plan.status).toBe("supported");
    expect(plan.specs).toHaveLength(2);
    expect(plan.unsupported).toEqual([]);
    expect(plan.specs[1]).toMatchObject({
      leftTable: "customers_physical",
      rightTable: "customers_physical",
      leftAlias: "c",
      leftFromSql: 'FROM "dataset" AS "o" INNER JOIN "customers_physical" AS "c" ON o.customer_id = c.id',
      leftKeyExpressions: ['"c"."id"'],
      rightAlias: "c2",
    });
  });

  it("supports a composite next-JOIN key spanning multiple prior relation aliases", () => {
    const plan = buildSqlJoinDiagnosticPlan(
      "SELECT o.order_id FROM dataset o JOIN customers c ON o.customer_id = c.id JOIN regions r ON o.region_id = r.region_id AND c.id = r.customer_id",
      schemas,
    );
    expect(plan.status).toBe("supported");
    expect(plan.specs).toHaveLength(2);
    expect(plan.specs[1]).toMatchObject({
      leftInputKind: "intermediate-join-tree",
      leftInputRelations: ["dataset", "customers_physical"],
      leftInputAliases: ["o", "c"],
      leftFromSql: 'FROM "dataset" AS "o" INNER JOIN "customers_physical" AS "c" ON o.customer_id = c.id',
      leftKeyExpressions: ['"o"."region_id"', '"c"."id"'],
      rightAlias: "r",
      rightColumns: ["region_id", "customer_id"],
    });
    expect(plan.unsupported).toEqual([]);
  });

  it("withholds every later JOIN when an earlier JOIN cannot be profiled", () => {
    const plan = buildSqlJoinDiagnosticPlan(
      "SELECT o.order_id FROM dataset o JOIN customers c ON o.customer_id > c.id JOIN customers c2 ON c.id = c2.id",
      schemas,
    );
    expect(plan.specs).toEqual([]);
    expect(plan.unsupported.map((item) => item.index)).toEqual([1, 2]);
  });

  it("marks queries without joins as not applicable", async () => {
    const diagnose = vi.fn();
    const report = await runSqlJoinDiagnostics("SELECT order_id FROM dataset", schemas, diagnose);

    expect(report.status).toBe("not-applicable");
    expect(diagnose).not.toHaveBeenCalled();
  });
});

describe("buildJoinTreeDiagnosticsSql intermediate inputs", () => {
  it("profiles the actual prior JOIN tree while retaining source aliases for the next key", async () => {
    const { buildJoinTreeDiagnosticsSql } = await import("../duckdb-service");
    const sql = buildJoinTreeDiagnosticsSql(
      'FROM "dataset" AS "o" INNER JOIN "customers_physical" AS "c" ON o.customer_id = c.id',
      "regions_physical", "r", ['"c"."region_id"'], ["id"], "left",
    );
    expect(sql).toContain('FROM "dataset" AS "o" INNER JOIN "customers_physical" AS "c" ON o.customer_id = c.id');
    expect(sql).toContain('"c"."region_id" IS NOT NULL');
    expect(sql).toContain('FROM "regions_physical" AS "r"');
    expect(sql).toContain("joined_rows");
  });
});

describe("buildJoinDiagnosticsSql composite keys", () => {
  it("uses a null-safe composite grouping expression for multi-column keys", () => {
    const sql = buildJoinDiagnosticsSql(
      "orders_table",
      "customers_table",
      ["customer_id", "region_id"],
      ["id", "region_id"],
      "left",
    );

    expect(sql).toContain("struct_pack(k0 := \"customer_id\", k1 := \"region_id\")");
    expect(sql).toContain("struct_pack(k0 := \"id\", k1 := \"region_id\")");
    expect(sql).toContain("\"customer_id\" IS NOT NULL AND \"region_id\" IS NOT NULL");
    expect(sql).toContain("joined_rows");
  });

  it("rejects mismatched composite key lengths", () => {
    expect(() => buildJoinDiagnosticsSql(
      "orders_table", "customers_table", ["customer_id", "region_id"], ["id"], "inner",
    )).toThrow("العدد نفسه");
  });
});


describe("JOIN diagnostic scope and fail-closed boundaries", () => {
  it("keeps WHERE and final aggregation filters outside the measured JOIN input", () => {
    const plan = buildSqlJoinDiagnosticPlan(
      "SELECT o.order_id, count(*) FROM dataset o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.region_id = 7 GROUP BY o.order_id HAVING count(*) > 1",
      schemas,
    );

    expect(plan.status).toBe("supported");
    expect(plan.specs).toHaveLength(1);
    expect(plan.specs[0]?.leftFromSql).toBe('FROM "dataset" AS "o"');
    expect(plan.specs[0]?.leftFromSql).not.toMatch(/WHERE|GROUP BY|HAVING/i);
  });

  it("resolves chained USING keys when each left-side column has one owner", () => {
    const usingSchemas: LineageSchema[] = [
      { table: "using_base", columns: [{ name: "base_key", type: "INTEGER" }] },
      { table: "using_middle", columns: [
        { name: "base_key", type: "INTEGER" },
        { name: "middle_key", type: "INTEGER" },
      ] },
      { table: "using_right", columns: [{ name: "middle_key", type: "INTEGER" }] },
    ];
    const plan = buildSqlJoinDiagnosticPlan(
      "SELECT b.base_key FROM using_base b JOIN using_middle m USING (base_key) JOIN using_right r USING (middle_key)",
      usingSchemas,
    );

    expect(plan.status).toBe("supported");
    expect(plan.specs).toHaveLength(2);
    expect(plan.specs[0]).toMatchObject({
      leftColumns: ["base_key"],
      rightColumns: ["base_key"],
    });
    expect(plan.specs[1]).toMatchObject({
      leftInputKind: "intermediate-join-tree",
      leftInputAliases: ["b", "m"],
      leftKeyExpressions: ['"m"."middle_key"'],
      rightColumns: ["middle_key"],
    });
    expect(plan.unsupported).toEqual([]);
  });

  it("fails closed when a chained USING column is ambiguous across prior relations", () => {
    const plan = buildSqlJoinDiagnosticPlan(
      "SELECT o.order_id FROM dataset o JOIN customers c USING (region_id) JOIN regions r USING (region_id)",
      schemas,
    );

    expect(plan.specs).toHaveLength(1);
    expect(plan.unsupported.map((item) => item.index)).toEqual([2]);
    expect(plan.status).toBe("unsupported");
  });

  it("does not diagnose JOINs whose left input is a CTE or derived subquery", () => {
    const cte = buildSqlJoinDiagnosticPlan(
      "WITH recent_orders AS (SELECT customer_id FROM dataset) SELECT r.customer_id FROM recent_orders r JOIN customers c ON r.customer_id = c.id",
      schemas,
    );
    const derived = buildSqlJoinDiagnosticPlan(
      "SELECT r.customer_id FROM (SELECT customer_id FROM dataset) r JOIN customers c ON r.customer_id = c.id",
      schemas,
    );

    expect(cte.status).toBe("unsupported");
    expect(cte.specs).toEqual([]);
    expect(derived.status).toBe("unsupported");
    expect(derived.specs).toEqual([]);
  });

  it("withholds downstream JOIN measurements when a later predicate contains OR", () => {
    const plan = buildSqlJoinDiagnosticPlan(
      "SELECT o.order_id FROM dataset o JOIN customers c ON o.customer_id = c.id JOIN regions r ON c.region_id = r.region_id OR o.region_id = r.region_id",
      schemas,
    );

    expect(plan.specs).toHaveLength(1);
    expect(plan.specs[0]?.index).toBe(1);
    expect(plan.unsupported.map((item) => item.index)).toEqual([2]);
    expect(plan.status).toBe("unsupported");
  });
});
