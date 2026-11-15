/**
 * Deterministic report fixture for browser-level PDF export QA.
 * It renders the production ReportDocument with synthetic data only; no AI/API request is made.
 */
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { ReportDocument, type ReportData } from "../../src/components/ReportDocument";
import type { ColumnHealth, HealthReport } from "../../src/lib/data-health";
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

function makeInsight(
  id: string,
  title: string,
  xValues: string[],
  values: number[],
): PinnedInsight {
  const rows = xValues.map((label, index) => ({
    category: label,
    revenue: values[index]!,
  }));

  return {
    evidence: {
      id,
      title,
      sql: 'SELECT category, SUM(revenue) AS revenue FROM sales GROUP BY category ORDER BY revenue DESC LIMIT 10',
      filters: ["الفترة: آخر 12 شهراً", "الحالة: مكتمل"],
      baseRowCount: 10_000,
      resultRowCount: rows.length,
      highlights: [
        { label: "إجمالي الإيرادات", value: "1,240,000" },
        { label: "متوسط الإيراد", value: "155,000" },
      ],
      warnings: ["بيانات اختبار اصطناعية — لا تستخدم لاتخاذ قرار فعلي"],
    },
    plan: {
      intent: "trend",
      title_ar: title,
      sql: "SELECT category, SUM(revenue) AS revenue FROM sales GROUP BY category ORDER BY revenue DESC LIMIT 10",
      intro_ar:
        "يعرض هذا الملخص اتجاه الإيرادات عبر فئات متعددة، مع الحفاظ على ترتيب الفئات وقيمها الأصلية.",
      analysis_ar:
        "تُستخدم هذه الفقرة لاختبار التفاف النص العربي داخل صفحة التقرير. يجب أن يظهر النص بتشكيل صحيح، وألا يقترب من حدود الصفحة أو يتداخل مع الرسم البياني. تتضمن العينة تسميات طويلة ومحتوى ثنائي الاتجاه لاختبار التصدير.",
      chart: { type: "bar", x: "category", y: ["revenue"], series: null },
      explanation_plan: ["مقارنة القيم", "مراجعة التوزيع", "التحقق من الحدود"],
      warnings: [],
      needs_clarification: false,
      clarification_question: null,
    },
    rows,
  };
}

function makeHealth(): HealthReport {
  const columns: ColumnHealth[] = Array.from({ length: 28 }, (_, index) => ({
    name: index === 0 ? "الفئة" : "مؤشر_تحليلي_طويل_" + String(index + 1).padStart(2, "0"),
    type: index === 0 ? "VARCHAR" : "DOUBLE",
    isNumeric: index !== 0,
    nullCount: index % 4,
    nullRatio: (index % 4) / 10_000,
    distinctCount: 80 + index,
    min: index === 0 ? null : index * 2,
    max: index === 0 ? null : index * 120,
    median: index === 0 ? null : index * 18,
    typeMismatchCount: index === 7 ? 2 : 0,
  }));

  return {
    score: 91,
    rowCount: 10_000,
    columnCount: columns.length,
    totalCells: 280_000,
    missingCells: 140,
    missingRatio: 0.0005,
    duplicateRows: 12,
    duplicateRatio: 0.0012,
    mismatchedColumns: 1,
    deductions: { missing: 2, duplicates: 1, typeMismatch: 1 },
    columns,
    issues: [
      {
        id: "dense-fixture-type",
        title: "قيم غير متوافقة في مؤشر تحليلي",
        column: columns[7]!.name,
        affectedRows: 2,
        severity: "warn",
        kind: "type",
        impact: 2,
      },
    ],
  };
}

export function mountDenseReportFixture(host: HTMLElement): Root {
  const insights = [
    makeInsight(
      "dense-latin",
      "Revenue trend by operating region — Latin chart labels",
      ["North", "South", "East", "West", "Central", "Coastal", "Highlands", "Metro"],
      [140, 118, 132, 176, 154, 121, 500, 149],
    ),
    makeInsight(
      "dense-arabic",
      "توزيع الإيرادات حسب المنطقة — تسميات عربية",
      ["الشمال", "الجنوب", "الشرق", "الغرب", "الوسط", "الساحل", "المرتفعات", "المدينة"],
      [104, 132, 116, 151, 142, 128, 163, 137],
    ),
  ];

  const data: ReportData = {
    fileName: "MIZYA dense PDF QA fixture.csv",
    health: makeHealth(),
    rowCount: 10_000,
    columnCount: 28,
    cleanSteps: [],
    insights,
    date: new Date("2026-11-15T00:00:00"),
    audience: "analyst",
    sections,
    seal: null,
  };

  const root = createRoot(host);
  root.render(React.createElement(ReportDocument, { data }));
  return root;
}
