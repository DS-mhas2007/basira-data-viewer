import { z } from "zod";

const INTENT_ALIASES: Record<string, string> = {
  overview: "summary",
  aggregate: "summary",
  aggregation: "summary",
  general: "summary",
  comparison: "compare",
  correlation: "compare",
  time_series: "trend",
  timeseries: "trend",
  temporal: "trend",
  top_n: "ranking",
  top: "ranking",
  outlier: "anomaly",
  outliers: "anomaly",
  category_distribution: "distribution",
};

const CHART_TYPE_ALIASES: Record<string, string> = {
  bar_chart: "bar",
  column: "bar",
  column_chart: "bar",
  line_chart: "line",
  time_series: "line",
  scatter_plot: "scatter",
  metric: "kpi",
  metric_card: "kpi",
};

const IntentZ = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const key = value.trim().toLowerCase().replace(/[ -]+/g, "_");
    return INTENT_ALIASES[key] ?? key;
  },
  z.enum(["compare", "trend", "distribution", "ranking", "anomaly", "summary"]).catch("summary"),
);

const ChartTypeZ = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const key = value.trim().toLowerCase().replace(/[ -]+/g, "_");
    return CHART_TYPE_ALIASES[key] ?? key;
  },
  z.enum(["bar", "line", "scatter", "histogram", "table", "kpi"]).catch("table"),
);

const StringArrayZ = z.preprocess(
  (value) => {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
    return typeof value === "string" && value.trim() ? [value] : [];
  },
  z.array(z.string()).default([]),
);

const ChartZ = z.object({
  type: ChartTypeZ,
  x: z.string().nullable().optional().default(null),
  y: StringArrayZ,
  series: z.string().nullable().optional().default(null),
});

export const AiPlanZ = z.object({
  intent: IntentZ,
  title_ar: z.string().trim().min(1).catch("تحليل البيانات").default("تحليل البيانات"),
  sql: z.string().catch("").default(""),
  intro_ar: z.string().catch("").default(""),
  analysis_ar: z.string().catch("").default(""),
  chart: ChartZ.default({ type: "table", x: null, y: [], series: null }),
  explanation_plan: z.array(z.string()).catch([]).default([]),
  warnings: z.array(z.string()).catch([]).default([]),
  needs_clarification: z.preprocess(
    (value) => {
      if (typeof value === "string") {
        if (value.trim().toLowerCase() === "true") return true;
        if (value.trim().toLowerCase() === "false") return false;
      }
      return value;
    },
    z.boolean().catch(false),
  ).default(false),
  clarification_question: z.string().nullable().catch(null).default(null),
});

export type AiPlan = z.infer<typeof AiPlanZ>;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null);
}

/**
 * Normalize common JSON variants emitted by instruction-following models.
 * This is deliberately limited to presentation/schema aliases; SQL is never invented.
 */
export function normalizeAiPlanPayload(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const source = isRecord(value.plan)
    ? value.plan
    : isRecord(value.result)
      ? value.result
      : value;
  const rawChart = isRecord(source.chart) ? source.chart : {};

  return {
    ...source,
    intent: firstDefined(source.intent, source.analysis_type, source.analysisType),
    title_ar: firstDefined(source.title_ar, source.titleAr, source.title, source.headline_ar),
    sql: firstDefined(source.sql, source.query, source.sql_query, source.sqlQuery),
    intro_ar: firstDefined(source.intro_ar, source.introAr, source.intro),
    analysis_ar: firstDefined(source.analysis_ar, source.analysisAr, source.analysis),
    chart: {
      ...rawChart,
      type: firstDefined(rawChart.type, rawChart.chart_type, rawChart.chartType, source.chart_type, source.chartType),
      x: firstDefined(rawChart.x, rawChart.x_axis, rawChart.xAxis, source.x),
      y: firstDefined(rawChart.y, rawChart.y_axis, rawChart.yAxis, source.y),
      series: firstDefined(rawChart.series, rawChart.group_by, rawChart.groupBy, source.series),
    },
    explanation_plan: firstDefined(source.explanation_plan, source.explanationPlan, source.explanation),
    warnings: source.warnings,
    needs_clarification: firstDefined(source.needs_clarification, source.needsClarification),
    clarification_question: firstDefined(
      source.clarification_question,
      source.clarificationQuestion,
    ),
  };
}
