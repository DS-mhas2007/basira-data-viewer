// @vitest-environment node
/**
 * اختبار تكامل على محرك DuckDB-WASM نفسه (نسخة Node): يتحقق أن SQL المولَّد
 * (KNN، تواريخ نصية، وسيط المجموعة) يعمل فعلاً على نفس إصدار المحرك في المتصفح.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { buildKnnWorkSql } from "./knn-impute";
import { buildSql, defaultConfig } from "./chart-studio";
import { columnExpr, makeFillGroupStep } from "./cleaning";
import {
  buildJoinDiagnosticsSql,
  buildJoinTreeDiagnosticsSql,
  buildOutputFingerprintQuery,
  classifyJoinRelationship,
  type ColumnSchema,
  type TableInfo,
} from "./duckdb-service";
import { finalizeDatasetOutputFingerprint } from "./dataset-output-fingerprint";
import { buildCompositeKeyProfileSql, buildGrainProbeSql, buildKeyProfileSql } from "./grain-detector";

const require = createRequire(import.meta.url);

type Conn = { query: (sql: string) => { toArray: () => { toJSON: () => Record<string, unknown> }[] } };
let conn: Conn;
const q = (sql: string) => conn.query(sql).toArray().map((r) => {
  const row = r.toJSON();
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "bigint" ? Number(value) : value]));
});

beforeAll(async () => {
  vi.stubGlobal("crypto", webcrypto);
  const dist = path.dirname(require.resolve("@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs"));
  const duckdb = require("@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs");
  const db = await duckdb.createDuckDB(
    {
      mvp: { mainModule: path.join(dist, "duckdb-mvp.wasm"), mainWorker: path.join(dist, "duckdb-node-mvp.worker.cjs") },
      eh: { mainModule: path.join(dist, "duckdb-eh.wasm"), mainWorker: path.join(dist, "duckdb-node-eh.worker.cjs") },
    },
    new duckdb.VoidLogger(),
    duckdb.NODE_RUNTIME,
  );
  await db.instantiate(() => undefined);
  conn = db.connect();
}, 60_000);

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("generated SQL on the real engine", () => {
  it("KNN imputes every recipient and keeps the row count", () => {
    conn.query("create table src(__rid bigint, id int, age double, income double, score double)");
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const rows: string[] = [];
    for (let i = 1; i <= 400; i++) {
      const age = 20 + rnd() * 40;
      const score = rnd() * 100;
      const income = 1000 + age * 100 + score * 20;
      rows.push(`(${i},${i},${age},${i % 10 === 0 ? "NULL" : income},${score})`);
    }
    conn.query(`insert into src values ${rows.join(",")}`);
    const sql = buildKnnWorkSql(
      { allColumns: ["id", "age", "income", "score"], column: "income", columnType: "DOUBLE", features: ["age", "score"], k: 5 },
      "src",
      "work",
    );
    conn.query(sql);
    const r = q("select count(*)::int n, sum(case when __imp then 1 else 0 end)::int imp, sum(case when income is null then 1 else 0 end)::int still from work")[0]!;
    expect(r["n"]).toBe(400);
    expect(r["imp"]).toBe(40);
    expect(r["still"]).toBe(0);
  });

  it("aggregates several rows per day for text dates", () => {
    conn.query("create table txt(d varchar, v double)");
    conn.query("insert into txt values ('0:00 7/4/2012',10),('0:00 7/4/2012',5),('0:00 8/15/2012',7),('bad',1)");
    const info = { table: "txt", rowCount: 4, schema: [{ name: "d", type: "VARCHAR" }, { name: "v", type: "DOUBLE" }] } as unknown as TableInfo;
    const sql = buildSql(info, {
      ...defaultConfig(info),
      x: "d",
      y: "v",
      kind: "line",
      agg: "SUM",
      bucket: "day",
      dateFormat: "%H:%M %m/%d/%Y",
      sort: "label_asc",
      limit: 0,
    });
    expect(q(sql)).toEqual([
      { label: "2012-07-04", value: 15 },
      { label: "2012-08-15", value: 7 },
    ]);
  });

  it("group-median fill falls back to the global median", () => {
    conn.query("create table g(dept varchar, sal double)");
    conn.query("insert into g values ('a',10),('a',20),('a',NULL),('b',100),('b',NULL),(NULL,NULL),(NULL,50)");
    const step = makeFillGroupStep(["dept", "sal"], "sal", "DOUBLE", "dept", 3);
    const rows = q(`SELECT "dept", ${columnExpr(step, "sal")} AS "sal" FROM (SELECT * FROM g) _s`);
    const filled = rows.map((r) => r["sal"]);
    expect(filled).toContain(15); // وسيط المجموعة a
    expect(filled.filter((v) => v === null)).toHaveLength(0);
  });
});

describe("output provenance fingerprinting on the real DuckDB engine", () => {
  it("binds schema and row count while ignoring row order and preserving NULLs and duplicate multiplicity", async () => {
    const schema: ColumnSchema[] = [
      { name: "id", type: "INTEGER" },
      { name: "day", type: "DATE" },
      { name: "created_at", type: "TIMESTAMP WITH TIME ZONE" },
      { name: "amount", type: "DOUBLE" },
    ];
    conn.query("CREATE TABLE provenance_a(id INTEGER, day DATE, created_at TIMESTAMPTZ, amount DOUBLE)");
    conn.query("CREATE TABLE provenance_b(id INTEGER, day DATE, created_at TIMESTAMPTZ, amount DOUBLE)");
    conn.query(`INSERT INTO provenance_a VALUES
      (1, DATE '2026-11-25', TIMESTAMPTZ '2026-11-25 10:30:00+00', NULL),
      (1, DATE '2026-11-25', TIMESTAMPTZ '2026-11-25 10:30:00+00', NULL),
      (2, DATE '2026-11-26', TIMESTAMPTZ '2026-11-26 10:30:00+00', 1.5)`);
    conn.query(`INSERT INTO provenance_b VALUES
      (2, DATE '2026-11-26', TIMESTAMPTZ '2026-11-26 10:30:00+00', 1.5),
      (1, DATE '2026-11-25', TIMESTAMPTZ '2026-11-25 10:30:00+00', NULL),
      (1, DATE '2026-11-25', TIMESTAMPTZ '2026-11-25 10:30:00+00', NULL)`);

    const evidence = (table: string) => q(buildOutputFingerprintQuery(table, schema));
    const rowsA = evidence("provenance_a");
    const rowsB = evidence("provenance_b");
    expect(rowsA[0]?.["total_rows"]).toBe("3");
    expect(rowsA[0]?.["non_finite_count"]).toBe("0");
    expect(rowsA.map((row) => row["chunk_digest"])).toEqual(rowsB.map((row) => row["chunk_digest"]));

    const chunks = rowsA.flatMap((row) =>
      typeof row["chunk_digest"] === "string" ? [row["chunk_digest"]] : [],
    );
    const fingerprint = await finalizeDatasetOutputFingerprint(schema, "3", chunks);

    conn.query("CREATE TABLE provenance_dedup(id INTEGER, day DATE, created_at TIMESTAMPTZ, amount DOUBLE)");
    conn.query(`INSERT INTO provenance_dedup VALUES
      (1, DATE '2026-11-25', TIMESTAMPTZ '2026-11-25 10:30:00+00', NULL),
      (2, DATE '2026-11-26', TIMESTAMPTZ '2026-11-26 10:30:00+00', 1.5)`);
    const dedupRows = evidence("provenance_dedup");
    const dedupChunks = dedupRows.flatMap((row) =>
      typeof row["chunk_digest"] === "string" ? [row["chunk_digest"]] : [],
    );
    expect(await finalizeDatasetOutputFingerprint(schema, "2", dedupChunks)).not.toBe(fingerprint);

    conn.query("CREATE TABLE provenance_empty(id INTEGER, day DATE, created_at TIMESTAMPTZ, amount DOUBLE)");
    const emptyEvidence = evidence("provenance_empty");
    expect(emptyEvidence[0]?.["total_rows"]).toBe("0");
    expect(emptyEvidence[0]?.["chunk_digest"]).toBeNull();
    expect(await finalizeDatasetOutputFingerprint(schema, "0", [])).toMatch(/^output-v1:sha256:/);
  });
});

import { buildOutlierCountSql, buildQuartilesSql, iqrBounds } from "./outliers";
import { makeWinsorStep } from "./cleaning";

describe("outliers on the real engine", () => {
  it("detects IQR outliers and winsor clips them to the bounds", () => {
    conn.query("create table o(x double)");
    const vals = [...Array.from({ length: 50 }, (_, i) => 10 + (i % 10)), 500];
    conn.query(`insert into o values ${vals.map((v) => `(${v})`).join(",")}`);
    const qr = q(buildQuartilesSql("SELECT * FROM o", ["x"]))[0]!;
    const b = iqrBounds(Number(qr["q1_0"]), Number(qr["q3_0"]))!;
    const cr = q(buildOutlierCountSql("SELECT * FROM o", [{ column: "x", ...b }]))[0]!;
    expect(Number(cr["o_0"])).toBe(1);
    const step = makeWinsorStep(["x"], "x", b.lower, b.upper, 1);
    const max = q(`SELECT max(${columnExpr(step, "x")}) AS m FROM o`)[0]!["m"] as number;
    expect(max).toBeCloseTo(b.upper, 6);
  });

  it("returns null bounds for a constant column", () => {
    expect(iqrBounds(5, 5)).toBeNull();
  });
});

import { buildKnnInlineSql } from "./knn-impute";
import { estimatedValuesNote, lineageLog } from "./report-derive";
import { makeKnnStep } from "./cleaning";

describe("export and report", () => {
  it("inline KNN SQL (for code export) runs standalone and imputes", () => {
    conn.query("create table inl(a double, b double, c double)");
    const rows: string[] = [];
    for (let i = 1; i <= 200; i++) rows.push(`(${i},${i * 2 + (i % 7)},${i % 10 === 0 ? "NULL" : i * 3})`);
    conn.query(`insert into inl values ${rows.join(",")}`);
    const sql = buildKnnInlineSql(
      { allColumns: ["a", "b", "c"], column: "c", columnType: "DOUBLE", features: ["a", "b"], k: 3 },
      "SELECT * FROM inl",
    );
    const r = q(`SELECT count(*)::int n, sum(CASE WHEN c IS NULL THEN 1 ELSE 0 END)::int missing FROM (${sql}) t`)[0]!;
    expect(r["n"]).toBe(200);
    expect(r["missing"]).toBe(0);
  });

  it("reports flag estimated values and name step kinds in Arabic", () => {
    const step = makeKnnStep(["a", "c"], "c", "DOUBLE", ["a"], 5, 20);
    expect(estimatedValuesNote([step])).toContain("تقديرات");
    expect(estimatedValuesNote([])).toBeNull();
    expect(lineageLog([step])[0]!.detail).toContain("الجيران الأقرب");
  });
});


describe("JOIN diagnostics on the real DuckDB engine", () => {
  it("computes exact INNER/LEFT/RIGHT/FULL row counts from key frequencies", () => {
    conn.query("CREATE TABLE join_diag_left(k VARCHAR, v INTEGER)");
    conn.query("CREATE TABLE join_diag_right(k VARCHAR, label VARCHAR)");
    conn.query("INSERT INTO join_diag_left VALUES ('A',1),('A',2),('B',3),('orphan',4),('orphan',5),(NULL,6)");
    conn.query("INSERT INTO join_diag_right VALUES ('A','a'),('B','b1'),('B','b2'),('other','x1'),('other','x2'),(NULL,'n')");

    const profile = (joinType: "inner" | "left" | "right" | "full") =>
      q(buildJoinDiagnosticsSql("join_diag_left", "join_diag_right", "k", "k", joinType))[0]!;

    const inner = profile("inner");
    expect(Number(inner["left_rows"])).toBe(6);
    expect(Number(inner["right_rows"])).toBe(6);
    expect(Number(inner["matched_key_groups"])).toBe(2);
    expect(Number(inner["left_duplicate_groups"])).toBe(1);
    expect(Number(inner["right_duplicate_groups"])).toBe(1);
    expect(Number(inner["left_max_frequency"])).toBe(2);
    expect(Number(inner["right_max_frequency"])).toBe(2);
    expect(Number(inner["matched_left_rows"])).toBe(3);
    expect(Number(inner["matched_right_rows"])).toBe(3);
    expect(Number(inner["joined_rows"])).toBe(4);
    expect(classifyJoinRelationship(Number(inner["left_max_frequency"]), Number(inner["right_max_frequency"]))).toBe("many-to-many");

    const left = profile("left");
    const right = profile("right");
    const full = profile("full");
    expect(Number(left["joined_rows"])).toBe(7);
    expect(Number(right["joined_rows"])).toBe(7);
    expect(Number(full["joined_rows"])).toBe(10);
    expect(Number(left["left_rows"]) - Number(left["matched_left_rows"])).toBe(3);
    expect(Number(left["right_rows"]) - Number(left["matched_right_rows"])).toBe(3);
    expect(Number(right["left_rows"]) - Number(right["matched_left_rows"])).toBe(3);
    expect(Number(right["right_rows"]) - Number(right["matched_right_rows"])).toBe(3);
    expect(Number(full["left_rows"]) - Number(full["matched_left_rows"])).toBe(3);
    expect(Number(full["right_rows"]) - Number(full["matched_right_rows"])).toBe(3);
  });

  it("profiles a chained JOIN using the actual intermediate left-input rows", () => {
    conn.query("CREATE TABLE join_tree_left(mid_id INTEGER)");
    conn.query("CREATE TABLE join_tree_mid(id INTEGER, region_id INTEGER)");
    conn.query("CREATE TABLE join_tree_right(id INTEGER)");
    conn.query("INSERT INTO join_tree_left VALUES (10),(10),(11),(12),(99)");
    conn.query("INSERT INTO join_tree_mid VALUES (10,1),(11,1),(12,2)");
    conn.query("INSERT INTO join_tree_right VALUES (1),(1),(2),(3)");

    const sql = buildJoinTreeDiagnosticsSql(
      'FROM "join_tree_left" AS "a" INNER JOIN "join_tree_mid" AS "b" ON a.mid_id = b.id',
      "join_tree_right",
      "r",
      ['"b"."region_id"'],
      ["id"],
      "left",
    );
    const result = q(sql)[0]!;
    expect(Number(result["left_rows"])).toBe(4);
    expect(Number(result["right_rows"])).toBe(4);
    expect(Number(result["matched_left_rows"])).toBe(4);
    expect(Number(result["matched_right_rows"])).toBe(3);
    expect(Number(result["left_max_frequency"])).toBe(3);
    expect(Number(result["right_max_frequency"])).toBe(2);
    expect(Number(result["joined_rows"])).toBe(7);
    expect(classifyJoinRelationship(Number(result["left_max_frequency"]), Number(result["right_max_frequency"]))).toBe("many-to-many");
  });

  it("validates chained LEFT/RIGHT/FULL JOIN counts and unmatched rows against the intermediate input", () => {
    conn.query("CREATE TABLE join_outer_tree_a(id INTEGER)");
    conn.query("CREATE TABLE join_outer_tree_b(a_id INTEGER, join_key INTEGER)");
    conn.query("CREATE TABLE join_outer_tree_c(join_key INTEGER)");
    conn.query("INSERT INTO join_outer_tree_a VALUES (1),(2),(3),(4)");
    conn.query("INSERT INTO join_outer_tree_b VALUES (1,10),(2,10),(3,20),(4,30)");
    conn.query("INSERT INTO join_outer_tree_c VALUES (10),(10),(20),(99)");

    const leftInput =
      'FROM "join_outer_tree_a" AS "a" INNER JOIN "join_outer_tree_b" AS "b" ON a.id = b.a_id';
    const expected = {
      inner: { joinedRows: 5, unmatchedLeft: 1, unmatchedRight: 1 },
      left: { joinedRows: 6, unmatchedLeft: 1, unmatchedRight: 1 },
      right: { joinedRows: 6, unmatchedLeft: 1, unmatchedRight: 1 },
      full: { joinedRows: 7, unmatchedLeft: 1, unmatchedRight: 1 },
    } as const;

    for (const joinType of ["inner", "left", "right", "full"] as const) {
      const result = q(buildJoinTreeDiagnosticsSql(
        leftInput,
        "join_outer_tree_c",
        "c",
        ['"b"."join_key"'],
        ["join_key"],
        joinType,
      ))[0]!;

      expect(Number(result["left_rows"]), joinType).toBe(4);
      expect(Number(result["right_rows"]), joinType).toBe(4);
      expect(Number(result["matched_left_rows"]), joinType).toBe(3);
      expect(Number(result["matched_right_rows"]), joinType).toBe(3);
      expect(Number(result["left_rows"]) - Number(result["matched_left_rows"]), joinType)
        .toBe(expected[joinType].unmatchedLeft);
      expect(Number(result["right_rows"]) - Number(result["matched_right_rows"]), joinType)
        .toBe(expected[joinType].unmatchedRight);
      expect(Number(result["joined_rows"]), joinType).toBe(expected[joinType].joinedRows);
    }
  });

  it("profiles composite keys spanning two aliases in the intermediate left tree", () => {
    conn.query("CREATE TABLE join_tree_multi_a(id INTEGER, k1 VARCHAR)");
    conn.query("CREATE TABLE join_tree_multi_b(a_id INTEGER, k2 INTEGER)");
    conn.query("CREATE TABLE join_tree_multi_right(k1 VARCHAR, k2 INTEGER)");
    conn.query("INSERT INTO join_tree_multi_a VALUES (1,'x'),(2,'x'),(3,'y')");
    conn.query("INSERT INTO join_tree_multi_b VALUES (1,10),(2,10),(3,20)");
    conn.query("INSERT INTO join_tree_multi_right VALUES ('x',10),('y',20),('x',99)");

    const sql = buildJoinTreeDiagnosticsSql(
      'FROM "join_tree_multi_a" AS "a" INNER JOIN "join_tree_multi_b" AS "b" ON a.id = b.a_id',
      "join_tree_multi_right",
      "r",
      ['"a"."k1"', '"b"."k2"'],
      ["k1", "k2"],
      "inner",
    );
    const result = q(sql)[0]!;
    expect(Number(result["left_rows"])).toBe(3);
    expect(Number(result["right_rows"])).toBe(3);
    expect(Number(result["matched_left_rows"])).toBe(3);
    expect(Number(result["matched_right_rows"])).toBe(2);
    expect(Number(result["joined_rows"])).toBe(3);
    expect(Number(result["left_max_frequency"])).toBe(2);
    expect(Number(result["right_max_frequency"])).toBe(1);
    expect(classifyJoinRelationship(Number(result["left_max_frequency"]), Number(result["right_max_frequency"]))).toBe("many-to-one");
  });

  it("excludes NULL composite keys in chained intermediate JOIN diagnostics", () => {
    conn.query("CREATE TABLE join_tree_null_a(id INTEGER, region VARCHAR)");
    conn.query("CREATE TABLE join_tree_null_b(a_id INTEGER, join_key INTEGER)");
    conn.query("CREATE TABLE join_tree_null_c(region VARCHAR, join_key INTEGER)");
    conn.query("INSERT INTO join_tree_null_a VALUES (1,'x'),(2,'x'),(3,'y'),(4,'z'),(5,'q')");
    conn.query("INSERT INTO join_tree_null_b VALUES (1,10),(2,10),(3,20),(4,30),(5,NULL)");
    conn.query("INSERT INTO join_tree_null_c VALUES ('x',10),('x',10),('y',20),('w',99),('q',NULL)");

    const leftInput =
      'FROM "join_tree_null_a" AS "a" INNER JOIN "join_tree_null_b" AS "b" ON a.id = b.a_id';
    const expected = {
      inner: 5,
      left: 7,
      right: 7,
      full: 9,
    } as const;

    for (const joinType of ["inner", "left", "right", "full"] as const) {
      const result = q(buildJoinTreeDiagnosticsSql(
        leftInput,
        "join_tree_null_c",
        "c",
        ['"a"."region"', '"b"."join_key"'],
        ["region", "join_key"],
        joinType,
      ))[0]!;

      expect(Number(result["left_rows"]), joinType).toBe(5);
      expect(Number(result["right_rows"]), joinType).toBe(5);
      expect(Number(result["matched_key_groups"]), joinType).toBe(2);
      expect(Number(result["matched_left_rows"]), joinType).toBe(3);
      expect(Number(result["matched_right_rows"]), joinType).toBe(3);
      expect(Number(result["left_max_frequency"]), joinType).toBe(2);
      expect(Number(result["right_max_frequency"]), joinType).toBe(2);
      expect(Number(result["joined_rows"]), joinType).toBe(expected[joinType]);
    }
  });

  it("does not treat disjoint or NULL-only keys as matches", () => {
    conn.query("CREATE TABLE join_no_match_left(k INTEGER)");
    conn.query("CREATE TABLE join_no_match_right(k INTEGER)");
    conn.query("INSERT INTO join_no_match_left VALUES (1),(2),(NULL)");
    conn.query("INSERT INTO join_no_match_right VALUES (3),(4),(NULL)");
    const result = q(buildJoinDiagnosticsSql("join_no_match_left", "join_no_match_right", "k", "k", "inner"))[0]!;
    expect(Number(result["matched_key_groups"])).toBe(0);
    expect(Number(result["joined_rows"])).toBe(0);
    expect(classifyJoinRelationship(Number(result["left_max_frequency"]), Number(result["right_max_frequency"]))).toBe("no-match");
  });
});

describe("grain diagnostics on the real DuckDB engine", () => {
  it("preserves high-precision DECIMAL differences when checking measure stability", () => {
    conn.query('CREATE TABLE grain_decimal_precision("Entity" VARCHAR, "InvoiceTotal" DECIMAL(38,20))');
    conn.query(`INSERT INTO grain_decimal_precision VALUES
      ('A', 0.12345678901234567890),
      ('A', 0.12345678901234567891),
      ('B', 0.22345678901234567890),
      ('B', 0.22345678901234567891)`);
    const sql = buildGrainProbeSql("grain_decimal_precision", [
      { name: "Entity", type: "VARCHAR" },
      { name: "InvoiceTotal", type: "DECIMAL(38,20)" },
    ], ["Entity"]);
    expect(sql).not.toBeNull();
    const result = q(sql!).find((row) => row["measure_column"] === "InvoiceTotal");
    expect(result?.["repeated_groups"]).toBe(2);
    expect(result?.["stable_groups"]).toBe(0);
    expect(result?.["variable_groups"]).toBe(2);
  });

  it("executes structural, composite-key, and repeated-measure probes", () => {
    conn.query('CREATE TABLE grain_runtime("Branch" VARCHAR, "Account" VARCHAR, "InvoiceTotal" DECIMAL(12,2), "LineAmount" DOUBLE)');
    conn.query(`INSERT INTO grain_runtime VALUES
      ('north','001',100,40),('north','001',100,60),
      ('north','002',80,30),('north','002',80,50),
      ('south','001',120,70),('south','001',120,50),
      ('south','002',90,45),('south','002',90,45)`);

    const schema = [
      { name: "Branch", type: "VARCHAR" },
      { name: "Account", type: "VARCHAR" },
      { name: "InvoiceTotal", type: "DECIMAL(12,2)" },
      { name: "LineAmount", type: "DOUBLE" },
    ];

    const keyProfileSql = buildKeyProfileSql("grain_runtime", schema);
    expect(keyProfileSql).not.toBeNull();
    expect(q(keyProfileSql!)).toHaveLength(2);

    const compositeProfileSql = buildCompositeKeyProfileSql(
      "grain_runtime",
      schema,
      ["Branch", "Account"],
    );
    expect(compositeProfileSql).not.toBeNull();
    const compositeProfiles = q(compositeProfileSql!);
    expect(compositeProfiles).toHaveLength(1);
    expect(compositeProfiles[0]?.["distinct_values"]).toBe(4);

    const grainSql = buildGrainProbeSql(
      "grain_runtime",
      schema,
      [],
      [["Branch", "Account"]],
    );
    expect(grainSql).not.toBeNull();
    const findings = q(grainSql!);
    const invoice = findings.find((row) => row["measure_column"] === "InvoiceTotal");
    const line = findings.find((row) => row["measure_column"] === "LineAmount");

    expect(invoice?.["repeated_groups"]).toBe(4);
    expect(invoice?.["stable_groups"]).toBe(4);
    expect(invoice?.["variable_groups"]).toBe(0);
    expect(line?.["repeated_groups"]).toBe(4);
    expect(line?.["stable_groups"]).toBe(1);
    expect(line?.["variable_groups"]).toBe(3);
  });
});



describe("outer JOIN trees as inputs to later JOIN diagnostics", () => {
  it("measures the real FULL OUTER JOIN intermediate input before a later JOIN", () => {
    conn.query("CREATE TABLE join_mixed_outer_a(shared_key INTEGER, left_value VARCHAR)");
    conn.query("CREATE TABLE join_mixed_outer_b(shared_key INTEGER, next_key INTEGER)");
    conn.query("CREATE TABLE join_mixed_outer_c(join_key INTEGER)");
    conn.query("INSERT INTO join_mixed_outer_a VALUES (1,'matched'),(2,'left-only')");
    conn.query("INSERT INTO join_mixed_outer_b VALUES (1,10),(3,30),(4,NULL)");
    conn.query("INSERT INTO join_mixed_outer_c VALUES (10),(30),(99)");

    const leftInput =
      'FROM "join_mixed_outer_a" AS "a" FULL OUTER JOIN "join_mixed_outer_b" AS "b" USING ("shared_key")';
    const inner = q(buildJoinTreeDiagnosticsSql(
      leftInput,
      "join_mixed_outer_c",
      "c",
      ['"b"."next_key"'],
      ["join_key"],
      "inner",
    ))[0]!;
    const left = q(buildJoinTreeDiagnosticsSql(
      leftInput,
      "join_mixed_outer_c",
      "c",
      ['"b"."next_key"'],
      ["join_key"],
      "left",
    ))[0]!;
    const full = q(buildJoinTreeDiagnosticsSql(
      leftInput,
      "join_mixed_outer_c",
      "c",
      ['"b"."next_key"'],
      ["join_key"],
      "full",
    ))[0]!;

    // FULL OUTER JOIN produces two matched/unmatched left-side rows plus two right-only rows.
    expect(Number(inner["left_rows"])).toBe(4);
    expect(Number(inner["right_rows"])).toBe(3);
    expect(Number(inner["matched_left_rows"])).toBe(2);
    expect(Number(inner["matched_right_rows"])).toBe(2);
    expect(Number(inner["joined_rows"])).toBe(2);
    expect(Number(left["joined_rows"])).toBe(4);
    expect(Number(full["joined_rows"])).toBe(5);
  });
});
