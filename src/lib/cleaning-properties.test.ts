// @vitest-environment node
/**
 * اختبارات خصائص (property-based) على محرك DuckDB الحقيقي لطبقة التنظيف:
 * مئات المجموعات العشوائية (بذرة ثابتة) تتحقق أن الخطوات لا تغيّر عدد الصفوف بصمت،
 * وأن تطبيقها مرتين يعطي النتيجة نفسها، وأنها لا تمسّ الأعمدة الأخرى.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildRelation,
  makeArabicStep,
  makeCastStep,
  makeDedupeStep,
  makeFillGroupStep,
  makeFillStep,
  makeMergeStep,
  makeTrimStep,
  makeWinsorStep,
  type CleanStep,
} from "./cleaning";

const require = createRequire(import.meta.url);
type Conn = { query: (sql: string) => { toArray: () => { toJSON: () => Record<string, unknown> }[] } };
let conn: Conn;
const q = (sql: string) => conn.query(sql).toArray().map((r) => r.toJSON());

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
}, 60_000);

/* مولّد عشوائي بذرة ثابتة */
function rng(seed: number) {
  let s = seed;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return {
    next,
    int: (a: number, b: number) => a + Math.floor(next() * (b - a + 1)),
    pick: <T,>(xs: T[]) => xs[Math.floor(next() * xs.length)]!,
  };
}

const COLS = ["id", "name", "score", "grp", "txtnum"];
const NAMES = ["أحمد", "احمد", " أحمد ", "سارة", "ساره", "سارة  ", "Ali", "ali ", "", "   ", "محمّد", "محمد"];
const GROUPS = ["أ", "ب", "ج", null];

function makeDataset(seed: number) {
  const r = rng(seed);
  const n = r.int(5, 60);
  const rows: string[] = [];
  for (let i = 1; i <= n; i++) {
    const name = r.next() < 0.1 ? "NULL" : `'${r.pick(NAMES)}'`;
    const score = r.next() < 0.2 ? "NULL" : r.next() < 0.05 ? String(r.int(500, 900)) : String(Math.round(r.next() * 1000) / 10);
    const g = r.pick(GROUPS);
    const txt = r.next() < 0.15 ? `'x${i}'` : r.next() < 0.1 ? "NULL" : `'${r.int(0, 999)}.${r.int(0, 9)}'`;
    rows.push(`(${i}, ${name}, ${score}, ${g === null ? "NULL" : `'${g}'`}, ${txt})`);
    // تكرار حرفي أحياناً لاختبار dedupe
    if (r.next() < 0.1) rows.push(`(${i}, ${name}, ${score}, ${g === null ? "NULL" : `'${g}'`}, ${txt})`);
  }
  conn.query("drop table if exists dataset__source");
  conn.query(
    "create table dataset__source(id int, name varchar, score double, grp varchar, txtnum varchar)",
  );
  conn.query(`insert into dataset__source values ${rows.join(",")}`);
  return { n: Number((q("select count(*) c from dataset__source")[0] as { c: bigint }).c) };
}

const rel = (steps: CleanStep[]) => buildRelation(steps)!;
const rowsOf = (steps: CleanStep[]) =>
  q(`select * from (${rel(steps)}) order by id, name nulls first, score nulls first, grp nulls first, txtnum nulls first`);
const count = (steps: CleanStep[]) => Number((q(`select count(*) c from (${rel(steps)})`)[0] as { c: bigint }).c);
const norm = (rows: Record<string, unknown>[]) => JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? Number(v) : v));

const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i * 37);

describe("cleaning properties (real DuckDB)", () => {
  it("every non-dedupe step keeps the row count and the column set", () => {
    for (const seed of SEEDS) {
      const { n } = makeDataset(seed);
      const steps: CleanStep[][] = [
        [makeTrimStep(COLS, ["name", "grp", "txtnum"])],
        [makeArabicStep(COLS, ["name", "grp"])],
        [makeCastStep(COLS, "txtnum", "DOUBLE")],
        [makeFillStep(COLS, "score", "DOUBLE", "50", 0)],
        [makeFillGroupStep(COLS, "score", "DOUBLE", "grp", 0)],
        [makeWinsorStep(COLS, "score", 10, 90, 0)],
        [makeMergeStep(COLS, "name", { canonical: "Ali", values: [{ value: "ali", count: 1 }, { value: "Ali", count: 1 }], affected: 0 })],
      ];
      for (const s of steps) {
        expect(count(s), `seed ${seed} ${s[0]!.kind}`).toBe(n);
        const cols = q(`select * from (${rel(s)}) limit 0`);
        expect(cols).toEqual([]);
        const names = (conn.query(`select * from (${rel(s)}) limit 1`) as unknown as { schema: { fields: { name: string }[] } }).schema.fields.map((f) => f.name);
        expect(names).toEqual(COLS);
      }
    }
  });

  it("random chains of steps never change the row count", () => {
    for (const seed of SEEDS) {
      const { n } = makeDataset(seed);
      const r = rng(seed + 1);
      const pool = [
        () => makeTrimStep(COLS, ["name", "grp", "txtnum"]),
        () => makeArabicStep(COLS, ["name", "grp"]),
        () => makeCastStep(COLS, "txtnum", "DOUBLE"),
        () => makeFillStep(COLS, "score", "DOUBLE", "50", 0),
        () => makeFillGroupStep(COLS, "score", "DOUBLE", "grp", 0),
        () => makeWinsorStep(COLS, "score", 10, 90, 0),
      ];
      const chain = Array.from({ length: r.int(2, 5) }, () => r.pick(pool)());
      expect(count(chain), `seed ${seed}`).toBe(n);
    }
  });

  it("dedupe removes exactly the duplicate rows and is idempotent", () => {
    for (const seed of SEEDS) {
      makeDataset(seed);
      const distinct = Number((q("select count(*) c from (select distinct * from dataset__source)")[0] as { c: bigint }).c);
      const once = [makeDedupeStep(0)];
      const twice = [makeDedupeStep(0), makeDedupeStep(0)];
      expect(count(once), `seed ${seed}`).toBe(distinct);
      expect(norm(rowsOf(twice))).toBe(norm(rowsOf(once)));
    }
  });

  it("trim / arabic / fill / fillgroup / winsor / cast are idempotent", () => {
    for (const seed of SEEDS) {
      makeDataset(seed);
      const mk: [string, () => CleanStep][] = [
        ["trim", () => makeTrimStep(COLS, ["name", "grp", "txtnum"])],
        ["arabic", () => makeArabicStep(COLS, ["name", "grp"])],
        ["cast", () => makeCastStep(COLS, "txtnum", "DOUBLE")],
        ["fill", () => makeFillStep(COLS, "score", "DOUBLE", "50", 0)],
        ["fillgroup", () => makeFillGroupStep(COLS, "score", "DOUBLE", "grp", 0)],
        ["winsor", () => makeWinsorStep(COLS, "score", 10, 90, 0)],
      ];
      for (const [kind, make] of mk) {
        const once = norm(rowsOf([make()]));
        const twice = norm(rowsOf([make(), make()]));
        expect(twice, `seed ${seed} ${kind}`).toBe(once);
      }
    }
  });

  it("column-specific steps leave every other column untouched", () => {
    for (const seed of SEEDS) {
      makeDataset(seed);
      const base = q("select id, name, grp, txtnum from dataset__source order by id, name nulls first, grp nulls first, txtnum nulls first");
      for (const s of [makeFillStep(COLS, "score", "DOUBLE", "50", 0), makeWinsorStep(COLS, "score", 10, 90, 0), makeFillGroupStep(COLS, "score", "DOUBLE", "grp", 0)]) {
        const after = q(`select id, name, grp, txtnum from (${rel([s])}) order by id, name nulls first, grp nulls first, txtnum nulls first`);
        expect(norm(after), `seed ${seed} ${s.kind}`).toBe(norm(base));
      }
    }
  });

  it("winsor: values end inside the bounds; values already inside and NULLs are unchanged", () => {
    for (const seed of SEEDS) {
      makeDataset(seed);
      const bad = q(`select count(*) c from (${rel([makeWinsorStep(COLS, "score", 10, 90, 0)])}) where score < 10 or score > 90`)[0] as { c: bigint };
      expect(Number(bad.c), `seed ${seed}`).toBe(0);
      const changed = q(`select count(*) c from dataset__source s join (${rel([makeWinsorStep(COLS, "score", 10, 90, 0)])}) w using (id, name, grp, txtnum) where s.score between 10 and 90 and s.score is distinct from w.score`)[0] as { c: bigint };
      expect(Number(changed.c), `seed ${seed}`).toBe(0);
      const nulls = (n: string) => Number((q(`select count(*) c from ${n} where score is null`)[0] as { c: bigint }).c);
      expect(nulls(`(${rel([makeWinsorStep(COLS, "score", 10, 90, 0)])})`)).toBe(nulls("dataset__source"));
    }
  });

  it("fill: no blank left in the target and existing values are preserved", () => {
    for (const seed of SEEDS) {
      makeDataset(seed);
      const r = rel([makeFillStep(COLS, "score", "DOUBLE", "50", 0)]);
      expect(Number((q(`select count(*) c from (${r}) where score is null`)[0] as { c: bigint }).c), `seed ${seed}`).toBe(0);
      const changed = q(`select count(*) c from dataset__source s join (${r}) f using (id, name, grp, txtnum) where s.score is not null and s.score is distinct from f.score`)[0] as { c: bigint };
      expect(Number(changed.c)).toBe(0);
    }
  });

  it("fillgroup: fills only NULLs, from the group's median (or the global median)", () => {
    for (const seed of SEEDS) {
      makeDataset(seed);
      const r = rel([makeFillGroupStep(COLS, "score", "DOUBLE", "grp", 0)]);
      const nonNull = Number((q("select count(score) c from dataset__source")[0] as { c: bigint }).c);
      const left = Number((q(`select count(*) c from (${r}) where score is null`)[0] as { c: bigint }).c);
      if (nonNull > 0) expect(left, `seed ${seed}`).toBe(0);
      const changed = q(`select count(*) c from dataset__source s join (${r}) f using (id, name, grp, txtnum) where s.score is not null and s.score is distinct from f.score`)[0] as { c: bigint };
      expect(Number(changed.c)).toBe(0);
      // كل قيمة مملوءة تساوي وسيط مجموعتها (أو الوسيط العام عند غياب المجموعة)
      const wrong = q(`
        with m as (select grp, median(score) med from dataset__source group by grp),
             g as (select median(score) gm from dataset__source)
        select count(*) c from dataset__source s
        join (${r}) f using (id, name, grp, txtnum)
        left join m on m.grp is not distinct from s.grp cross join g
        where s.score is null and f.score is distinct from coalesce(m.med, g.gm)`)[0] as { c: bigint };
      expect(Number(wrong.c), `seed ${seed}`).toBe(0);
    }
  });

  it("trim: no leading/trailing/double whitespace and no empty strings remain", () => {
    for (const seed of SEEDS) {
      makeDataset(seed);
      const r = rel([makeTrimStep(COLS, ["name", "grp", "txtnum"])]);
      const bad = q(`select count(*) c from (${r}) where name <> trim(name) or name = '' or name like '%  %' or grp = ''`)[0] as { c: bigint };
      expect(Number(bad.c), `seed ${seed}`).toBe(0);
    }
  });
});
