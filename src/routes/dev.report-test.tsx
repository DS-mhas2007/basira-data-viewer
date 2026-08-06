import { createFileRoute } from "@tanstack/react-router";
import { ReportExportButton } from "@/components/ReportExportButton";
import type { PinnedInsight } from "@/lib/report";
import type { HealthReport } from "@/lib/data-health";

export const Route = createFileRoute("/dev/report-test")({ component: Page });

const health: HealthReport = {
  score: 64,
  rowCount: 1240,
  columnCount: 9,
  totalCells: 11160,
  missingCells: 320,
  missingRatio: 0.028,
  duplicateRows: 45,
  duplicateRatio: 0.036,
  mismatchedColumns: 1,
  deductions: { missing: 11.2, duplicates: 10.8, typeMismatch: 3.3 },
  columns: [],
  issues: [
    { id: "1", title: "عمود «المدينة» يحتوي قيماً مفقودة بنسبة 14%", column: "city", affectedRows: 174, severity: "warn", kind: "missing", impact: 3 },
    { id: "2", title: "وجود 45 صفاً مكرراً بالكامل", column: null, affectedRows: 45, severity: "bad", kind: "duplicates", impact: 2 },
    { id: "3", title: "عمود «التاريخ» يخلط بين نص وتاريخ", column: "date", affectedRows: 12, severity: "warn", kind: "type", impact: 1 },
  ],
};

const rows = [
  { city: "الرياض", total: 128400 },
  { city: "جدة", total: 98200 },
  { city: "الدمام", total: 74100 },
  { city: "مكة", total: 52300 },
  { city: "أبها", total: 31900 },
];

const insights: PinnedInsight[] = [
  {
    plan: {
      intent: "ranking",
      title_ar: "أعلى خمس مدن من حيث إجمالي المبيعات خلال 2025",
      sql: "SELECT city, sum(total) AS total FROM dataset WHERE year = 2025 GROUP BY city ORDER BY total DESC LIMIT 5",
      chart: { type: "bar", x: "city", y: ["total"], series: null },
      explanation_plan: [],
      warnings: [],
      needs_clarification: false,
      clarification_question: null,
    },
    rows,
    evidence: {
      id: "a",
      title: "أعلى خمس مدن من حيث إجمالي المبيعات خلال 2025",
      sql: "SELECT ...",
      filters: ["year = 2025", "status <> 'ملغي'"],
      baseRowCount: 1195,
      resultRowCount: 5,
      highlights: [
        { label: "total — الرياض", value: "128,400" },
        { label: "total — جدة", value: "98,200" },
      ],
      warnings: ["عمود «المدينة» المستخدم في هذا الاستنتاج يحتوي 14% قيماً مفقودة — قد يؤثر ذلك على دقة النتيجة."],
    },
  },
  {
    plan: {
      intent: "trend",
      title_ar: "تطوّر المبيعات الشهرية عبر السنة",
      sql: "SELECT month, sum(total) AS total FROM dataset GROUP BY month ORDER BY month",
      chart: { type: "line", x: "city", y: ["total"], series: null },
      explanation_plan: [],
      warnings: [],
      needs_clarification: false,
      clarification_question: null,
    },
    rows,
    evidence: {
      id: "b",
      title: "تطوّر المبيعات الشهرية عبر السنة",
      sql: "SELECT ...",
      filters: [],
      baseRowCount: 1240,
      resultRowCount: 5,
      highlights: [{ label: "total", value: "128,400" }],
      warnings: [],
    },
  },
];

function Page() {
  return (
    <main dir="rtl" className="min-h-screen bg-background p-10">
      <ReportExportButton
        data={{ fileName: "مبيعات-2025.csv", health, rowCount: 1195, columnCount: 9, cleanSteps: [
          { id: "s1", kind: "dedupe", label: "إزالة الصفوف المكررة", affectedRows: 45, params: {} },
        ], insights }}
      />
    </main>
  );
}
