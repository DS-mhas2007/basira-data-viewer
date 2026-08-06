/**
 * الوحدة 7: التنظيف الموجّه (Non-destructive Cleaning).
 * كل عملية تنظيف = طبقة SQL Transform تُبنى فوق الجدول الخام (dataset__source).
 * الجدول الخام لا يُعدَّل أبداً: النتيجة تُعرض عبر VIEW باسم dataset.
 */
import { duckdb, quoteIdent, quoteLiteral, SOURCE_TABLE, type TableInfo } from "./duckdb-service";
import type { Row } from "./parse-file";

export type StepKind = "dedupe" | "trim" | "cast" | "fill" | "merge" | "datefmt";

export interface StepParams {
  /** لقطة بأسماء الأعمدة وقت إنشاء الخطوة (كل العمليات تحافظ على مجموعة الأعمدة). */
  allColumns?: string[];
  /** أعمدة نصية (خطوة trim). */
  textColumns?: string[];
  column?: string;
  columnType?: string;
  target?: "DOUBLE" | "DATE";
  /** قيمة الملء كنص (تُحوَّل لنوع العمود داخل SQL). */
  fillValue?: string;
  /** توحيد الفئات: القيم المصدر (كما هي) والقيمة الموحّدة. */
  values?: string[];
  canonical?: string;
}

export interface CleanStep {
  id: string;
  kind: StepKind;
  label: string;
  affectedRows: number;
  params: StepParams;
}

export const BASE_RELATION = `SELECT * FROM ${quoteIdent(SOURCE_TABLE)}`;

const NUMERIC_TYPES =
  /^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT|FLOAT|DOUBLE|REAL|DECIMAL|NUMERIC)/i;

export function isNumericType(type: string) {
  return NUMERIC_TYPES.test(type);
}

/** تعبير "القيمة مفقودة" الموحّد (NULL أو نص فارغ). */
function isBlank(col: string) {
  const c = quoteIdent(col);
  return `(${c} IS NULL OR trim(CAST(${c} AS VARCHAR)) = '')`;
}

/** تعبير التطبيع المستخدم في اقتراح توحيد الفئات. */
function normExpr(col: string) {
  const c = quoteIdent(col);
  return `regexp_replace(lower(trim(CAST(${c} AS VARCHAR))), '^ال|\\s+', '', 'g')`;
}

/** صيغ التواريخ الشائعة التي نحاول قراءتها قبل التوحيد إلى YYYY-MM-DD. */
const DATE_FORMATS = [
  "%Y-%m-%d",
  "%Y/%m/%d",
  "%d-%m-%Y",
  "%d/%m/%Y",
  "%m/%d/%Y",
  "%d.%m.%Y",
  "%Y-%m-%d %H:%M:%S",
  "%d-%m-%Y %H:%M:%S",
  "%Y-%m-%dT%H:%M:%S",
];

const FORMAT_LIST = `[${DATE_FORMATS.map(quoteLiteral).join(", ")}]`;

/** محاولة قراءة العمود كتاريخ بأي من الصيغ الشائعة. */
function parsedDateExpr(col: string) {
  const v = `trim(CAST(${quoteIdent(col)} AS VARCHAR))`;
  return `coalesce(try_strptime(${v}, ${FORMAT_LIST}), TRY_CAST(${v} AS TIMESTAMP))`;
}

/** التعبير الناتج بعد التوحيد (يُبقي القيمة الأصلية إن تعذّرت القراءة). */
function dateStandardExpr(col: string) {
  const c = quoteIdent(col);
  return `CASE WHEN ${isBlank(col)} THEN NULL ELSE coalesce(strftime(${parsedDateExpr(col)}, '%Y-%m-%d'), CAST(${c} AS VARCHAR)) END`;
}

/** التعبير الناتج لعمود معيّن ضمن خطوة ما (أو الاسم كما هو). */
export function columnExpr(step: CleanStep, column: string): string {
  const c = quoteIdent(column);
  const p = step.params;
  switch (step.kind) {
    case "trim":
      return p.textColumns?.includes(column)
        ? `nullif(regexp_replace(trim(CAST(${c} AS VARCHAR)), '\\s+', ' ', 'g'), '')`
        : c;
    case "cast":
      return p.column === column ? `TRY_CAST(CAST(${c} AS VARCHAR) AS ${p.target})` : c;
    case "fill":
      return p.column === column
        ? `CASE WHEN ${isBlank(column)} THEN CAST(${quoteLiteral(p.fillValue ?? "")} AS ${p.columnType && isNumericType(p.columnType) ? "DOUBLE" : "VARCHAR"}) ELSE ${c} END`
        : c;
    case "merge":
      return p.column === column
        ? `CASE WHEN trim(CAST(${c} AS VARCHAR)) IN (${(p.values ?? []).map(quoteLiteral).join(", ") || "''"}) THEN ${quoteLiteral(p.canonical ?? "")} ELSE ${c} END`
        : c;
    case "datefmt":
      return p.column === column ? dateStandardExpr(column) : c;
    default:
      return c;
  }
}

/** يبني SQL خطوة واحدة فوق علاقة سابقة. */
export function buildStepSql(step: CleanStep, from: string): string {
  if (step.kind === "dedupe") return `SELECT DISTINCT * FROM (${from}) AS _s`;
  const cols = step.params.allColumns ?? [];
  const projection = cols
    .map((c) => `${columnExpr(step, c)} AS ${quoteIdent(c)}`)
    .join(", ");
  return `SELECT ${projection || "*"} FROM (${from}) AS _s`;
}

/** يبني سلسلة التحويلات كاملة (أو null إذا لم توجد خطوات). */
export function buildRelation(steps: CleanStep[]): string | null {
  if (steps.length === 0) return null;
  return steps.reduce<string>((acc, s) => buildStepSql(s, acc), BASE_RELATION);
}

/** يطبّق السلسلة الحالية على الـ VIEW ويعيد معلومات الجدول الجديدة. */
export async function applySteps(steps: CleanStep[]): Promise<TableInfo> {
  return duckdb.setRelation(buildRelation(steps));
}

/* ============================================================
 * تحليل ما قبل التنفيذ
 * ============================================================ */

function n(v: unknown) {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function countDuplicates(from: string): Promise<number> {
  const rows = await duckdb.runSelect(
    `SELECT ((SELECT count(*) FROM (${from}) a) - (SELECT count(*) FROM (SELECT DISTINCT * FROM (${from}) b)))::BIGINT AS n`,
    { limit: 1 },
  );
  return Math.max(0, n(rows[0]?.["n"]));
}

/** عينة من الصفوف المكررة (المجموعات التي تتكرر أكثر من مرة). */
export async function duplicateSample(from: string, columns: string[], limit = 5): Promise<Row[]> {
  const cols = columns.map(quoteIdent).join(", ");
  return duckdb.runSelect(
    `SELECT ${cols}, count(*)::BIGINT AS "عدد_التكرار" FROM (${from}) _s GROUP BY ${cols} HAVING count(*) > 1 ORDER BY count(*) DESC`,
    { limit },
  );
}

export interface ChangePreview {
  affected: number;
  samples: { before: string; after: string }[];
}

/** معاينة قبل/بعد لعمود واحد ضمن خطوة مقترحة. */
export async function previewColumnChange(
  from: string,
  step: CleanStep,
  column: string,
  limit = 6,
): Promise<ChangePreview> {
  const c = quoteIdent(column);
  const after = columnExpr(step, column);
  const changed = `CAST(${c} AS VARCHAR) IS DISTINCT FROM CAST(${after} AS VARCHAR)`;
  const countRows = await duckdb.runSelect(
    `SELECT sum(CASE WHEN ${changed} THEN 1 ELSE 0 END)::BIGINT AS n FROM (${from}) _s`,
    { limit: 1 },
  );
  const samples = await duckdb.runSelect(
    `SELECT coalesce(CAST(${c} AS VARCHAR), '(فارغ)') AS b, coalesce(CAST(${after} AS VARCHAR), '(فارغ)') AS a
     FROM (${from}) _s WHERE ${changed}`,
    { limit },
  );
  return {
    affected: n(countRows[0]?.["n"]),
    samples: samples.map((r) => ({ before: String(r["b"] ?? ""), after: String(r["a"] ?? "") })),
  };
}

export interface CastCheck {
  total: number;
  convertible: number;
  failing: number;
  ratio: number;
}

/** نسبة القيم القابلة للتحويل لنوع معيّن. */
export async function checkCastability(
  from: string,
  column: string,
  target: "DOUBLE" | "DATE",
): Promise<CastCheck> {
  const c = quoteIdent(column);
  const rows = await duckdb.runSelect(
    `SELECT
       sum(CASE WHEN NOT ${isBlank(column)} THEN 1 ELSE 0 END)::BIGINT AS total,
       sum(CASE WHEN NOT ${isBlank(column)} AND TRY_CAST(CAST(${c} AS VARCHAR) AS ${target}) IS NOT NULL THEN 1 ELSE 0 END)::BIGINT AS ok
     FROM (${from}) _s`,
    { limit: 1 },
  );
  const total = n(rows[0]?.["total"]);
  const convertible = n(rows[0]?.["ok"]);
  return { total, convertible, failing: total - convertible, ratio: total > 0 ? convertible / total : 0 };
}

export interface FillSuggestion {
  missing: number;
  /** الوسيط للأرقام أو القيمة الأكثر تكراراً للنصوص. */
  suggested: string | null;
  isNumeric: boolean;
}

export async function suggestFill(
  from: string,
  column: string,
  type: string,
): Promise<FillSuggestion> {
  const c = quoteIdent(column);
  const numeric = isNumericType(type);
  const expr = numeric
    ? `CAST(median(CAST(${c} AS DOUBLE)) AS VARCHAR)`
    : `(SELECT CAST(${c} AS VARCHAR) FROM (${from}) _m WHERE NOT ${isBlank(column)} GROUP BY 1 ORDER BY count(*) DESC LIMIT 1)`;
  const rows = await duckdb.runSelect(
    `SELECT sum(CASE WHEN ${isBlank(column)} THEN 1 ELSE 0 END)::BIGINT AS missing, ${expr} AS suggested FROM (${from}) _s`,
    { limit: 1 },
  );
  const s = rows[0]?.["suggested"];
  return {
    missing: n(rows[0]?.["missing"]),
    suggested: s === null || s === undefined ? null : String(s),
    isNumeric: numeric,
  };
}

export interface CategoryGroup {
  canonical: string;
  values: { value: string; count: number }[];
  affected: number;
}

/** يقترح مجموعات فئات متشابهة نصياً (تطبيع بسيط: حالة الأحرف، المسافات، أداة التعريف). */
export async function suggestCategoryGroups(
  from: string,
  column: string,
  maxDistinct = 50,
): Promise<CategoryGroup[]> {
  const c = quoteIdent(column);
  const distinct = await duckdb.runSelect(
    `SELECT count(DISTINCT CAST(${c} AS VARCHAR))::BIGINT AS n FROM (${from}) _s WHERE NOT ${isBlank(column)}`,
    { limit: 1 },
  );
  if (n(distinct[0]?.["n"]) > maxDistinct) return [];

  const rows = await duckdb.runSelect(
    `SELECT ${normExpr(column)} AS k, CAST(${c} AS VARCHAR) AS v, count(*)::BIGINT AS n
     FROM (${from}) _s WHERE NOT ${isBlank(column)} GROUP BY 1, 2 ORDER BY 1, 3 DESC`,
    { limit: 500 },
  );

  const map = new Map<string, { value: string; count: number }[]>();
  for (const r of rows) {
    const k = String(r["k"] ?? "");
    const list = map.get(k) ?? [];
    list.push({ value: String(r["v"] ?? ""), count: n(r["n"]) });
    map.set(k, list);
  }

  const groups: CategoryGroup[] = [];
  for (const values of map.values()) {
    if (values.length < 2) continue;
    const sorted = [...values].sort((a, b) => b.count - a.count);
    const canonical = sorted[0]!.value.trim();
    groups.push({
      canonical,
      values: sorted,
      affected: sorted.slice(1).reduce((s, v) => s + v.count, 0),
    });
  }
  return groups.sort((a, b) => b.affected - a.affected);
}

/* ============================================================
 * منشئو الخطوات
 * ============================================================ */

let counter = 0;
const nextId = (kind: StepKind) => `${kind}-${Date.now()}-${counter++}`;

export function makeDedupeStep(affected: number): CleanStep {
  return {
    id: nextId("dedupe"),
    kind: "dedupe",
    label: `إزالة ${affected.toLocaleString("en-US")} صف مكرر`,
    affectedRows: affected,
    params: {},
  };
}

export function makeTrimStep(allColumns: string[], textColumns: string[], affected = 0): CleanStep {
  return {
    id: nextId("trim"),
    kind: "trim",
    label: `تنظيف النصوص في ${textColumns.length.toLocaleString("en-US")} عمود`,
    affectedRows: affected,
    params: { allColumns, textColumns },
  };
}

export function makeCastStep(
  allColumns: string[],
  column: string,
  target: "DOUBLE" | "DATE",
  affected = 0,
): CleanStep {
  return {
    id: nextId("cast"),
    kind: "cast",
    label: `تحويل «${column}» إلى ${target === "DOUBLE" ? "رقم" : "تاريخ"}`,
    affectedRows: affected,
    params: { allColumns, column, target },
  };
}

export function makeFillStep(
  allColumns: string[],
  column: string,
  columnType: string,
  fillValue: string,
  affected: number,
): CleanStep {
  return {
    id: nextId("fill"),
    kind: "fill",
    label: `ملء ${affected.toLocaleString("en-US")} قيمة مفقودة في «${column}»`,
    affectedRows: affected,
    params: { allColumns, column, columnType, fillValue },
  };
}

export function makeMergeStep(
  allColumns: string[],
  column: string,
  group: CategoryGroup,
): CleanStep {
  return {
    id: nextId("merge"),
    kind: "merge",
    label: `توحيد ${group.values.length} صيغة إلى «${group.canonical}» في «${column}»`,
    affectedRows: group.affected,
    params: {
      allColumns,
      column,
      canonical: group.canonical,
      values: group.values.map((v) => v.value.trim()),
    },
  };
}

export function makeDateStep(allColumns: string[], column: string, affected: number): CleanStep {
  return {
    id: nextId("datefmt"),
    kind: "datefmt",
    label: `توحيد صيغة التواريخ في «${column}» إلى YYYY-MM-DD`,
    affectedRows: affected,
    params: { allColumns, column },
  };
}

/* ============================================================
 * كشف التواريخ + الوصفة السحرية
 * ============================================================ */

export interface DateCheck {
  column: string;
  total: number;
  parseable: number;
  nonStandard: number;
  ratio: number;
}

/** يفحص عموداً نصياً: هل يحمل تواريخ بصيغ مشتتة؟ */
export async function checkDateColumn(from: string, column: string): Promise<DateCheck> {
  const c = quoteIdent(column);
  const parsed = parsedDateExpr(column);
  const rows = await duckdb.runSelect(
    `SELECT
       sum(CASE WHEN NOT ${isBlank(column)} THEN 1 ELSE 0 END)::BIGINT AS total,
       sum(CASE WHEN NOT ${isBlank(column)} AND ${parsed} IS NOT NULL THEN 1 ELSE 0 END)::BIGINT AS ok,
       sum(CASE WHEN NOT ${isBlank(column)} AND ${parsed} IS NOT NULL
                 AND trim(CAST(${c} AS VARCHAR)) IS DISTINCT FROM strftime(${parsed}, '%Y-%m-%d')
                THEN 1 ELSE 0 END)::BIGINT AS odd
     FROM (${from}) _s`,
    { limit: 1 },
  );
  const total = n(rows[0]?.["total"]);
  const parseable = n(rows[0]?.["ok"]);
  return {
    column,
    total,
    parseable,
    nonStandard: n(rows[0]?.["odd"]),
    ratio: total > 0 ? parseable / total : 0,
  };
}

/** الأعمدة النصية التي تبدو تواريخ بصيغ غير موحّدة. */
export async function detectDateColumns(from: string, textColumns: string[]): Promise<DateCheck[]> {
  const out: DateCheck[] = [];
  for (const col of textColumns.slice(0, 12)) {
    try {
      const d = await checkDateColumn(from, col);
      if (d.total >= 3 && d.ratio > 0.8 && d.nonStandard > 0) out.push(d);
    } catch {
      /* تجاهل الأعمدة غير القابلة للقراءة */
    }
  }
  return out.sort((a, b) => b.nonStandard - a.nonStandard);
}

export interface MagicRecipe {
  steps: CleanStep[];
  /** عدد الخلايا/الصفوف المتأثرة تقريبياً. */
  cells: number;
}

/** يبني أفضل الممارسات دفعة واحدة: تكرار ← نصوص ← تواريخ ← أنواع ← فئات ← مفقود. */
export async function buildMagicRecipe(
  from: string,
  allColumns: string[],
  textColumns: string[],
  missing: { name: string; type: string; nullCount: number }[],
  hints: {
    casts?: { column: string; target: "DOUBLE" | "DATE"; failing: number }[];
    dates?: DateCheck[];
    groups?: { column: string; group: CategoryGroup }[];
  } = {},
): Promise<MagicRecipe> {
  const steps: CleanStep[] = [];
  let cells = 0;
  let relation = from;

  const push = (step: CleanStep) => {
    steps.push(step);
    cells += step.affectedRows;
    relation = buildStepSql(step, relation);
  };

  const dupes = await countDuplicates(relation);
  if (dupes > 0) push(makeDedupeStep(dupes));

  if (textColumns.length > 0) {
    const trim = makeTrimStep(allColumns, textColumns);
    let affected = 0;
    for (const col of textColumns) {
      const p = await previewColumnChange(relation, trim, col, 0);
      affected += p.affected;
    }
    if (affected > 0) {
      push({ ...trim, affectedRows: affected, label: `تنظيف النصوص (${affected.toLocaleString("en-US")} قيمة)` });
    }
  }

  for (const d of hints.dates ?? []) {
    if (d.nonStandard > 0) push(makeDateStep(allColumns, d.column, d.nonStandard));
  }

  for (const c of hints.casts ?? []) {
    push(makeCastStep(allColumns, c.column, c.target, c.failing));
  }

  for (const g of hints.groups ?? []) {
    if (g.group.affected > 0) push(makeMergeStep(allColumns, g.column, g.group));
  }

  for (const col of missing) {
    if (col.nullCount === 0) continue;
    const s = await suggestFill(relation, col.name, col.type);
    const value = s.suggested ?? (s.isNumeric ? null : "غير محدد");
    if (value === null) continue;
    push(makeFillStep(allColumns, col.name, col.type, value, s.missing || col.nullCount));
  }

  return { steps, cells };
}