/**
 * الوحدة 6: أدوات اشتقاق محتوى بطاقة الدليل من خطة الوحدة 4 ونتيجة الاستعلام.
 * لا تنفّذ أي منطق ذكاء اصطناعي — اشتقاق وعرض فقط.
 */
import type { AiPlan } from "@/lib/ai-query.functions";
import type { HealthReport } from "@/lib/data-health";
import { quoteIdent, TABLE_NAME } from "@/lib/duckdb-service";
import { runValidatedQuery, type SchemaRegistry } from "@/lib/sql-validator";
import type { Row } from "@/lib/parse-file";
import { scanSql } from "@/lib/sql-tokenize";
import type { HighlightMetric } from "@/components/EvidenceCard";

/** نسبة القيم المفقودة التي تستدعي تحذيراً تلقائياً على أعمدة الاستعلام. */
export const EVIDENCE_MISSING_THRESHOLD = 0.1;

function outerWhere(sql: string): string | null {
  const lower = sql.toLowerCase();
  let depth = 0;
  let start = -1;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0 && start === -1 && lower.startsWith("where", i) && /\s/.test(sql[i - 1] ?? " ")) {
      start = i + 5;
    } else if (depth === 0 && start !== -1) {
      for (const kw of ["group by", "order by", "having", "limit", "window", "qualify"]) {
        if (lower.startsWith(kw, i)) return sql.slice(start, i).trim();
      }
    }
  }
  return start === -1 ? null : sql.slice(start).trim();
}

/** يستخرج شروط WHERE كوسوم صغيرة (chips). */
export function extractFilters(sql: string): string[] {
  const where = outerWhere(sql);
  if (!where) return [];
  const parts: string[] = [];
  let depth = 0;
  let buf = "";
  const lower = where.toLowerCase();
  for (let i = 0; i < where.length; i++) {
    const ch = where[i]!;
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && lower.startsWith(" and ", i)) {
      parts.push(buf.trim());
      buf = "";
      i += 4;
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts.filter(Boolean).slice(0, 6);
}

/**
 * لا نعرض عدد الصفوف إلا لاستعلام مسح بسيط لجدول المصدر دون شروط أو عمليات مركبة.
 * في غير ذلك لا يمكن استنتاج عدد صفوف الإدخال بأمان من تحليل نص SQL محدود.
 */
export function isSimpleBaseScan(sql: string): boolean {
  const scanned = scanSql(sql);
  if (!scanned.ok) return false;
  const skeleton = scanned.skeleton.trim().replace(/;+\s*$/, "").trim();
  const simpleScan =
    /^\s*select\s+(?:\*|(?:"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)(?:\s*,\s*(?:"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*))*)\s+from\s+(?:"dataset"|dataset)(?:\s+limit\s+\d+)?\s*$/i;
  return simpleScan.test(skeleton);
}

/** عدد صفوف المصدر لاستعلام بسيط غير مفلتر فقط؛ وإلا نعيد null بدلاً من رقم مضلل. */
export async function countBaseRows(sql: string, schema: SchemaRegistry): Promise<number | null> {
  if (!isSimpleBaseScan(sql)) return null;
  const q = "SELECT count(*) AS base_rows FROM " + quoteIdent(TABLE_NAME);
  try {
    const { result, rows } = await runValidatedQuery(q, schema);
    if (!result.isValid || !rows?.[0]) return null;
    const n = Number(rows[0]["base_rows"]);
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function fmt(v: unknown): string {
  const n = Number(v);
  if (v !== null && v !== "" && Number.isFinite(n)) {
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return v === null || v === undefined ? "—" : String(v);
}

/** هل القيمة رقم صالح فعلاً (وليست سلسلة فارغة أو منطقية)؟ */
function isNumericValue(v: unknown): boolean {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return false;
  if (v instanceof Date) return false;
  return Number.isFinite(Number(v));
}

/** أعمدة تُستخدم كسياق (بُعد) لا كقيمة: سنة/تاريخ/معرّف. */
function looksLikeDimension(name: string, v: unknown): boolean {
  const n = name.toLowerCase();
  if (/(^|[^a-z])(year|yr|date|month|day|time|سنة|السنة|عام|تاريخ|شهر)([^a-z]|$)/.test(n)) return true;
  if (v instanceof Date) return true;
  const num = Number(v);
  // قيمة صحيحة ضمن مدى السنوات مع اسم عمود يوحي بالزمن/المعرّف
  if (Number.isInteger(num) && num >= 1900 && num <= 2100 && /(id|code|رقم)$/.test(n)) return true;
  return false;
}

/**
 * يختار أبرز رقم/رقمين من نتيجة الاستعلام.
 * لا نثق بترتيب chart.x / chart.y القادم من النموذج: نستخدمه كترجيح فقط،
 * والقرار النهائي مبني على النوع الفعلي لقيم الصف الأول.
 */
export function pickHighlights(plan: AiPlan, rows: Row[]): HighlightMetric[] {
  if (rows.length === 0) return [];
  const first = rows[0]!;
  const keys = Object.keys(first);

  const numericKeys = keys.filter((k) => isNumericValue(first[k]));
  const dimensionKeys = keys.filter((k) => !numericKeys.includes(k) || looksLikeDimension(k, first[k]));
  const measureKeys = numericKeys.filter((k) => !dimensionKeys.includes(k));

  // مرشحو القياس: الأعمدة الرقمية غير الزمنية أولاً، وإلا نعود للأعمدة الرقمية كلها.
  const pool = measureKeys.length > 0 ? measureKeys : numericKeys;
  const preferred = plan.chart.y.filter((k) => pool.includes(k));
  const metrics = (preferred.length > 0 ? preferred : pool).slice(0, 2);
  if (metrics.length === 0) return [];

  // السياق: عمود x إن كان بُعداً فعلياً، وإلا أول عمود بُعد متاح.
  const xKey = plan.chart.x && keys.includes(plan.chart.x) ? plan.chart.x : null;
  const contextKey =
    xKey && !metrics.includes(xKey) ? xKey : (dimensionKeys.find((k) => !metrics.includes(k)) ?? null);
  const context = contextKey ? String(first[contextKey] ?? "") : null;

  // ضمان: صف واحد ومقياس واحد — القيمة يجب أن تكون رقماً صالحاً فعلاً.
  if (rows.length === 1 && metrics.length === 1 && !isNumericValue(first[metrics[0]!])) return [];

  return metrics.map((k) => ({
    value: fmt(first[k]),
    label: context ? `${k} — ${context}` : k,
  }));
}

export interface SourceColumnQuality {
  name: string;
  type: string;
  nullCount: number;
  nullRatio: number;
  /** عدد القيم غير الفارغة التي فشل تحويلها إلى النوع المطلوب، على كامل المصدر. */
  castFailureCount?: number;
  castCheckedCount?: number;
  castTarget?: "DATE" | "TIMESTAMP";
}

/**
 * يحدد أعمدة المصدر المذكورة فعلياً في SQL ويُلحق إحصاءات النقص من تقرير الصحة.
 * لا نحاول استنتاج عدد الصفوف المستبعدة من WHERE؛ فهذا يتطلب إعادة تنفيذ الاستعلام بمنطق مطابق.
 */
export function getSourceColumnQuality(
  sql: string,
  health: HealthReport | null,
): SourceColumnQuality[] {
  if (!health) return [];
  const scanned = scanSql(sql);
  if (!scanned.ok) return [];
  const skeleton = scanned.skeleton;
  return health.columns
    .filter((col) => {
      const quoted = skeleton.includes(`"${col.name.replace(/"/g, '""')}"`);
      const bare = /^[A-Za-z_][A-Za-z0-9_$]*$/.test(col.name)
        ? new RegExp(`(?<![A-Za-z0-9_$])${col.name}(?![A-Za-z0-9_$])`, "i")
        : null;
      return quoted || Boolean(bare?.test(skeleton));
    })
    .map((col) => ({
      name: col.name,
      type: col.type,
      nullCount: col.nullCount,
      nullRatio: col.nullRatio,
    }));
}

/**
 * يلتقط تحويلات التاريخ الصريحة فقط. لا نستنتج التحويلات من أسماء الأعمدة أو من CAST عام.
 * يقبل عموداً مباشراً بلا qualifier، ونوع DATE أو TIMESTAMP فقط.
 */
export function extractDateTryCasts(sql: string): { column: string; target: "DATE" | "TIMESTAMP" }[] {
  const scanned = scanSql(sql);
  if (!scanned.ok) return [];
  const pattern = /TRY_CAST\\s*\\(\\s*("(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)\\s+AS\\s+(DATE|TIMESTAMP)\\s*\\)/gi;
  const found = new Map<string, "DATE" | "TIMESTAMP">();
  for (const match of scanned.skeleton.matchAll(pattern)) {
    const raw = match[1]!;
    const column = raw.startsWith('"') ? raw.slice(1, -1).replace(/""/g, '"') : raw;
    found.set(column, match[2]!.toUpperCase() as "DATE" | "TIMESTAMP");
  }
  return [...found].map(([column, target]) => ({ column, target }));
}

/**
 * يحسب فشل تحويل التاريخ على مستوى العمود في كامل جدول المصدر، وليس الصفوف التي
 * استبعدها الاستعلام. لا يعمل إلا مع أعمدة VARCHAR وتحويلات TRY_CAST الصريحة.
 */
export async function addDateCastQuality(
  sql: string,
  columns: SourceColumnQuality[],
  schema: SchemaRegistry,
): Promise<SourceColumnQuality[]> {
  const casts = extractDateTryCasts(sql);
  if (casts.length === 0 || columns.length === 0) return columns;
  const out = [...columns];
  for (const cast of casts) {
    const index = out.findIndex((col) => col.name === cast.column && /^(VARCHAR|TEXT|STRING)$/i.test(col.type));
    if (index < 0) continue;
    const identifier = quoteIdent(cast.column);
    const expression = `TRY_CAST(${identifier} AS ${cast.target})`;
    const query = `SELECT COUNT(*) AS checked_count, SUM(CASE WHEN ${expression} IS NULL THEN 1 ELSE 0 END) AS failure_count FROM ${quoteIdent(TABLE_NAME)} WHERE ${identifier} IS NOT NULL AND TRIM(CAST(${identifier} AS VARCHAR)) <> ''`;
    try {
      const { result, rows } = await runValidatedQuery(query, schema);
      if (!result.isValid || !rows?.[0]) continue;
      const checked = Number(rows[0]["checked_count"]);
      const failures = Number(rows[0]["failure_count"] ?? 0);
      if (!Number.isSafeInteger(checked) || checked < 0 || !Number.isSafeInteger(failures) || failures < 0 || failures > checked) continue;
      out[index] = { ...out[index]!, castCheckedCount: checked, castFailureCount: failures, castTarget: cast.target };
    } catch {
      // لا نُظهر رقماً عند فشل الفحص؛ بيانات الجودة الإضافية اختيارية.
    }
  }
  return out;
}

/** تحذيرات النموذج + تحذير تلقائي من تقرير صحة البيانات (الوحدة 3). */
export function buildWarnings(
  plan: AiPlan,
  health: HealthReport | null,
  usedColumns: string[],
): string[] {
  const out = [...plan.warnings];
  if (!health) return out;
  const sqlLower = plan.sql.toLowerCase();
  for (const col of health.columns) {
    const used =
      usedColumns.includes(col.name) || sqlLower.includes(col.name.toLowerCase());
    if (used && col.nullRatio > EVIDENCE_MISSING_THRESHOLD) {
      out.push(
        `عمود «${col.name}» المستخدم في هذا الاستنتاج يحتوي ${Math.round(col.nullRatio * 100)}% قيماً مفقودة — قد يؤثر ذلك على دقة النتيجة.`,
      );
    }
  }
  return out;
}
