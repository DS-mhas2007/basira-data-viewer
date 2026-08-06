/**
 * أدوات تنسيق مخرجات التقرير: تنظيف النصوص، اتجاه النص (RTL/LTR)،
 * تجميل كود SQL، وتصدير ملحقات (.sql / Excel مصغّر).
 */
import type { PinnedInsight } from "@/lib/report";
import type { RankedList } from "@/lib/report-derive";
import { downloadBlob } from "@/lib/data-export";

/** تنظيف قيمة قادمة من CSV/XLSX: إزالة علامات التنصيص الزائدة والمسافات المكررة. */
export function cleanCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  let s = String(v).trim();
  // علامات تنصيص غير مغلقة أو مزدوجة ناتجة عن قراءة CSV
  s = s.replace(/^["'“”«]+/, "").replace(/["'“”»]+$/, "");
  s = s.replace(/""/g, '"').replace(/\s+/g, " ").trim();
  return s.length === 0 ? "—" : s;
}

/** هل النص لاتيني/رقمي بالكامل؟ يُستخدم لتثبيت اتجاه العرض. */
export function isLatin(text: string): boolean {
  return !/[\u0600-\u06FF]/.test(text);
}

/** اتجاه صريح لتفادي انقلاب الأقواس والمسافات في الأسماء المختلطة. */
export function dirOf(text: string): "ltr" | "rtl" {
  return isLatin(text) ? "ltr" : "rtl";
}

const SQL_BREAK = [
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP BY",
  "HAVING",
  "ORDER BY",
  "LIMIT",
  "OFFSET",
  "UNION ALL",
  "UNION",
  "LEFT JOIN",
  "RIGHT JOIN",
  "INNER JOIN",
  "JOIN",
  "ON",
  "WITH",
];

/** تجميل بسيط لكود SQL: سطر لكل جملة رئيسية + مسافات مرتبة (بلا اعتماديات خارجية). */
export function formatSql(sql: string): string {
  if (!sql) return "";
  let s = sql.replace(/\s+/g, " ").trim();
  // لا نكسر داخل النصوص المقتبسة: نقسم على الاقتباسات ونعالج الأجزاء خارجها فقط.
  const parts = s.split(/('(?:[^']|'')*'|"(?:[^"]|"")*")/g);
  s = parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // نص مقتبس كما هو
      let out = part;
      for (const kw of SQL_BREAK) {
        out = out.replace(new RegExp(`\\s*\\b${kw}\\b\\s*`, "gi"), `\n${kw} `);
      }
      out = out.replace(/\s*,\s*/g, ",\n  ");
      return out;
    })
    .join("");
  return s
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim().length > 0)
    .join("\n")
    .trim();
}

/** تلوين تمييزي بسيط: تقسيم السطر إلى أجزاء (كلمة مفتاحية / نص / رقم / عادي). */
export type SqlToken = { text: string; kind: "kw" | "str" | "num" | "plain" };

const KEYWORDS = new Set([
  ...SQL_BREAK.flatMap((k) => k.split(" ")),
  "AS", "AND", "OR", "NOT", "NULL", "CASE", "WHEN", "THEN", "ELSE", "END",
  "COUNT", "SUM", "AVG", "MIN", "MAX", "DISTINCT", "CAST", "DESC", "ASC", "IS", "IN", "BETWEEN",
]);

export function tokenizeSql(line: string): SqlToken[] {
  const out: SqlToken[] = [];
  const re = /('(?:[^']|'')*'|"(?:[^"]|"")*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([\s\S])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m[1]) out.push({ text: m[1], kind: "str" });
    else if (m[2]) out.push({ text: m[2], kind: "num" });
    else if (m[3]) out.push({ text: m[3], kind: KEYWORDS.has(m[3].toUpperCase()) ? "kw" : "plain" });
    else out.push({ text: m[4]!, kind: "plain" });
  }
  return out;
}

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function baseName(sourceName: string) {
  return sourceName.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "_").trim() || "بيانات";
}

/** تصدير كل استعلامات التقرير كملف .sql جاهز للتشغيل خارجياً. */
export function downloadSqlBundle(insights: PinnedInsight[], sourceName: string) {
  const header = [
    "-- استعلامات تقرير بصيرة",
    `-- الملف المصدر: ${sourceName}`,
    `-- تاريخ التصدير: ${stamp()}`,
    "-- ملاحظة: الجدول المرجعي اسمه dataset — استبدله باسم جدولك عند التشغيل خارجياً.",
    "",
  ].join("\n");
  const body = insights
    .map((ins, i) => `-- (${i + 1}) ${ins.evidence.title}\n${formatSql(ins.evidence.sql)};\n`)
    .join("\n");
  downloadBlob(
    new Blob([`${header}\n${body}`], { type: "text/plain;charset=utf-8" }),
    `بصيرة-استعلامات-${baseName(sourceName)}-${stamp()}.sql`,
  );
}

/** تصدير قوائم التوب/الفلوب كملف Excel مصغّر (ورقة لكل قائمة). */
export async function downloadTopBottomXlsx(lists: RankedList[], sourceName: string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  lists.forEach((list, i) => {
    const rows = [
      ...list.top.map((r, idx) => ({ الترتيب: idx + 1, التصنيف: "أفضل", [list.labelCol]: cleanCell(r.label), [list.metricCol]: r.value })),
      ...list.bottom.map((r, idx) => ({ الترتيب: idx + 1, التصنيف: "أسوأ", [list.labelCol]: cleanCell(r.label), [list.metricCol]: r.value })),
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 8 }, { wch: 10 }, { wch: 32 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, `قائمة ${i + 1}`);
  });
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  downloadBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `بصيرة-توب-وفلوب-${baseName(sourceName)}-${stamp()}.xlsx`,
  );
}
