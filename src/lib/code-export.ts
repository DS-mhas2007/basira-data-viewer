/**
 * تصدير الكود: إعادة إنتاج نفس المعالجة والتحليل خارج بصيرة.
 * - Python (pandas + duckdb)
 * - SQL موحّد (خطوات التنظيف + استعلامات الاستنتاجات)
 * كل شيء يُولَّد محلياً في المتصفح؛ لا تُرسل أي بيانات.
 */
import { buildRelation, type CleanStep } from "@/lib/cleaning";
import { downloadBlob } from "@/lib/data-export";
import type { PinnedInsight } from "@/lib/report";

export type CodeFormat = "python" | "sql";

export interface CodeExportMeta {
  id: CodeFormat;
  label: string;
  description: string;
}

export const CODE_EXPORTS: CodeExportMeta[] = [
  {
    id: "python",
    label: "تصدير كود Python",
    description: "سكربت pandas + duckdb يعيد إنتاج التنظيف والاستعلامات",
  },
  {
    id: "sql",
    label: "تصدير كود SQL",
    description: "ملف واحد يجمع خطوات التنظيف واستعلامات الاستنتاجات",
  },
];

export interface CodeExportContext {
  fileName: string;
  cleanSteps: CleanStep[];
  insights: PinnedInsight[];
}

function pyString(v: string) {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function stamp(d = new Date()) {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function relation(steps: CleanStep[]) {
  return buildRelation(steps) ?? "SELECT * FROM dataset__source";
}

export function buildSqlScript(ctx: CodeExportContext): string {
  const lines: string[] = [
    "-- بصيرة | كود SQL مُولَّد تلقائياً",
    `-- الملف المصدر: ${ctx.fileName}`,
    `-- تاريخ التوليد: ${stamp()}`,
    "-- المحرك: DuckDB (يعمل أيضاً مع أي محرك SQL متوافق بعد تعديل بسيط)",
    "",
    "-- 1) حمّل ملفك الخام كجدول باسم dataset__source، مثال في DuckDB:",
    `-- CREATE TABLE dataset__source AS SELECT * FROM read_csv_auto('${ctx.fileName}');`,
    "",
    "-- 2) طبقة التنظيف (غير تدميرية: الجدول الخام يبقى كما هو)",
  ];
  if (ctx.cleanSteps.length === 0) {
    lines.push("-- لم تُطبَّق أي خطوة تنظيف على هذه البيانات.");
  } else {
    ctx.cleanSteps.forEach((s, i) => lines.push(`-- خطوة ${i + 1}: ${s.label} (صفوف متأثرة: ${s.affectedRows})`));
  }
  lines.push("", "CREATE OR REPLACE VIEW dataset AS", relation(ctx.cleanSteps) + ";", "");
  lines.push("-- 3) استعلامات الاستنتاجات");
  if (ctx.insights.length === 0) {
    lines.push("-- لا توجد استنتاجات مثبّتة بعد.");
  } else {
    ctx.insights.forEach((p, i) => {
      lines.push("", `-- (${i + 1}) ${p.evidence.title}`);
      p.evidence.filters.forEach((f) => lines.push(`--    فلتر: ${f}`));
      lines.push(p.evidence.sql.trim().replace(/;?\s*$/, ";"));
    });
  }
  return lines.join("\n") + "\n";
}

export function buildPythonScript(ctx: CodeExportContext): string {
  const rel = relation(ctx.cleanSteps);
  const queries = ctx.insights
    .map(
      (p, i) =>
        `    (${pyString(`${i + 1}. ${p.evidence.title}`)}, """\n${p.evidence.sql.trim().replace(/"""/g, '"')}\n"""),`,
    )
    .join("\n");
  const stepComments =
    ctx.cleanSteps.length === 0
      ? "# لم تُطبَّق أي خطوة تنظيف."
      : ctx.cleanSteps
          .map((s, i) => `# خطوة ${i + 1}: ${s.label} (صفوف متأثرة: ${s.affectedRows})`)
          .join("\n");

  return `# -*- coding: utf-8 -*-
"""
بصيرة | سكربت Python مُولَّد تلقائياً
الملف المصدر: ${ctx.fileName}
تاريخ التوليد: ${stamp()}

المتطلبات:
    pip install pandas duckdb openpyxl
التشغيل:
    python basira_analysis.py
"""

from pathlib import Path

import duckdb
import pandas as pd

SOURCE = Path(${pyString(ctx.fileName)})


def load_dataframe(path: Path) -> pd.DataFrame:
    """قراءة الملف الخام كما تقرأه بصيرة (CSV أو Excel)."""
    if path.suffix.lower() in {".xlsx", ".xls"}:
        return pd.read_excel(path)
    return pd.read_csv(path, encoding="utf-8-sig")


def main() -> None:
    df = load_dataframe(SOURCE)
    con = duckdb.connect()
    con.register("dataset__source", df)

    # ---- طبقة التنظيف (نفس منطق بصيرة، غير تدميرية) ----
${stepComments
    .split("\n")
    .map((l) => "    " + l)
    .join("\n")}
    con.execute(
        """
        CREATE OR REPLACE VIEW dataset AS
${rel
    .split("\n")
    .map((l) => "        " + l)
    .join("\n")}
        """
    )

    clean = con.execute("SELECT * FROM dataset").fetch_df()
    print(f"صفوف بعد التنظيف: {len(clean):,}")
    clean.to_csv("basira_clean.csv", index=False, encoding="utf-8-sig")

    # ---- استعلامات الاستنتاجات ----
    queries = [
${queries || "        # لا توجد استنتاجات مثبّتة بعد."}
    ]
    for title, sql in queries:
        print("\\n=== " + title + " ===")
        print(con.execute(sql).fetch_df().to_string(index=False))


if __name__ == "__main__":
    main()
`;
}

function baseName(sourceName: string) {
  return sourceName.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "_").trim() || "basira";
}

export function downloadCode(format: CodeFormat, ctx: CodeExportContext) {
  const isPy = format === "python";
  const text = isPy ? buildPythonScript(ctx) : buildSqlScript(ctx);
  downloadBlob(
    new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" }),
    `basira-${baseName(ctx.fileName)}.${isPy ? "py" : "sql"}`,
  );
}
