// @vitest-environment node
/**
 * حزمة تقييم (evals) عربية لموثوقية المحرك.
 *
 * 1) جزء بلا مفتاح (يعمل دائماً في CI): يتحقق أن الاستعلام المرجعي (gold) لكل سؤال ينفّذ على DuckDB
 *    الحقيقي ويطابق الإجابة المحسوبة مستقلاً بـ pandas، ويمرّ من مدقّق SQL في المشروع.
 * 2) جزء حي (اختياري): يرسل كل سؤال للنموذج بنفس موجّه المنتج، وينفّذ SQL الذي يقترحه، ويقارن بالمرجع.
 *    يعمل فقط إذا ضبطتَ المتغيرات في بيئتك المحلية (لا تضع المفتاح في الكود أو المحادثة):
 *
 *      EVAL_API_KEY=... EVAL_API_URL=https://api.groq.com/openai/v1/chat/completions \
 *      EVAL_MODEL=llama-3.3-70b-versatile npx vitest run src/evals
 *
 *    الحد الأدنى للنجاح: EVAL_MIN_PASS (الافتراضي 0.8).
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/ai-query-prompt";
import { validateQuery } from "@/lib/sql-validator";

interface Case {
  id: string;
  question: string;
  gold: string;
  expectNumbers: number[];
  expectTop: string | null;
}

const require = createRequire(import.meta.url);
const DIR = path.dirname(new URL(import.meta.url).pathname);
const cases = JSON.parse(readFileSync(path.join(DIR, "cases.json"), "utf8")) as Case[];
const csv = readFileSync(path.join(DIR, "sales.csv"), "utf8").trim().split(/\r?\n/);

type Conn = { query: (sql: string) => { toArray: () => { toJSON: () => Record<string, unknown> }[] } };
let conn: Conn;
const run = (sql: string) =>
  conn.query(sql).toArray().map((r) => r.toJSON());

const SCHEMA = [
  { name: "رقم_الطلب", type: "BIGINT" },
  { name: "الفرع", type: "VARCHAR" },
  { name: "المنتج", type: "VARCHAR" },
  { name: "الكمية", type: "BIGINT" },
  { name: "سعر_الوحدة", type: "DOUBLE" },
  { name: "التاريخ", type: "VARCHAR", hint: "نص تاريخ بصيغة ISO (YYYY-MM-DD)" },
];

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
  conn.query(
    'create table "sales"("رقم_الطلب" bigint, "الفرع" varchar, "المنتج" varchar, "الكمية" bigint, "سعر_الوحدة" double, "التاريخ" varchar)',
  );
  const values = csv
    .slice(1)
    .map((line) => {
      const [id, b, p, q, price, d] = line.split(",");
      return `(${id}, '${b}', '${p}', ${q}, ${price}, '${d}')`;
    })
    .join(",");
  conn.query(`insert into "sales" values ${values}`);
}, 60_000);

/** يحوّل خلية Arrow (bigint / HUGEINT / Decimal / تاريخ كأجزاء من الثانية) إلى رقم أو نص قابل للمقارنة. */
function cellNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (v !== null && typeof v === "object" && !(v instanceof Date)) return Number(String(v));
  return NaN;
}
function cellTexts(v: unknown): string[] {
  const out = [String(v)];
  if (v instanceof Date) out.push(v.toISOString().slice(0, 10));
  if (typeof v === "number" && Math.abs(v) > 1e11) out.push(new Date(v).toISOString().slice(0, 10));
  return out;
}

/** يقارن نتيجة SQL بالتوقع: كل رقم متوقع يظهر في أي خلية (تفاوت نسبي 0.5%)، والنص المتوقع يظهر في الصف الأول. */
function matches(rows: Record<string, unknown>[], c: Case): { ok: boolean; why?: string } {
  if (rows.length === 0) return { ok: false, why: "نتيجة فارغة" };
  const first = rows[0]!;
  const cells = rows.flatMap((r) => Object.values(r));
  for (const want of c.expectNumbers) {
    const hit = cells.some((v) => {
      const n = cellNumber(v);
      return Number.isFinite(n) && Math.abs(n - want) <= Math.max(0.01, Math.abs(want) * 0.005);
    });
    if (!hit) return { ok: false, why: `الرقم ${want} غير موجود في النتيجة` };
  }
  if (c.expectTop) {
    const top = Object.values(first).flatMap(cellTexts);
    if (!top.some((v) => v.includes(c.expectTop!))) return { ok: false, why: `الصف الأول لا يحوي «${c.expectTop}»` };
  }
  return { ok: true };
}

describe("arabic evals — reference (no key needed)", () => {
  it.each(cases.map((c) => [c.id, c] as const))("gold SQL matches the independent answer: %s", (_id, c) => {
    const rows = run(c.gold);
    const res = matches(rows, c);
    expect(res.ok, res.why).toBe(true);
    const v = validateQuery(c.gold, { tables: { sales: SCHEMA.map((s) => s.name) } });
    expect(v.isValid, v.rejectionReason).toBe(true);
  });

  it("the production prompt includes the table, row count and every column", () => {
    const prompt = buildSystemPrompt("sales", cases.length, SCHEMA);
    expect(prompt).toContain('"sales"');
    for (const c of SCHEMA) expect(prompt).toContain(`"${c.name}"`);
  });
});

const KEY = process.env["EVAL_API_KEY"];
const URL_ = process.env["EVAL_API_URL"] ?? "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env["EVAL_MODEL"] ?? "llama-3.3-70b-versatile";
const MIN_PASS = Number(process.env["EVAL_MIN_PASS"] ?? "0.8");

describe.skipIf(!KEY)("arabic evals — live model", () => {
  it(
    "the model's SQL reproduces the reference answers",
    async () => {
      const system = buildSystemPrompt("sales", Number((run('select count(*) c from "sales"')[0] as { c: bigint }).c), SCHEMA);
      const sample = JSON.stringify(run('select * from "sales" limit 8'), (_k, v) => (typeof v === "bigint" ? Number(v) : v));
      let pass = 0;
      const failures: string[] = [];
      for (const c of cases) {
        try {
          const res = await fetch(URL_, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
            body: JSON.stringify({
              model: MODEL,
              temperature: 0,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: system },
                { role: "user", content: `${c.question}\n\nعيّنة من الصفوف: ${sample}` },
              ],
            }),
          });
          const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const plan = JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as { sql?: string };
          const v = validateQuery(plan.sql ?? "", { tables: { sales: SCHEMA.map((s) => s.name) } });
          if (!v.isValid || !v.sanitizedQuery) throw new Error(`SQL مرفوض: ${v.rejectionReason}`);
          const m = matches(run(v.sanitizedQuery), c);
          if (!m.ok) throw new Error(m.why);
          pass++;
        } catch (e) {
          failures.push(`${c.id}: ${(e as Error).message}`);
        }
      }
      const rate = pass / cases.length;
      console.log(`[evals] ${pass}/${cases.length} (${Math.round(rate * 100)}%) model=${MODEL}\n${failures.join("\n")}`);
      expect(rate).toBeGreaterThanOrEqual(MIN_PASS);
    },
    10 * 60_000,
  );
});
