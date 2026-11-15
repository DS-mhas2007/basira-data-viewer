/**
 * Integration fixture: build a report from the active, real DuckDB workspace table.
 * SQL results and data-health metrics come from the loaded sample dataset; only the
 * natural-language plan is deterministic so this test never calls an external AI.
 */
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { ReportDocument, type ReportData } from "../../src/components/ReportDocument";
import { computeHealthReport } from "../../src/lib/data-health";
import { duckdb, quoteIdent } from "../../src/lib/duckdb-service";
import type { AiPlan } from "../../src/lib/ai-query.functions";
import type { PinnedInsight, ReportSections } from "../../src/lib/report";

const sections: ReportSections = {
  kpi: true,
  headline: true,
  actions: true,
  health: true,
  healthLog: true,
  insights: true,
  sql: true,
  stats: true,
  lineage: true,
  topBottom: true,
  anomalies: true,
  methodology: true,
};

export async function mountWorkspaceReportFixture(host: HTMLElement): Promise<{
  root: Root;
  rowCount: number;
  categoryColumn: string;
  measureColumn: string;
  resultCount: number;
  distinctMetricCount: number;
}> {
  const info = await duckdb.describe();
  const isNumeric = (type: string) =>
    /^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT|FLOAT|DOUBLE|REAL|DECIMAL|NUMERIC)/i.test(type);
  const numericColumns = info.schema.filter((column) => isNumeric(column.type));
  const categoricalColumns = info.schema.filter((column) => !isNumeric(column.type));

  // Prefer analytical dimensions/measures over identifiers and low-signal fields.
  const categoryColumn = [...categoricalColumns].sort((a, b) => {
    const score = (name: string) => {
      if (/^(category|segment|region|department|product|city|channel|status)$/i.test(name)) return 100;
      if (/(category|segment|region|product|city|channel|status)/i.test(name)) return 70;
      if (/(^|_)(id|key|code)$|date|time/i.test(name)) return -100;
      return 0;
    };
    return score(b.name) - score(a.name);
  })[0]?.name;
  const measureColumn = [...numericColumns].sort((a, b) => {
    const score = (name: string) => {
      if (/^(revenue|sales|amount|total|profit|value)$/i.test(name)) return 100;
      if (/(revenue|sales|amount|total|profit|value)/i.test(name)) return 80;
      if (/(price|cost)$/i.test(name)) return 50;
      if (/quantity|count|number/i.test(name)) return 10;
      return 0;
    };
    return score(b.name) - score(a.name);
  })[0]?.name;
  if (!measureColumn || !categoryColumn) {
    throw new Error("workspace-fixture-requires-numeric-and-categorical-columns");
  }
  const sql = `SELECT ${quoteIdent(categoryColumn)} AS category, SUM(TRY_CAST(${quoteIdent(measureColumn)} AS DOUBLE)) AS metric
    FROM ${quoteIdent(info.table)}
    WHERE TRY_CAST(${quoteIdent(measureColumn)} AS DOUBLE) IS NOT NULL
    GROUP BY ${quoteIdent(categoryColumn)}
    ORDER BY metric DESC
    LIMIT 10`;
  const rows = await duckdb.runSelect(sql, { limit: 10 });
  if (rows.length < 2) throw new Error("workspace-fixture-query-returned-too-few-rows");
  const distinctMetricCount = new Set(rows.map((row) => Number(row.metric).toFixed(6))).size;
  if (distinctMetricCount < 2) throw new Error("workspace-fixture-query-returned-no-metric-variation");

  const plan: AiPlan = {
    intent: "ranking",
    title_ar: `ترتيب الفئات حسب مجموع ${measureColumn}`,
    sql,
    intro_ar: `يعرض هذا التحليل ترتيب الفئات الفعلية في مجموعة البيانات المحمّلة حسب مجموع العمود «${measureColumn}».`,
    analysis_ar:
      "تم اشتقاق القيم مباشرة من جدول مساحة العمل باستخدام DuckDB. هذا التقرير لا يستخدم قيماً مكتوبة مسبقاً؛ بل يعرض نتائج الاستعلام المنفذ على البيانات المحمّلة. تُستخدم هذه الفقرة أيضاً للتحقق من التفاف النص العربي داخل التقرير.",
    chart: { type: "bar", x: "category", y: ["metric"], series: null },
    explanation_plan: ["مقارنة الفئات حسب القيمة الإجمالية", "مراجعة أعلى الفئات", "التحقق من جودة الأعمدة المستخدمة"],
    warnings: ["الخطة اللغوية ثابتة للاختبار؛ نتائج SQL ومقاييس الجودة مأخوذة من بيانات مساحة العمل."],
    needs_clarification: false,
    clarification_question: null,
  };

  const insight: PinnedInsight = {
    evidence: {
      id: "workspace-e2e-real-query",
      title: plan.title_ar,
      sql,
      filters: ["مصدر البيانات: مساحة العمل النشطة", "التجميع: مجموع القيمة حسب الفئة"],
      baseRowCount: info.rowCount,
      resultRowCount: rows.length,
      highlights: [
        { label: "عدد الصفوف في المصدر", value: info.rowCount.toLocaleString("en-US") },
        { label: "عدد الفئات في النتيجة", value: rows.length.toLocaleString("en-US") },
      ],
      warnings: plan.warnings,
    },
    plan,
    rows,
  };

  const health = await computeHealthReport(info.schema, info.table);
  const data: ReportData = {
    fileName: "مبيعات متجر إلكتروني.csv",
    health,
    rowCount: info.rowCount,
    columnCount: info.schema.length,
    cleanSteps: [],
    insights: [insight],
    date: new Date("2026-11-15T00:00:00"),
    audience: "analyst",
    sections,
    seal: null,
  };

  const root = createRoot(host);
  root.render(React.createElement(ReportDocument, { data }));
  return {
    root,
    rowCount: info.rowCount,
    categoryColumn,
    measureColumn,
    resultCount: rows.length,
    distinctMetricCount,
  };
}
