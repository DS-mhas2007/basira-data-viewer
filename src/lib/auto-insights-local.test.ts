// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildLocalPlans } from "./auto-insights";
import { validateQuery } from "./sql-validator";

const require = createRequire(import.meta.url);
type Conn = { query: (sql: string) => { toArray: () => { toJSON: () => Record<string, unknown> }[] } };
let conn: Conn;

beforeAll(async () => {
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
  conn.query(`create table "dataset" as select i AS id, 'emp ' || i AS name,
    (['HR','IT','Ops','Fin','Mkt'])[1 + i % 5] AS "القسم", (['غزة','نابلس'])[1 + i % 2] AS city,
    (['A','B','C'])[1 + i % 3] AS grade, 1000 + i * 7 AS salary, DATE '2024-01-01' + CAST(i AS INTEGER) AS hired from range(1, 200) t(i)`);
}, 60_000);

describe("local (no-AI) report insights", () => {
  const info = {
    table: "dataset",
    rowCount: 199,
    schema: [
      { name: "id", type: "BIGINT" }, { name: "name", type: "VARCHAR" }, { name: "القسم", type: "VARCHAR" },
      { name: "city", type: "VARCHAR" }, { name: "grade", type: "VARCHAR" }, { name: "salary", type: "BIGINT" },
      { name: "hired", type: "DATE" },
    ],
  } as never;
  const plans = buildLocalPlans(info, { measures: ["salary"], cats: ["القسم", "city", "grade"], dateCol: "hired" });

  it("builds summary, ranking, trend, compare and distribution plans", () => {
    expect(plans.map((p) => p.intent)).toEqual(["summary", "ranking", "trend", "compare", "distribution"]);
  });

  it.each(plans.map((p) => [p.intent, p] as const))("%s: SQL passes the validator and returns rows", (_i, plan) => {
    const v = validateQuery(plan.sql, { tables: { dataset: ["id", "name", "القسم", "city", "grade", "salary", "hired"] } });
    expect(v.isValid, v.rejectionReason).toBe(true);
    const rows = conn.query(plan.sql).toArray();
    expect(rows.length).toBeGreaterThan(0);
  });

  it("no measure and no category → no plans; category only → distribution", () => {
    expect(buildLocalPlans(info, { measures: [], cats: [], dateCol: undefined })).toEqual([]);
    expect(buildLocalPlans(info, { measures: [], cats: ["city"], dateCol: undefined }).map((p) => p.intent)).toEqual(["distribution"]);
  });
});
