import { describe, expect, it } from "vitest";
import { buildMetricLineage, splitSqlTopLevel } from "../metric-lineage";
import type { LineageSchema } from "../metric-lineage";

const schema: LineageSchema = {
  table: "dataset",
  columns: [
    { name: "city", type: "VARCHAR" },
    { name: "revenue", type: "DECIMAL(12,2)" },
    { name: "quantity", type: "INTEGER" },
    { name: "order_id", type: "VARCHAR" },
    { name: "created_at", type: "TIMESTAMP" },
    { name: 'region"name', type: "VARCHAR" },
  ],
};

describe("splitSqlTopLevel", () => {
  it("keeps commas inside function calls and quoted identifiers", () => {
    expect(splitSqlTopLevel('city, sum(revenue + quantity), "region""name"')).toEqual([
      "city",
      "sum(revenue + quantity)",
      '"region""name"',
    ]);
  });
});

describe("buildMetricLineage", () => {
  it("traces direct projections and aggregate metrics to source columns", () => {
    const lineage = buildMetricLineage(
      'SELECT city, SUM(revenue) AS total_revenue, COUNT(DISTINCT order_id) AS orders FROM dataset GROUP BY city ORDER BY total_revenue DESC LIMIT 10',
      schema,
    );
    expect(lineage.status).toBe("complete");
    expect(lineage.sourceColumns).toEqual(["city", "order_id", "revenue"]);
    expect(lineage.sourceReferences).toEqual([
      { table: "dataset", column: "city" },
      { table: "dataset", column: "order_id" },
      { table: "dataset", column: "revenue" },
    ]);
    expect(lineage.outputColumns).toEqual([
      expect.objectContaining({ outputName: "city", role: "dimension", sourceColumns: ["city"] }),
      expect.objectContaining({ outputName: "total_revenue", role: "metric", sourceColumns: ["revenue"], operations: ["aggregate"] }),
      expect.objectContaining({ outputName: "orders", role: "metric", sourceColumns: ["order_id"], operations: ["aggregate", "distinct"] }),
    ]);
    expect(lineage.operations.map((operation) => operation.kind)).toEqual([
      "source", "group", "aggregate", "sort", "limit", "projection",
    ]);
  });

  it("recognizes filters, casts, conditional expressions and preserves SQL literals", () => {
    const lineage = buildMetricLineage(
      "SELECT SUM(TRY_CAST(revenue AS DOUBLE)) AS total FROM dataset WHERE city = 'A, B' AND quantity > 0",
      schema,
    );
    expect(lineage.status).toBe("complete");
    expect(lineage.sourceColumns).toEqual(["city", "quantity", "revenue"]);
    expect(lineage.operations.map((operation) => operation.kind)).toContain("filter");
    expect(lineage.operations.map((operation) => operation.kind)).toContain("cast");
    expect(lineage.outputColumns[0]?.operations).toContain("aggregate");
    expect(lineage.warnings).toHaveLength(0);
  });

  it("marks joins and CTEs as partial rather than claiming full lineage", () => {
    const sql = `WITH regional AS (
      SELECT city, SUM(revenue) AS sales FROM dataset GROUP BY city
    )
    SELECT r.city, r.sales, d.quantity
    FROM regional r JOIN dataset d ON r.city = d.city`;
    const lineage = buildMetricLineage(sql, schema);
    expect(lineage.status).toBe("partial");
    expect(lineage.warnings.some((warning) => warning.includes("JOIN"))).toBe(true);
    // Only direct references that can be tied to the declared source schema are reported.
    expect(lineage.sourceColumns).toEqual(["city", "quantity", "revenue"]);
  });

  it("resolves relation-aware dependencies across registered joined schemas", () => {
    const active: LineageSchema = {
      table: "dataset",
      columns: [{ name: "customer_id", type: "INTEGER" }, { name: "order_total", type: "DECIMAL" }],
    };
    const registered: LineageSchema[] = [{
      table: "customers_physical",
      columns: [{ name: "customer_id", type: "INTEGER" }, { name: "customer_name", type: "VARCHAR" }],
    }];
    const lineage = buildMetricLineage(
      "SELECT d.customer_id AS order_customer_id, c.customer_id AS profile_customer_id FROM dataset d JOIN customers_physical c ON d.customer_id = c.customer_id",
      active,
      [],
      undefined,
      registered,
    );
    expect(lineage.status).toBe("partial");
    expect(lineage.outputColumns[0]?.sourceReferences).toEqual([
      { table: "dataset", column: "customer_id" },
    ]);
    expect(lineage.outputColumns[1]?.sourceReferences).toEqual([
      { table: "customers_physical", column: "customer_id" },
    ]);
    expect(lineage.sourceReferences).toEqual([
      { table: "customers_physical", column: "customer_id" },
      { table: "dataset", column: "customer_id" },
    ]);
  });

  it("keeps filter-only JOIN dependencies tied to their actual registered relations", () => {
    const active: LineageSchema = {
      table: "dataset",
      columns: [{ name: "customer_id", type: "INTEGER" }, { name: "order_total", type: "DECIMAL" }],
    };
    const registered: LineageSchema[] = [{
      table: "customers_physical",
      columns: [{ name: "customer_id", type: "INTEGER" }, { name: "country_code", type: "VARCHAR" }],
    }];
    const lineage = buildMetricLineage(
      "SELECT d.order_total FROM dataset d JOIN customers_physical c ON d.customer_id = c.customer_id WHERE c.country_code = 'GB'",
      active,
      [],
      undefined,
      registered,
    );
    expect(lineage.sourceReferences).toEqual([
      { table: "customers_physical", column: "country_code" },
      { table: "customers_physical", column: "customer_id" },
      { table: "dataset", column: "customer_id" },
      { table: "dataset", column: "order_total" },
    ]);
    expect(lineage.sourceReferences).not.toContain({ table: "dataset", column: "country_code" });
  });

  it("does not invent dependencies for unknown identifiers or expressions", () => {
    const lineage = buildMetricLineage("SELECT external_metric AS value FROM dataset", schema);
    expect(lineage.outputColumns[0]?.sourceColumns).toEqual([]);
    expect(lineage.status).toBe("partial");
    expect(lineage.warnings.some((warning) => warning.includes("لم يمكن ربط"))).toBe(true);
  });

  it("keeps literal-only output expressions complete without inventing source columns", () => {
    const lineage = buildMetricLineage("SELECT 42 AS answer FROM dataset", schema);
    expect(lineage.status).toBe("complete");
    expect(lineage.outputColumns[0]?.sourceColumns).toEqual([]);
    expect(lineage.warnings).toHaveLength(0);
  });

  it("marks OFFSET as incomplete result scope for Grain verification", () => {
    const lineage = buildMetricLineage("SELECT city FROM dataset ORDER BY city OFFSET 20", schema);
    expect(lineage.status).toBe("complete");
    expect(lineage.operations.map((operation) => operation.kind)).toContain("limit");
  });

  it("marks FETCH as incomplete result scope for Grain verification", () => {
    const lineage = buildMetricLineage("SELECT city FROM dataset ORDER BY city FETCH FIRST 10 ROWS ONLY", schema);
    expect(lineage.operations.map((operation) => operation.kind)).toContain("limit");
  });

  it("returns unsupported for malformed or non-SELECT SQL", () => {
    expect(buildMetricLineage("SELECT * FROM dataset /*", schema).status).toBe("unsupported");
    expect(buildMetricLineage("not sql", schema).status).toBe("unsupported");
  });

  it("includes applied non-destructive cleaning steps as upstream lineage", () => {
    const lineage = buildMetricLineage("SELECT city FROM dataset", schema, [{
      id: "trim-1",
      kind: "trim",
      label: "تنظيف النصوص",
      affectedRows: 12,
      params: { textColumns: ["city"] },
    }]);
    expect(lineage.operations[1]).toEqual(expect.objectContaining({
      kind: "cleaning",
      label: "تنظيف النصوص",
      detail: "الأعمدة: city",
    }));
  });

  it("does not treat function names, SQL keywords or output aliases as source columns", () => {
    const lineage = buildMetricLineage("SELECT COALESCE(city, 'Unknown') AS city_label FROM dataset", schema);
    expect(lineage.sourceColumns).toEqual(["city"]);
    expect(lineage.outputColumns[0]?.sourceColumns).toEqual(["city"]);
  });

  it("expands SELECT * only from the declared active-table schema", () => {
    const lineage = buildMetricLineage("SELECT * FROM dataset", schema);
    expect(lineage.outputColumns.map((column) => column.outputName)).toEqual([
      "city", "revenue", "quantity", "order_id", "created_at", 'region"name',
    ]);
    expect(lineage.sourceColumns).toEqual([
      "city", "created_at", 'region"name', "order_id", "quantity", "revenue",
    ].sort((a, b) => a.localeCompare(b)));
  });

  it("resolves UNION value lineage across both SELECT branches", () => {
    const lineage = buildMetricLineage(
      "SELECT city FROM dataset UNION ALL SELECT city FROM dataset",
      schema,
    );
    expect(lineage.status).toBe("complete");
    expect(lineage.sourceColumns).toEqual(["city"]);
    expect(lineage.outputColumns[0]).toMatchObject({
      outputName: "city",
      sourceColumns: ["city"],
      sourceReferences: [{ table: "dataset", column: "city" }],
    });
    expect(lineage.warnings.some((warning) => warning.includes("عملية مجموعات"))).toBe(false);
  });

  it("keeps INTERSECT row-membership lineage distinct in metric output", () => {
    const archive: LineageSchema = {
      table: "archive",
      columns: [{ name: "town", type: "VARCHAR" }],
    };
    const lineage = buildMetricLineage(
      "SELECT city FROM dataset INTERSECT SELECT town FROM archive",
      schema,
      [],
      undefined,
      [archive],
    );
    expect(lineage.status).toBe("complete");
    expect(lineage.outputColumns[0]).toMatchObject({
      sourceColumns: ["city"],
      rowFilterSourceColumns: ["town"],
      sourceReferences: [{ table: "dataset", column: "city" }],
      rowFilterSourceReferences: [{ table: "archive", column: "town" }],
    });
    expect(lineage.sourceReferences).toEqual([
      { table: "archive", column: "town" },
      { table: "dataset", column: "city" },
    ]);
  });

  it("recognizes quoted identifiers with escaped quotes", () => {
    const lineage = buildMetricLineage('SELECT "region""name" FROM dataset', schema);
    expect(lineage.sourceColumns).toEqual(['region"name']);
  });

  it("resolves CTE projections to their underlying source columns", () => {
    const lineage = buildMetricLineage(
      "WITH regional AS (SELECT city, revenue AS sales FROM dataset) SELECT regional.city, regional.sales FROM regional",
      schema,
    );
    expect(lineage.status).toBe("complete");
    expect(lineage.sourceColumns).toEqual(["city", "revenue"]);
    expect(lineage.outputColumns).toEqual([
      expect.objectContaining({ outputName: "city", sourceColumns: ["city"], sourceReferences: [{ table: "dataset", column: "city" }] }),
      expect.objectContaining({ outputName: "sales", sourceColumns: ["revenue"] }),
    ]);
  });

  it("resolves simple derived-table projections to their underlying source columns", () => {
    const lineage = buildMetricLineage(
      "SELECT q.city, q.sales FROM (SELECT city, revenue AS sales FROM dataset) AS q",
      schema,
    );
    expect(lineage.status).toBe("complete");
    expect(lineage.sourceColumns).toEqual(["city", "revenue"]);
    expect(lineage.outputColumns.map((column) => column.sourceColumns)).toEqual([["city"], ["revenue"]]);
  });

  it("carries filter-only dependencies through an integrated CTE lineage", () => {
    const lineage = buildMetricLineage(
      "WITH regional AS (SELECT city FROM dataset WHERE revenue > 100) SELECT regional.city FROM regional",
      schema,
    );
    expect(lineage.status).toBe("complete");
    expect(lineage.sourceColumns).toEqual(["city", "revenue"]);
    expect(lineage.outputColumns[0]?.sourceColumns).toEqual(["city"]);
  });
  it("exposes CASE value and condition dependencies in integrated metric lineage", () => {
    const lineage = buildMetricLineage(
      "SELECT CASE WHEN quantity > 0 THEN revenue ELSE order_id END AS adjusted_value FROM dataset",
      schema,
    );
    expect(lineage.status).toBe("complete");
    expect(lineage.sourceColumns).toEqual(["order_id", "quantity", "revenue"]);
    expect(lineage.outputColumns[0]).toMatchObject({
      outputName: "adjusted_value",
      sourceColumns: ["order_id", "quantity", "revenue"],
      valueSourceColumns: ["order_id", "revenue"],
      conditionSourceColumns: ["quantity"],
      valueSourceReferences: [
        { table: "dataset", column: "order_id" },
        { table: "dataset", column: "revenue" },
      ],
      conditionSourceReferences: [
        { table: "dataset", column: "quantity" },
      ],
    });
  });

});
