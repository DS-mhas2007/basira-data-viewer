/**
 * الوحدة 3: فحص صحة البيانات (Data Health).
 * كل الحسابات تتم عبر استعلامات SQL على DuckDB — لا معالجة يدوية في JavaScript.
 * مرحلة تشخيص وعرض فقط: لا تعديل ولا إصلاح للبيانات هنا.
 */
import { duckdb, quoteIdent, TABLE_NAME } from "./duckdb-service";

/* ============================================================
 * أوزان درجة الجودة — عدّلها من هنا فقط
 * ============================================================ */
/** أقصى خصم بسبب القيم المفقودة (يُخصم بنسبة المفقود من إجمالي الخلايا). */
export const MISSING_VALUES_WEIGHT = 40;
/** أقصى خصم بسبب الصفوف المكررة (يُخصم بنسبة المكرر من إجمالي الصفوف). */
export const DUPLICATES_WEIGHT = 30;
/** أقصى خصم بسبب عدم تناسق أنواع الأعمدة (يُخصم بنسبة الأعمدة غير المتناسقة). */
export const TYPE_MISMATCH_WEIGHT = 30;

/** عتبات تصنيف الدرجة. */
export const SCORE_GOOD = 80;
export const SCORE_WARN = 50;
/** نسبة القيم الرقمية التي تجعلنا نعتبر عمود النص "رقمياً في الأصل". */
const NUMERIC_DOMINANCE = 0.7;
/** نسبة القيم المفقودة التي تُعد مشكلة تستحق العرض. */
const MISSING_ISSUE_THRESHOLD = 0.02;

export type Severity = "good" | "warn" | "bad";

export interface ColumnHealth {
  name: string;
  type: string;
  isNumeric: boolean;
  nullCount: number;
  nullRatio: number;
  distinctCount: number;
  min: number | null;
  max: number | null;
  median: number | null;
  /** عدد القيم النصية داخل عمود يبدو رقمياً. */
  typeMismatchCount: number;
}

export interface HealthIssue {
  id: string;
  title: string;
  column: string | null;
  affectedRows: number;
  severity: Severity;
  kind: "missing" | "duplicates" | "type" | "constant";
  /** وزن الترتيب: الأكثر تأثيراً أولاً. */
  impact: number;
}

export interface HealthReport {
  score: number;
  rowCount: number;
  columnCount: number;
  totalCells: number;
  missingCells: number;
  missingRatio: number;
  duplicateRows: number;
  duplicateRatio: number;
  mismatchedColumns: number;
  deductions: { missing: number; duplicates: number; typeMismatch: number };
  columns: ColumnHealth[];
  issues: HealthIssue[];
}

const NUMERIC_TYPES =
  /^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT|FLOAT|DOUBLE|REAL|DECIMAL|NUMERIC)/i;

function num(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}
function nullableNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function severityOfScore(score: number): Severity {
  return score >= SCORE_GOOD ? "good" : score >= SCORE_WARN ? "warn" : "bad";
}

function severityOfRatio(ratio: number): Severity {
  return ratio >= 0.2 ? "bad" : ratio >= 0.05 ? "warn" : "good";
}

function pct(ratio: number) {
  const v = ratio * 100;
  return v > 0 && v < 1 ? "أقل من 1%" : `${Math.round(v)}%`;
}

const healthInFlight = new Map<string, Promise<HealthReport>>();

/** Snapshot identity prevents a same-schema report from crossing dataset switches. */
export function buildHealthReportCacheKey(
  table: string,
  schema: { name: string; type: string }[],
  source: { alias: string; contentFingerprint: string; sourceRevision: number } | null,
  relationRevision: number,
): string {
  return JSON.stringify([table, schema, source?.alias ?? null, source?.contentFingerprint ?? null,
    source?.sourceRevision ?? null, relationRevision]);
}

/** يحسب تقرير الصحة كاملاً عبر SQL على DuckDB. */
export async function computeHealthReport(
  schema: { name: string; type: string }[],
  table = TABLE_NAME,
): Promise<HealthReport> {
  const source = duckdb.getActiveSourceIdentity();
  const relationRevision = duckdb.getActiveRelationRevision();
  const key = buildHealthReportCacheKey(table, schema, source, relationRevision);
  const active = healthInFlight.get(key);
  if (active) return active;

  const promise = computeHealthReportUncached(schema, table).then((report) => {
    const currentKey = buildHealthReportCacheKey(
      table, schema, duckdb.getActiveSourceIdentity(), duckdb.getActiveRelationRevision(),
    );
    if (currentKey !== key) {
      throw new Error("تغير مصدر البيانات أثناء فحص الجودة؛ تم رفض التقرير القديم. أعد الفحص على المصدر الحالي.");
    }
    return report;
  });
  healthInFlight.set(key, promise);
  void promise
    .finally(() => {
      if (healthInFlight.get(key) === promise) healthInFlight.delete(key);
    })
    .catch(() => undefined);
  return promise;
}

async function computeHealthReportUncached(
  schema: { name: string; type: string }[],
  table = TABLE_NAME,
): Promise<HealthReport> {
  const t = quoteIdent(table);

  // إجمالي الصفوف + الصفوف المكررة بالكامل (على مستوى الجدول)
  const base = await duckdb.runSelect(
    `SELECT
       (SELECT count(*) FROM ${t})::BIGINT AS total_rows,
       ((SELECT count(*) FROM ${t}) - (SELECT count(*) FROM (SELECT DISTINCT * FROM ${t})))::BIGINT AS dup_rows`,
    { limit: 1 },
  );
  const rowCount = num(base[0]?.["total_rows"]);
  const duplicateRows = Math.max(0, num(base[0]?.["dup_rows"]));

  // نفّذ مقاييس كل الأعمدة في استعلام واحد بدل استعلام مستقل لكل عمود.
  // هذا يقلل زمن الفحص من (عدد الأعمدة + 1) دورات إلى دورتين فقط على DuckDB.
  const metricSelects: string[] = [];
  const metricKeys: string[] = [];
  for (const [index, col] of schema.entries()) {
    const c = quoteIdent(col.name);
    const key = `__health_${index}`;
    const isNumeric = NUMERIC_TYPES.test(col.type);
    metricKeys.push(key);
    metricSelects.push(
      `sum(CASE WHEN ${c} IS NULL OR trim(CAST(${c} AS VARCHAR)) = '' THEN 1 ELSE 0 END)::BIGINT AS ${quoteIdent(`${key}_null`)}`,
      `count(DISTINCT ${c})::BIGINT AS ${quoteIdent(`${key}_distinct`)}`,
      `count(${c})::BIGINT AS ${quoteIdent(`${key}_non_null`)}`,
      isNumeric
        ? `min(CAST(${c} AS DOUBLE)) AS ${quoteIdent(`${key}_min`)}, max(CAST(${c} AS DOUBLE)) AS ${quoteIdent(`${key}_max`)}, median(CAST(${c} AS DOUBLE)) AS ${quoteIdent(`${key}_median`)}, 0::BIGINT AS ${quoteIdent(`${key}_numeric_like`)}, 0::BIGINT AS ${quoteIdent(`${key}_non_numeric`)}`
        : `NULL::DOUBLE AS ${quoteIdent(`${key}_min`)}, NULL::DOUBLE AS ${quoteIdent(`${key}_max`)}, NULL::DOUBLE AS ${quoteIdent(`${key}_median`)}, count(TRY_CAST(CAST(${c} AS VARCHAR) AS DOUBLE))::BIGINT AS ${quoteIdent(`${key}_numeric_like`)}, sum(CASE WHEN ${c} IS NOT NULL AND trim(CAST(${c} AS VARCHAR)) <> '' AND TRY_CAST(CAST(${c} AS VARCHAR) AS DOUBLE) IS NULL THEN 1 ELSE 0 END)::BIGINT AS ${quoteIdent(`${key}_non_numeric`)}`,
    );
  }
  const metricRows =
    schema.length > 0
      ? await duckdb.runSelect(`SELECT ${metricSelects.join(",\n")} FROM ${t}`, { limit: 1 })
      : [{}];
  const metrics = metricRows[0] ?? {};

  const columns: ColumnHealth[] = [];
  for (const [index, col] of schema.entries()) {
    const key = metricKeys[index]!;
    const r = metrics;
    const numericLike = num(r[`${key}_numeric_like`]);
    const nonNumeric = num(r[`${key}_non_numeric`]);
    // عدم تناسق النوع: عمود نصي أغلب قيمه أرقام لكنه يحوي قيماً نصية
    const isNumeric = NUMERIC_TYPES.test(col.type);
    const nullCount = num(r[`${key}_null`]);
    const distinctCount = num(r[`${key}_distinct`]);
    const nonNullCount = num(r[`${key}_non_null`]);
    const looksNumeric =
      !isNumeric && nonNullCount > 0 && numericLike / nonNullCount >= NUMERIC_DOMINANCE;

    columns.push({
      name: col.name,
      type: col.type,
      isNumeric,
      nullCount,
      nullRatio: rowCount > 0 ? nullCount / rowCount : 0,
      distinctCount,
      min: nullableNum(r[`${key}_min`]),
      max: nullableNum(r[`${key}_max`]),
      median: nullableNum(r[`${key}_median`]),
      typeMismatchCount: looksNumeric && nonNumeric > 0 ? nonNumeric : 0,
    });
  }

  const columnCount = columns.length;
  const totalCells = rowCount * columnCount;
  const missingCells = columns.reduce((s, c) => s + c.nullCount, 0);
  const missingRatio = totalCells > 0 ? missingCells / totalCells : 0;
  const duplicateRatio = rowCount > 0 ? duplicateRows / rowCount : 0;
  const mismatchedColumns = columns.filter((c) => c.typeMismatchCount > 0).length;
  const mismatchRatio = columnCount > 0 ? mismatchedColumns / columnCount : 0;

  const deductions = {
    missing: missingRatio * MISSING_VALUES_WEIGHT,
    duplicates: duplicateRatio * DUPLICATES_WEIGHT,
    typeMismatch: mismatchRatio * TYPE_MISMATCH_WEIGHT,
  };
  const score = Math.max(
    0,
    Math.round(100 - deductions.missing - deductions.duplicates - deductions.typeMismatch),
  );

  const issues: HealthIssue[] = [];

  for (const c of columns) {
    if (c.nullRatio > MISSING_ISSUE_THRESHOLD) {
      issues.push({
        id: `missing:${c.name}`,
        kind: "missing",
        title: `${pct(c.nullRatio)} من عمود «${c.name}» يحتوي قيماً مفقودة`,
        column: c.name,
        affectedRows: c.nullCount,
        severity: severityOfRatio(c.nullRatio),
        impact: c.nullRatio * MISSING_VALUES_WEIGHT + 1,
      });
    }
    if (c.typeMismatchCount > 0) {
      issues.push({
        id: `type:${c.name}`,
        kind: "type",
        title: `عمود «${c.name}» يبدو رقمياً لكنه يحتوي ${c.typeMismatchCount.toLocaleString("en-US")} ${c.typeMismatchCount === 1 ? "قيمة نصية" : "قيم نصية"}`,
        column: c.name,
        affectedRows: c.typeMismatchCount,
        severity: "bad",
        impact: TYPE_MISMATCH_WEIGHT / Math.max(1, columnCount) + 5,
      });
    }
    if (rowCount > 1 && c.distinctCount === 1) {
      issues.push({
        id: `constant:${c.name}`,
        kind: "constant",
        title: `عمود «${c.name}» يحتوي قيمة واحدة متكررة في كل الصفوف`,
        column: c.name,
        affectedRows: rowCount,
        severity: "warn",
        impact: 0.5,
      });
    }
  }

  if (duplicateRows > 0) {
    issues.push({
      id: "duplicates",
      kind: "duplicates",
      title: `${duplicateRows.toLocaleString("en-US")} صفاً مكرراً بالكامل (${pct(duplicateRatio)} من الجدول)`,
      column: null,
      affectedRows: duplicateRows,
      severity: severityOfRatio(duplicateRatio),
      impact: duplicateRatio * DUPLICATES_WEIGHT + 2,
    });
  }

  issues.sort((a, b) => b.impact - a.impact);

  return {
    score,
    rowCount,
    columnCount,
    totalCells,
    missingCells,
    missingRatio,
    duplicateRows,
    duplicateRatio,
    mismatchedColumns,
    deductions,
    columns,
    issues,
  };
}
