/**
 * تصدير البيانات بصيغ جدولية (CSV / Excel) — محلي بالكامل داخل المتصفح.
 * يقرأ البيانات من العرض الحالي في DuckDB (أي بعد خطوات التنظيف إن وُجدت).
 */
import { duckdb, TABLE_NAME } from "@/lib/duckdb-service";
import type { HealthReport } from "@/lib/data-health";
import type { CleanStep } from "@/lib/cleaning";
import type { PinnedInsight } from "@/lib/report";
import type { Row } from "@/lib/parse-file";

/** حد أقصى وقائي لعدد الصفوف المُصدَّرة حتى لا يتجمد المتصفح. */
export const EXPORT_ROW_LIMIT = 200_000;

export type DataExportFormat = "csv" | "xlsx";

export interface DataExportMeta {
  id: DataExportFormat;
  label: string;
  description: string;
}

export const DATA_EXPORTS: DataExportMeta[] = [
  { id: "csv", label: "تصدير CSV", description: "البيانات الحالية كملف نصي مفصول بفواصل" },
  { id: "xlsx", label: "تصدير Excel", description: "أوراق: البيانات، الجودة، الاستنتاجات، التنظيف" },
];

function baseName(sourceName: string) {
  return sourceName.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "_").trim() || "بيانات";
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function dataFileName(sourceName: string, ext: DataExportFormat, d = new Date()) {
  return `بصيرة-${baseName(sourceName)}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.${ext}`;
}

function cell(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: Row[]): string {
  const lines = [columns.map(cell).join(",")];
  for (const r of rows) lines.push(columns.map((c) => cell(r[c])).join(","));
  return lines.join("\r\n");
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** يقرأ كل صفوف العرض الحالي (ضمن الحد الوقائي). */
export async function fetchAllRows(table = TABLE_NAME): Promise<Row[]> {
  return duckdb.runSelect(`SELECT * FROM "${table.replace(/"/g, '""')}"`, {
    limit: EXPORT_ROW_LIMIT,
    timeoutMs: 60_000,
  });
}

export interface ExportContext {
  fileName: string;
  columns: string[];
  health: HealthReport | null;
  cleanSteps: CleanStep[];
  insights: PinnedInsight[];
}

export async function exportCsv(ctx: ExportContext) {
  const rows = await fetchAllRows();
  const csv = toCsv(ctx.columns, rows);
  // BOM لضمان قراءة العربية بشكل صحيح في Excel
  downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), dataFileName(ctx.fileName, "csv"));
  return rows.length;
}

export async function exportXlsx(ctx: ExportContext) {
  const XLSX = await import("xlsx");
  const rows = await fetchAllRows();
  const wb = XLSX.utils.book_new();

  const data = XLSX.utils.json_to_sheet(
    rows.map((r) => Object.fromEntries(ctx.columns.map((c) => [c, r[c] ?? null]))),
    { header: ctx.columns },
  );
  XLSX.utils.book_append_sheet(wb, data, "البيانات");

  if (ctx.health) {
    const h = ctx.health;
    const summary = [
      { "المؤشر": "درجة الجودة", "القيمة": h.score },
      { "المؤشر": "عدد الصفوف", "القيمة": h.rowCount },
      { "المؤشر": "عدد الأعمدة", "القيمة": h.columnCount },
      { "المؤشر": "الخلايا المفقودة", "القيمة": h.missingCells },
      { "المؤشر": "نسبة الفقد", "القيمة": `${(h.missingRatio * 100).toFixed(1)}%` },
      { "المؤشر": "الصفوف المكررة", "القيمة": h.duplicateRows },
      { "المؤشر": "أعمدة بأنواع متعارضة", "القيمة": h.mismatchedColumns },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "جودة البيانات");

    const cols = h.columns.map((c) => ({
      "العمود": c.name,
      "النوع": c.type,
      "المفقود": c.nullCount,
      "نسبة الفقد": `${(c.nullRatio * 100).toFixed(1)}%`,
      "قيم مميزة": c.distinctCount,
    }));
    if (cols.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cols), "تفاصيل الأعمدة");
  }

  if (ctx.insights.length) {
    const ins = ctx.insights.map((p) => ({
      "الاستنتاج": p.evidence.title,
      "أهم الأرقام": p.evidence.highlights.map((m) => `${m.label}: ${m.value}`).join(" | "),
      "عدد صفوف النتيجة": p.evidence.resultRowCount,
      "تنبيهات": p.evidence.warnings.join(" | "),
      "SQL": p.evidence.sql,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ins), "الاستنتاجات");
  }

  if (ctx.cleanSteps.length) {
    const steps = ctx.cleanSteps.map((s, i) => ({
      "#": i + 1,
      "العملية": s.label,
      "الصفوف المتأثرة": s.affectedRows,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(steps), "خطوات التنظيف");
  }

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  downloadBlob(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    dataFileName(ctx.fileName, "xlsx"),
  );
  return rows.length;
}
