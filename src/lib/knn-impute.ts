/**
 * تقدير القيم المفقودة بالجيران الأقرب (KNN) داخل DuckDB.
 *
 * - للأعمدة الرقمية فقط، وتُوحَّد المقاييس (z-score) حتى لا يطغى عمود كبير الأرقام.
 * - المسافة تتجاهل الخصائص المفقودة في أحد الصفين وتُقسَّم على عدد الخصائص المشتركة
 *   (نفس فكرة nan-euclidean في scikit-learn).
 * - مجموعة الجيران (donors) تُقتطع بعيّنة ثابتة (REPEATABLE) حتى يبقى الحساب سريعاً ومتكرر النتيجة.
 * - النتيجة تُخزَّن في جدول مادّي باسم الخطوة، فلا يُعاد الحساب مع كل استعلام.
 */
import { duckdb, quoteIdent } from "./duckdb-service";

export const KNN_TABLE_PREFIX = "dataset__knn_";
const SRC_TABLE = "dataset__knn_src";
const WORK_TABLE = "dataset__knn_work";
export const KNN_POOL_CAP = 2000;
export const KNN_MAX_ROWS = 200_000;
export const KNN_MAX_FEATURES = 8;
export const KNN_DEFAULT_K = 5;
/** فوق هذه النسبة من المفقودات يصبح التقدير تخميناً أكثر منه استنتاجاً. */
export const KNN_WARN_RATIO = 0.3;

export function knnTableName(stepId: string): string {
  return `${KNN_TABLE_PREFIX}${stepId.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

const INTEGER_TYPE = /^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT)/i;
const ID_NAME = /(^|_)(id|uuid|code|رقم|معرف)($|_)/i;

/** يختار الخصائص الرقمية التي تُستخدم لقياس التشابه (بدون معرّفات أو أعمدة ثابتة). */
export function pickKnnFeatures(
  columns: { name: string; type: string; isNumeric: boolean; nullRatio: number; distinctCount: number }[],
  target: string,
): string[] {
  return columns
    .filter(
      (c) =>
        c.isNumeric &&
        c.name !== target &&
        !ID_NAME.test(c.name) &&
        c.distinctCount > 1 &&
        c.nullRatio < 0.9,
    )
    .sort((a, b) => a.nullRatio - b.nullRatio)
    .slice(0, KNN_MAX_FEATURES)
    .map((c) => c.name);
}

export interface KnnParams {
  allColumns: string[];
  column: string;
  columnType: string;
  features: string[];
  k: number;
}

/** SQL إنشاء جدول العمل (كل الصفوف + علامة المقدَّر) من جدول المصدر ذي __rid. */
export function buildKnnWorkSql(p: KnnParams, srcTable = SRC_TABLE, workTable = WORK_TABLE): string {
  return `CREATE OR REPLACE TABLE ${quoteIdent(workTable)} AS\n${buildKnnSelect(p, srcTable)}`;
}

/**
 * استعلام KNN مستقل بلا جداول مساعدة (للتصدير خارج التطبيق):
 * يعيد نفس أعمدة العلاقة السابقة مع القيم المقدَّرة، بنفس ترتيب الصفوف.
 */
export function buildKnnInlineSql(p: KnnParams, prevRelation: string): string {
  const body = buildKnnSelect(p, "src").replace(/^WITH /, "");
  const cols = p.allColumns.map(quoteIdent).join(", ");
  return `SELECT ${cols} FROM (
WITH src AS MATERIALIZED (SELECT row_number() OVER () AS __rid, * FROM (${prevRelation}) _s),
${body}
) _knn ORDER BY __rid`;
}

function buildKnnSelect(p: KnnParams, srcTable: string): string {
  const t = quoteIdent(p.column);
  const feats = p.features.filter((f) => f !== p.column);
  const k = Math.max(1, Math.min(25, Math.floor(p.k)));
  const stats = feats
    .map((f, i) => `avg(CAST(${quoteIdent(f)} AS DOUBLE)) AS m${i}, stddev_samp(CAST(${quoteIdent(f)} AS DOUBLE)) AS s${i}`)
    .join(", ");
  const zcols = feats
    .map((f, i) => `(CAST(s.${quoteIdent(f)} AS DOUBLE) - st.m${i}) / nullif(st.s${i}, 0) AS __z${i}`)
    .join(", ");
  const zlist = feats.map((_, i) => `__z${i}`).join(", ");
  const sumsq = feats
    .map(
      (_, i) =>
        `CASE WHEN r.__z${i} IS NOT NULL AND dn.__z${i} IS NOT NULL THEN (r.__z${i} - dn.__z${i}) * (r.__z${i} - dn.__z${i}) ELSE 0 END`,
    )
    .join(" + ");
  const cnt = feats
    .map((_, i) => `CASE WHEN r.__z${i} IS NOT NULL AND dn.__z${i} IS NOT NULL THEN 1 ELSE 0 END`)
    .join(" + ");
  const isInt = INTEGER_TYPE.test(p.columnType);
  const imputed = isInt ? `CAST(round(imp.__val) AS BIGINT)` : `imp.__val`;
  const proj = p.allColumns
    .map((c) =>
      c === p.column
        ? `CASE WHEN z.${t} IS NULL THEN ${imputed} ELSE z.${t} END AS ${t}`
        : `z.${quoteIdent(c)} AS ${quoteIdent(c)}`,
    )
    .join(", ");

  return `WITH st AS (SELECT ${stats} FROM ${quoteIdent(srcTable)}),
z AS (SELECT s.*, ${zcols} FROM ${quoteIdent(srcTable)} s CROSS JOIN st),
d AS (
  SELECT ${zlist}, CAST(${t} AS DOUBLE) AS __v FROM z WHERE ${t} IS NOT NULL
  USING SAMPLE reservoir(${KNN_POOL_CAP} ROWS) REPEATABLE (42)
),
imp AS (
  SELECT r.__rid AS __rid,
    (SELECT avg(y.__v) FROM (
       SELECT x.__v FROM (
         SELECT dn.__v AS __v, (${sumsq}) / nullif(${cnt}, 0) AS __dist FROM d AS dn
       ) x WHERE x.__dist IS NOT NULL ORDER BY x.__dist, x.__v LIMIT ${k}
     ) y) AS __val
  FROM z r WHERE r.${t} IS NULL
)
SELECT z.__rid AS __rid, ${proj}, (z.${t} IS NULL AND imp.__val IS NOT NULL) AS __imp
FROM z LEFT JOIN imp ON imp.__rid = z.__rid`;
}

export interface KnnResult {
  table: string;
  recipients: number;
  imputed: number;
  unresolved: number;
  meanBefore: number | null;
  meanAfter: number | null;
  samples: { before: string; after: string }[];
}

const signatures = new Map<string, { sig: string; result: KnnResult }>();

export function forgetKnnTables() {
  signatures.clear();
}

/** ينشئ (أو يعيد استخدام) جدول نتيجة KNN للخطوة فوق العلاقة السابقة. */
export async function ensureKnnTable(
  stepId: string,
  params: KnnParams,
  prevRelation: string,
): Promise<KnnResult> {
  const dst = knnTableName(stepId);
  const sig = `${prevRelation}||${JSON.stringify(params)}`;
  const hit = signatures.get(dst);
  if (hit && hit.sig === sig) return hit.result;

  const t = quoteIdent(params.column);
  await duckdb.query(
    `CREATE OR REPLACE TABLE ${quoteIdent(SRC_TABLE)} AS SELECT row_number() OVER () AS __rid, * FROM (${prevRelation}) _s`,
  );
  try {
    const before = await duckdb.runSelect(
      `SELECT count(*)::BIGINT AS total, sum(CASE WHEN ${t} IS NULL THEN 1 ELSE 0 END)::BIGINT AS missing, avg(CAST(${t} AS DOUBLE)) AS mean FROM ${quoteIdent(SRC_TABLE)}`,
      { limit: 1 },
    );
    const total = Number(before[0]?.["total"] ?? 0);
    const recipients = Number(before[0]?.["missing"] ?? 0);
    if (total > KNN_MAX_ROWS) {
      throw new Error(`الجدول كبير (${total.toLocaleString("en-US")} صف)؛ سقف تقدير KNN ${KNN_MAX_ROWS.toLocaleString("en-US")} صف.`);
    }
    if (total - recipients < Math.max(10, params.k + 1)) {
      throw new Error("عدد القيم المعروفة في العمود قليل جداً لتقدير موثوق.");
    }

    await duckdb.query(buildKnnWorkSql(params));
    const stats = await duckdb.runSelect(
      `SELECT sum(CASE WHEN __imp THEN 1 ELSE 0 END)::BIGINT AS imputed, avg(CAST(${t} AS DOUBLE)) AS mean FROM ${quoteIdent(WORK_TABLE)}`,
      { limit: 1 },
    );
    const sampleRows = await duckdb.runSelect(
      `SELECT __rid, CAST(round(CAST(${t} AS DOUBLE), 3) AS VARCHAR) AS v FROM ${quoteIdent(WORK_TABLE)} WHERE __imp ORDER BY __rid LIMIT 6`,
      { limit: 6 },
    );
    const cols = params.allColumns.map(quoteIdent).join(", ");
    await duckdb.query(
      `CREATE OR REPLACE TABLE ${quoteIdent(dst)} AS SELECT ${cols} FROM ${quoteIdent(WORK_TABLE)} ORDER BY __rid`,
    );
    const imputed = Number(stats[0]?.["imputed"] ?? 0);
    const result: KnnResult = {
      table: dst,
      recipients,
      imputed,
      unresolved: Math.max(0, recipients - imputed),
      meanBefore: before[0]?.["mean"] == null ? null : Number(before[0]["mean"]),
      meanAfter: stats[0]?.["mean"] == null ? null : Number(stats[0]["mean"]),
      samples: sampleRows.map((r) => ({ before: `صف ${String(r["__rid"])}: (فارغ)`, after: String(r["v"] ?? "") })),
    };
    signatures.set(dst, { sig, result });
    return result;
  } finally {
    await duckdb.query(`DROP TABLE IF EXISTS ${quoteIdent(SRC_TABLE)}`).catch(() => undefined);
    await duckdb.query(`DROP TABLE IF EXISTS ${quoteIdent(WORK_TABLE)}`).catch(() => undefined);
  }
}

/** يحذف جداول KNN غير المستخدمة بعد تغيّر قائمة الخطوات. */
export async function dropUnusedKnnTables(keepTables: string[]): Promise<void> {
  try {
    const rows = await duckdb.runSelect(
      `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'dataset\\_\\_knn\\_%' ESCAPE '\\'`,
      { limit: 200 },
    );
    for (const r of rows) {
      const name = String(r["table_name"]);
      if (name === SRC_TABLE || name === WORK_TABLE || !keepTables.includes(name)) {
        await duckdb.query(`DROP TABLE IF EXISTS ${quoteIdent(name)}`).catch(() => undefined);
        signatures.delete(name);
      }
    }
  } catch {
    /* تنظيف اختياري */
  }
}
