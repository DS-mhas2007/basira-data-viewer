import type { AiPlan } from "./ai-plan-schema";
import type { TableInfo } from "./duckdb-service";

const numericType =
  /(int|integer|bigint|smallint|double|float|real|decimal|numeric|number|hugeint)/i;
const dateType = /(date|time|timestamp)/i;
const words = (value: string) => value.toLocaleLowerCase("ar");
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const warning = "هذا تحليل محلي؛ لم يُرسل السؤال أو البيانات إلى AI سحابي.";

function pickColumn(columns: TableInfo["schema"], pattern: RegExp, numeric = false) {
  return columns.find(
    (column) => pattern.test(words(column.name)) && (!numeric || numericType.test(column.type)),
  );
}

function pickDimension(question: string, columns: TableInfo["schema"]) {
  const q = words(question);
  const aliases: RegExp[] = [
    /(category|الفئة|فئات)/i,
    /(region|منطقة|مناطق)/i,
    /(channel|قناة|قنوات)/i,
    /(customer.?segment|شريحة|شرائح)/i,
  ];
  for (const alias of aliases) {
    const column = columns.find((candidate) => alias.test(q) && alias.test(words(candidate.name)));
    if (column) return column;
  }
  return columns.find(
    (column) =>
      !numericType.test(column.type) &&
      !dateType.test(column.type) &&
      !/(id|code|رقم|معرف)/i.test(column.name),
  );
}

function makePlan(
  base: Omit<AiPlan, "warnings" | "needs_clarification" | "clarification_question">,
): AiPlan {
  return {
    ...base,
    warnings: [warning],
    needs_clarification: false,
    clarification_question: null,
  };
}

/**
 * Privacy-preserving fallback for unambiguous questions. It runs only in the
 * browser and returns null rather than guessing when the question is complex.
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
  const dateColumn =
    pickColumn(columns, /(date|time|تاريخ|يوم|شهر|month)/i) ??
    columns.find((c) => dateType.test(c.type));
  const orderId = pickColumn(columns, /(order.?id|طلب|معرف)/i);
  const wantsCount = /(كم|عدد|count|rows|صفوف)/i.test(q);
  const wantsAverage = /(متوسط|average|avg)/i.test(q);
  const wantsGroup = /(حسب|لكل|by|per|ترتيب|تصنيف|فئات|مناطق|قنوات|أشهر|شهور|شهر)/i.test(q);
  const wantsRanking = /(أعلى|اعلى|الأعلى|الاعلى|top|ترتيب|أدنى|ادنى)/i.test(q);
  const wantsMonthly = /(شهر|شهري|شهريا|شهرياً|حسب الشهر|بالشهر|monthly|month)/i.test(q);

  if (/(مكرر|تكرار|duplicates?|duplicate|متشابه)/i.test(q)) {
    if (!columns.length) return null;
    const distinctTuple = columns.map((column) => quote(column.name)).join(", ");
    const idHint = orderId
      ? ` تم فحص تكرار الصفوف الكاملة، وليس افتراض أن كل طلب يجب أن يظهر مرة واحدة.`
      : "";
    return makePlan({
      intent: "anomaly",
      title_ar: "الصفوف المكررة",
      sql: `SELECT COUNT(*) - COUNT(DISTINCT (${distinctTuple})) AS duplicate_rows, COUNT(*) AS total_rows FROM ${quote(tableInfo.table)}`,
      intro_ar: "يحسب هذا الاستعلام الصفوف المتطابقة في جميع الأعمدة.",
      analysis_ar: `النتيجة تميّز بين تكرار الصف الكامل وتكرار معرّف الطلب.${idHint}`,
      chart: { type: "kpi", x: null, y: ["duplicate_rows"], series: null },
      explanation_plan: ["عدّ الصفوف الكاملة", "عدّ التركيبات الفريدة لكل الأعمدة", "حساب الفرق"],
    });
  }

  if (wantsMonthly && dateColumn && (measure || wantsCount)) {
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
    const dateExpr = `TRY_CAST(${quote(dateColumn.name)} AS DATE)`;
    return makePlan({
      intent: "trend",
      title_ar: `${label} حسب الشهر`,
      sql: `SELECT DATE_TRUNC('month', ${dateExpr}) AS month, ${aggregate} AS ${quote(alias)} FROM ${quote(tableInfo.table)} WHERE ${dateExpr} IS NOT NULL GROUP BY 1 ORDER BY 1\nLIMIT 1000`,
      intro_ar: `يعرض ${label} شهرياً من كامل الصفوف ذات التاريخ القابل للتحويل.`,
      analysis_ar: "حُوّل التاريخ صراحةً ثم جُمعت الصفوف الكاملة حسب الشهر.",
      chart: { type: "line", x: "month", y: [alias], series: null },
      explanation_plan: [
        `تحويل ${dateColumn.name} إلى تاريخ`,
        `تجميع ${label} حسب الشهر`,
        "ترتيب الأشهر تصاعدياً",
      ],
    });
  }

  if (wantsCount && !wantsGroup) {
    return makePlan({
      intent: "summary",
      title_ar: "عدد الصفوف",
      sql: `SELECT COUNT(*) AS total_rows FROM ${quote(tableInfo.table)}`,
      intro_ar: `عدد الصفوف في البيانات الكاملة هو ${tableInfo.rowCount}.`,
      analysis_ar: "حُسب العدد محلياً من كامل الجدول دون استخدام عينة الصفوف.",
      chart: { type: "kpi", x: null, y: ["total_rows"], series: null },
      explanation_plan: ["عدّ جميع الصفوف في الجدول المحلي"],
    });
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
  const category = pickDimension(q, columns);

  if (wantsGroup && category) {
    const order = wantsRanking
      ? ` ORDER BY ${quote(alias)} ${/(أدنى|ادنى)/i.test(q) ? "ASC" : "DESC"}`
      : "";
    const limit = wantsRanking ? "\nLIMIT 10" : "\nLIMIT 1000";
    return makePlan({
      intent: wantsRanking ? "ranking" : "distribution",
      title_ar: `${label} حسب ${category.name}`,
      sql: `SELECT ${quote(category.name)} AS category, ${aggregate} AS ${quote(alias)} FROM ${quote(tableInfo.table)} GROUP BY ${quote(category.name)}${order}${limit}`,
      intro_ar: `يعرض هذا التحليل ${label} لكل ${category.name}.`,
      analysis_ar: "جُمعت الصفوف الكاملة محلياً ثم رُتبت النتائج عند طلب الترتيب.",
      chart: { type: "bar", x: "category", y: [alias], series: null },
      explanation_plan: [`تجميع ${label} حسب ${category.name}`, "ترتيب أو عرض المجموعات"],
    });
  }

  if (!wantsGroup) {
    return makePlan({
      intent: "summary",
      title_ar: label,
      sql: `SELECT ${aggregate} AS ${quote(alias)} FROM ${quote(tableInfo.table)}`,
      intro_ar: `حُسب ${label} من الصفوف الكاملة.`,
      analysis_ar: "نُفذ التجميع محلياً في DuckDB داخل المتصفح دون اقتطاع مسبق.",
      chart: { type: "kpi", x: null, y: [alias], series: null },
      explanation_plan: [`حساب ${label} على كامل الجدول`],
    });
  }

  return null;
}
