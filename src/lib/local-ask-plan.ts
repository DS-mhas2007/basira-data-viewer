import type { AiPlan } from "./ai-plan-schema";
import type { TableInfo } from "./duckdb-service";

const numericType =
  /(int|integer|bigint|smallint|double|float|real|decimal|numeric|number|hugeint)/i;
const dateType = /(date|time|timestamp)/i;
const words = (value: string) => value.toLocaleLowerCase("ar");
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;

function pickColumn(columns: TableInfo["schema"], pattern: RegExp, numeric = false) {
  return columns.find(
    (column) => pattern.test(words(column.name)) && (!numeric || numericType.test(column.type)),
  );
}

/**
 * Privacy-preserving fallback for the common, unambiguous questions shown in
 * the Ask Data suggestions. It never leaves the browser and never sends the
 * question, schema, or sample to a server. Complex questions deliberately
 * return null so the UI can ask for cloud consent instead of guessing.
 */
export function buildLocalAskPlan(question: string, tableInfo: TableInfo): AiPlan | null {
  const q = words(question);
  if (/(علاقة|ارتباط|correlation|scatter|كل المتغيرات|all variables)/i.test(q)) return null;
  const columns = tableInfo.schema;
  const numeric = columns.filter((column) => numericType.test(column.type));
  const measure =
    pickColumn(
      columns,
      /(revenue|sales|amount|total|price|cost|مبيعات|إيراد|إجمالي|مبلغ|سعر|تكلفة)/i,
      true,
    ) ??
    numeric.find((column) => !/(id|year|month|date|rate|percent|نسبة|سنة|شهر)/i.test(column.name));
  const category = columns.find(
    (column) =>
      !numericType.test(column.type) &&
      !dateType.test(column.type) &&
      !/(id|code|رقم|معرف)/i.test(column.name),
  );
  const wantsCount = /(كم|عدد|count|rows|صفوف)/i.test(q);
  const wantsAverage = /(متوسط|average|avg)/i.test(q);
  const wantsGroup = /(حسب|لكل|by|per|ترتيب|تصنيف|فئات|مناطق|قنوات|أشهر|شهور)/i.test(q);
  const wantsRanking = /(أعلى|اعلى|الأعلى|الاعلى|top|ترتيب|أدنى|ادنى)/i.test(q);

  if (wantsCount && !wantsGroup) {
    return {
      intent: "summary",
      title_ar: "عدد الصفوف",
      sql: `SELECT COUNT(*) AS total_rows FROM ${quote(tableInfo.table)}`,
      intro_ar: `عدد الصفوف في البيانات الكاملة هو ${tableInfo.rowCount}.`,
      analysis_ar: "حُسب العدد محلياً من كامل الجدول دون استخدام عينة الصفوف.",
      chart: { type: "kpi", x: null, y: ["total_rows"], series: null },
      explanation_plan: ["عدّ جميع الصفوف في الجدول المحلي"],
      warnings: ["هذا تحليل محلي؛ لم يُرسل السؤال أو البيانات إلى AI سحابي."],
      needs_clarification: false,
      clarification_question: null,
    };
  }

  if (!measure && !wantsCount) return null;
  const aggregate = wantsCount
    ? "COUNT(*)"
    : wantsAverage
      ? `AVG(${quote(measure!.name)})`
      : `SUM(${quote(measure!.name)})`;
  const alias = wantsCount ? "row_count" : wantsAverage ? "average_value" : "total_value";
  const label = wantsCount
    ? "عدد الصفوف"
    : wantsAverage
      ? `متوسط ${measure!.name}`
      : `مجموع ${measure!.name}`;

  if (wantsGroup && category) {
    const order = wantsRanking
      ? ` ORDER BY ${quote(alias)} ${/(أدنى|ادنى)/i.test(q) ? "ASC" : "DESC"}`
      : "";
    const limit = wantsRanking ? "\nLIMIT 10" : "\nLIMIT 1000";
    return {
      intent: wantsRanking ? "ranking" : "distribution",
      title_ar: `${label} حسب ${category.name}`,
      sql: `SELECT ${quote(category.name)} AS category, ${aggregate} AS ${quote(alias)} FROM ${quote(tableInfo.table)} GROUP BY ${quote(category.name)}${order}${limit}`,
      intro_ar: `يعرض هذا التحليل ${label} لكل ${category.name}.`,
      analysis_ar: "جُمعت الصفوف الكاملة محلياً ثم رُتبت النتائج عند طلب الترتيب.",
      chart: { type: "bar", x: "category", y: [alias], series: null },
      explanation_plan: [`تجميع ${label} حسب ${category.name}`, "ترتيب أو عرض المجموعات"],
      warnings: ["هذا تحليل محلي؛ لم يُرسل السؤال أو البيانات إلى AI سحابي."],
      needs_clarification: false,
      clarification_question: null,
    };
  }

  if (!wantsGroup) {
    return {
      intent: "summary",
      title_ar: label,
      sql: `SELECT ${aggregate} AS ${quote(alias)} FROM ${quote(tableInfo.table)}`,
      intro_ar: `حُسب ${label} من الصفوف الكاملة.`,
      analysis_ar: "نُفذ التجميع محلياً في DuckDB داخل المتصفح دون اقتطاع مسبق.",
      chart: { type: "kpi", x: null, y: [alias], series: null },
      explanation_plan: [`حساب ${label} على كامل الجدول`],
      warnings: ["هذا تحليل محلي؛ لم يُرسل السؤال أو البيانات إلى AI سحابي."],
      needs_clarification: false,
      clarification_question: null,
    };
  }

  return null;
}
