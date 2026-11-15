/**
 * قاموس البيانات: وصف عربي تلقائي لكل عمود (النوع، الدور، الاكتمال، أمثلة، ملاحظات جودة).
 * يُحسب محلياً من تقرير الصحة + استعلامات خفيفة، بلا ذكاء اصطناعي.
 */
import { duckdb, quoteIdent } from "@/lib/duckdb-service";
import type { ColumnHealth, HealthReport } from "@/lib/data-health";
import { isDateColumn } from "@/lib/profile";
import { isIdName, measureScore } from "@/lib/templates";

export type ColumnRole = "id" | "date" | "amount" | "number" | "category" | "text";

export const ROLE_LABEL: Record<ColumnRole, string> = {
  id: "معرّف",
  date: "تاريخ",
  amount: "مبلغ / قيمة",
  number: "رقم",
  category: "فئة",
  text: "نص حر",
};

export interface ColumnExtra {
  examples: string[];
  dateMin?: string | null;
  dateMax?: string | null;
}

export interface DictionaryEntry {
  name: string;
  type: string;
  role: ColumnRole;
  roleLabel: string;
  /** نسبة الاكتمال 0–100. */
  filled: number;
  distinct: number;
  description: string;
  examples: string[];
  notes: string[];
}

export function classifyColumn(col: ColumnHealth, rows: number): ColumnRole {
  const uniqueRatio = rows > 0 ? col.distinctCount / rows : 0;
  if (isDateColumn(col.type, col.name)) return "date";
  if (col.isNumeric) {
    if (isIdName(col.name) && uniqueRatio > 0.9) return "id";
    return measureScore(col.name) >= 2 ? "amount" : "number";
  }
  if (isIdName(col.name) || (rows > 20 && uniqueRatio >= 0.95)) return "id";
  if (col.distinctCount <= 20 || uniqueRatio <= 0.05) return "category";
  return "text";
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function describe(col: ColumnHealth, role: ColumnRole, extra: ColumnExtra | undefined): string {
  switch (role) {
    case "id":
      return "معرّف أو قيمة فريدة تقريباً لكل صف — يصلح للربط والتتبّع لا للتجميع.";
    case "date":
      return extra?.dateMin && extra?.dateMax
        ? `تاريخ يمتد من ${extra.dateMin} إلى ${extra.dateMax}.`
        : "عمود زمني يصلح لتتبّع التغيّر عبر الوقت.";
    case "amount":
    case "number":
      return col.min !== null && col.max !== null
        ? `${role === "amount" ? "قيمة مالية أو كمية رئيسية" : "قيمة رقمية"} بين ${fmt(col.min)} و${fmt(col.max)}${col.median !== null ? ` (الوسيط ${fmt(col.median)})` : ""}.`
        : "قيمة رقمية.";
    case "category":
      return `فئة تتكرر قيمها (${col.distinctCount.toLocaleString("en-US")} قيمة مختلفة) — تصلح للتجميع والمقارنة.`;
    default:
      return `نص حر متنوّع (${col.distinctCount.toLocaleString("en-US")} قيمة مختلفة).`;
  }
}

export function buildDictionary(
  health: HealthReport,
  extras: Record<string, ColumnExtra> = {},
): DictionaryEntry[] {
  return health.columns.map((col) => {
    const role = classifyColumn(col, health.rowCount);
    const extra = extras[col.name];
    const notes: string[] = [];
    if (col.nullRatio > 0.02) notes.push(`${Math.round(col.nullRatio * 100)}% من القيم مفقودة`);
    if (col.typeMismatchCount > 0)
      notes.push(
        `${col.typeMismatchCount.toLocaleString("en-US")} قيمة نصية داخل عمود يبدو رقمياً`,
      );
    if (col.distinctCount === 1 && health.rowCount > 1)
      notes.push("قيمة واحدة ثابتة — لا تفيد في التحليل");
    return {
      name: col.name,
      type: col.type,
      role,
      roleLabel: ROLE_LABEL[role],
      filled: Math.round((1 - col.nullRatio) * 100),
      distinct: col.distinctCount,
      description: describe(col, role, extra),
      examples: extra?.examples ?? [],
      notes,
    };
  });
}

/** أمثلة شائعة (للفئات والنصوص) وحدود التواريخ — استعلام خفيف لكل عمود. */
export async function fetchDictionaryExtras(
  table: string,
  health: HealthReport,
): Promise<Record<string, ColumnExtra>> {
  const out: Record<string, ColumnExtra> = {};
  const t = quoteIdent(table);
  for (const col of health.columns.slice(0, 60)) {
    const c = quoteIdent(col.name);
    const role = classifyColumn(col, health.rowCount);
    try {
      if (role === "date") {
        const [r] = await duckdb.runSelect(
          `SELECT regexp_replace(CAST(min(${c}) AS VARCHAR), ' 00:00:00$', '') AS a, regexp_replace(CAST(max(${c}) AS VARCHAR), ' 00:00:00$', '') AS b FROM ${t}`,
          { limit: 1 },
        );
        out[col.name] = {
          examples: [],
          dateMin: r?.["a"] == null ? null : String(r["a"]),
          dateMax: r?.["b"] == null ? null : String(r["b"]),
        };
      } else if (role === "category" || role === "text") {
        const rows = await duckdb.runSelect(
          `SELECT CAST(${c} AS VARCHAR) AS v FROM ${t} WHERE ${c} IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 3`,
          { limit: 3 },
        );
        out[col.name] = { examples: rows.map((r) => String(r["v"] ?? "").slice(0, 40)) };
      } else if (role === "id") {
        const rows = await duckdb.runSelect(
          `SELECT CAST(${c} AS VARCHAR) AS v FROM ${t} WHERE ${c} IS NOT NULL LIMIT 2`,
          { limit: 2 },
        );
        out[col.name] = { examples: rows.map((r) => String(r["v"] ?? "").slice(0, 40)) };
      }
    } catch {
      /* عمود يتعذّر استعلامه: نكتفي بالوصف العام */
    }
  }
  return out;
}

function esc(v: string) {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV مع BOM ليفتح العربي سليماً في Excel. */
export function dictionaryToCsv(entries: DictionaryEntry[]): string {
  const head = [
    "العمود",
    "النوع",
    "الدور",
    "الاكتمال %",
    "قيم مختلفة",
    "الوصف",
    "أمثلة",
    "ملاحظات",
  ];
  const lines = entries.map((e) =>
    [
      e.name,
      e.type,
      e.roleLabel,
      String(e.filled),
      String(e.distinct),
      e.description,
      e.examples.join(" | "),
      e.notes.join(" | "),
    ]
      .map(esc)
      .join(","),
  );
  return "﻿" + [head.map(esc).join(","), ...lines].join("\r\n");
}

export function dictionaryToMarkdown(entries: DictionaryEntry[], title = "قاموس البيانات"): string {
  const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const rows = entries.map(
    (e) =>
      `| ${cell(e.name)} | ${cell(e.type)} | ${e.roleLabel} | ${e.filled}% | ${cell(e.description)} | ${cell(e.examples.join("، "))} | ${cell(e.notes.join("؛ "))} |`,
  );
  return [
    `## ${title}`,
    "",
    "| العمود | النوع | الدور | الاكتمال | الوصف | أمثلة | ملاحظات |",
    "|---|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}
