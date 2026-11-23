/**
 * الوحدة 8: توليد استنتاجات تلقائية عند عدم وجود استنتاجات مثبتة.
 * يستخدم نفس آلية الوحدة 4 (planAiQuery) والوحدة 5 (SQL Validator) دون تعديلها.
 */
import type { AiPlan, AiQueryResponse } from "@/lib/ai-query.functions";
import type { TableInfo } from "@/lib/duckdb-service";
import type { HealthReport } from "@/lib/data-health";
import type { Row } from "@/lib/parse-file";
import { runValidatedQuery, schemaFromTableInfo } from "@/lib/sql-validator";
import { addDateCastQuality, buildWarnings, countBaseRows, extractFilters, getSourceColumnQuality, pickHighlights } from "@/lib/evidence";
import type { PinnedInsight } from "@/lib/report";
import { quoteIdent } from "@/lib/duckdb-service";
import { aggFor, pickAnalysisColumns } from "@/lib/findings";

export const MAX_AUTO_INSIGHTS = 5;

const DATE_RE = /(date|time|year|month|يوم|تاريخ|سنة|شهر)/i;

function isNumericType(t: string) {
  return /(INT|DECIMAL|DOUBLE|FLOAT|REAL|NUMERIC|HUGEINT)/i.test(t);
}
function isDateType(t: string, name: string) {
  return /(DATE|TIMESTAMP|TIME)/i.test(t) || DATE_RE.test(name);
}

/** أسئلة قياسية عامة تُبنى من أنواع الأعمدة المتاحة (بلا أي استدعاء AI). */
export function buildAutoQuestions(info: TableInfo): string[] {
  const cols = info.schema;
  const numeric = cols.filter((c) => isNumericType(c.type) && !isDateType(c.type, c.name));
  const dates = cols.filter((c) => isDateType(c.type, c.name));
  const categorical = cols.filter(
    (c) => !isNumericType(c.type) && !isDateType(c.type, c.name),
  );

  const qs: string[] = [];
  const measure = numeric[0]?.name;
  const cat = categorical[0]?.name;
  const cat2 = categorical[1]?.name;
  const date = dates[0]?.name;

  if (measure && cat) qs.push(`ما توزيع «${measure}» حسب «${cat}»؟ اعرض أعلى 10 فئات.`);
  if (measure && date) qs.push(`كيف تغيّر «${measure}» عبر «${date}»؟ اعرض الاتجاه الزمني.`);
  if (measure && cat) qs.push(`ما أعلى 5 قيم في «${cat}» من حيث «${measure}»؟`);
  if (measure) qs.push(`ما ملخص القيم الإحصائية لعمود «${measure}» (المتوسط، الأدنى، الأعلى)؟`);
  if (measure && cat2) qs.push(`ما توزيع «${measure}» حسب «${cat2}»؟ اعرض أعلى 10 فئات.`);
  if (cat && !measure) qs.push(`ما أكثر 10 قيم تكراراً في عمود «${cat}»؟`);
  if (qs.length === 0 && cols[0]) qs.push(`أعطني ملخصاً عاماً لعمود «${cols[0].name}».`);

  return qs.slice(0, MAX_AUTO_INSIGHTS);
}

type AskFn = (opts: { data: unknown }) => Promise<AiQueryResponse>;

/** ينفّذ خطة واحدة ويحوّلها إلى استنتاج كامل، أو null عند أي فشل جزئي. */
async function toInsight(
  plan: AiPlan,
  info: TableInfo,
  health: HealthReport | null,
  seq: number,
): Promise<PinnedInsight | null> {
  if (plan.needs_clarification || !plan.sql.trim()) return null;
  const registry = schemaFromTableInfo(info);
  const { result, rows } = await runValidatedQuery(plan.sql, registry);
  if (!result.isValid || !rows || rows.length === 0) return null;
  const sql = result.sanitizedQuery ?? plan.sql;
  const baseRowCount = await countBaseRows(sql, registry);
  const sourceColumns = await addDateCastQuality(sql, getSourceColumnQuality(sql, health), registry);
  return {
    plan,
    rows: rows as Row[],
    evidence: {
      id: `auto-${seq}-${Date.now()}`,
      title: plan.title_ar,
      sql,
      filters: extractFilters(sql),
      baseRowCount,
      resultRowCount: rows.length,
      highlights: pickHighlights(plan, rows as Row[]),
      sourceColumns,
      warnings: buildWarnings(
        plan,
        health,
        [...(rows[0] ? Object.keys(rows[0]) : []), ...sourceColumns.map((col) => col.name)],
      ),
    },
  };
}

/** ينفّذ قائمة أسئلة عربية ويعيد الاستنتاجات الناجحة فقط (يُستخدم في التوليد التلقائي والقوالب). */
export async function runQuestions(opts: {
  askAi: AskFn;
  cloudAiConsent: boolean;
  tableInfo: TableInfo;
  sample: Row[];
  health: HealthReport | null;
  questions: string[];
  onProgress?: (done: number, total: number) => void;
}): Promise<PinnedInsight[]> {
  const { askAi, cloudAiConsent, tableInfo, sample, health, questions } = opts;
  let done = 0;
  const settled = await Promise.allSettled(
    questions.map(async (question, i) => {
      try {
        const res = await askAi({
          data: {
            cloudAiConsent,
            question,
            table: tableInfo.table,
            schema: tableInfo.schema.map((c) => ({ name: c.name, type: c.type })),
            sample: sample.slice(0, 8),
          },
        });
        if (!res.ok) return null;
        return await toInsight(res.plan, tableInfo, health, i);
      } finally {
        done += 1;
        opts.onProgress?.(done, questions.length);
      }
    }),
  );

  const out: PinnedInsight[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value) out.push(s.value);
  }
  return out;
}

/**
 * يولّد 3-5 استنتاجات تلقائية. أي سؤال يفشل يُتجاهل بصمت وتستمر البقية.
 */
export async function generateAutoInsights(opts: {
  askAi: AskFn;
  cloudAiConsent: boolean;
  tableInfo: TableInfo;
  sample: Row[];
  health: HealthReport | null;
  max?: number;
}): Promise<PinnedInsight[]> {
  const questions = buildAutoQuestions(opts.tableInfo).slice(0, opts.max ?? MAX_AUTO_INSIGHTS);
  return runQuestions({
    askAi: opts.askAi,
    cloudAiConsent: opts.cloudAiConsent,
    tableInfo: opts.tableInfo,
    sample: opts.sample,
    health: opts.health,
    questions,
  });
}


/**
 * استنتاجات محلية بلا ذكاء اصطناعي ولا تسجيل دخول: استعلامات قياسية آمنة تُبنى من أنواع الأعمدة،
 * وتُنفَّذ على DuckDB داخل المتصفح بنفس مدقّق SQL ومسار الأدلة. يعمل التقرير بها دون اتصال.
 */
export async function buildLocalInsights(
  info: TableInfo,
  health: HealthReport | null,
  max = MAX_AUTO_INSIGHTS,
): Promise<PinnedInsight[]> {
  const plans = buildLocalPlans(info, await pickAnalysisColumns(info));
  const out: PinnedInsight[] = [];
  for (const [i, plan] of plans.slice(0, max).entries()) {
    try {
      const insight = await toInsight(plan, info, health, i);
      if (insight) out.push(insight);
    } catch {
      /* استنتاج فاشل لا يمنع غيره */
    }
  }
  return out;
}

/** الخطط القياسية (بلا تنفيذ): دالة نقية قابلة للاختبار. */
export function buildLocalPlans(
  info: TableInfo,
  { measures, cats, dateCol }: { measures: string[]; cats: string[]; dateCol: string | undefined },
): AiPlan[] {
  const t = quoteIdent(info.table);
  const plans: AiPlan[] = [];
  const base = (): Pick<AiPlan, "intro_ar" | "analysis_ar" | "explanation_plan" | "warnings" | "needs_clarification" | "clarification_question"> => ({
    intro_ar: "",
    analysis_ar: "",
    explanation_plan: [],
    warnings: [],
    needs_clarification: false,
    clarification_question: null,
  });
  const measure = measures[0];

  if (measure) {
    const m = quoteIdent(measure);
    const agg = aggFor(measure);
    const aggName = agg === "SUM" ? "الإجمالي" : "المتوسط";
    plans.push({
      ...base(),
      intent: "summary",
      title_ar: `ملخص «${measure}»`,
      sql: `SELECT COUNT(${m}) AS count_values, AVG(${m}) AS avg_value, MEDIAN(${m}) AS median_value, MIN(${m}) AS min_value, MAX(${m}) AS max_value FROM ${t}`,
      chart: { type: "table", x: null, y: [], series: null },
    });
    if (cats[0]) {
      const c = quoteIdent(cats[0]);
      plans.push({
        ...base(),
        intent: "ranking",
        title_ar: `${aggName} «${measure}» حسب «${cats[0]}»`,
        sql: `SELECT ${c} AS category, ${agg}(${m}) AS value FROM ${t} WHERE ${c} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
        chart: { type: "bar", x: "category", y: ["value"], series: null },
      });
    }
    if (dateCol) {
      const d = `CAST(${quoteIdent(dateCol)} AS DATE)`;
      plans.push({
        ...base(),
        intent: "trend",
        title_ar: `تغيّر ${aggName} «${measure}» عبر الزمن`,
        sql: `SELECT strftime(date_trunc('month', ${d}), '%Y-%m') AS month, ${agg}(${m}) AS value FROM ${t} WHERE ${quoteIdent(dateCol)} IS NOT NULL GROUP BY 1 ORDER BY 1 LIMIT 120`,
        chart: { type: "line", x: "month", y: ["value"], series: null },
      });
    }
    if (cats[1]) {
      const c = quoteIdent(cats[1]);
      plans.push({
        ...base(),
        intent: "compare",
        title_ar: `${aggName} «${measure}» حسب «${cats[1]}»`,
        sql: `SELECT ${c} AS category, ${agg}(${m}) AS value FROM ${t} WHERE ${c} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
        chart: { type: "bar", x: "category", y: ["value"], series: null },
      });
    }
  }
  const countCat = cats[measure ? 2 : 0] ?? (measure ? undefined : cats[0]);
  if (countCat) {
    const c = quoteIdent(countCat);
    plans.push({
      ...base(),
      intent: "distribution",
      title_ar: `أكثر القيم تكراراً في «${countCat}»`,
      sql: `SELECT ${c} AS category, COUNT(*) AS count_rows FROM ${t} WHERE ${c} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
      chart: { type: "bar", x: "category", y: ["count_rows"], series: null },
    });
  }

  return plans;
}
