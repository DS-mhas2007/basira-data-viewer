/**
 * الوحدة 6: أدوات اشتقاق محتوى بطاقة الدليل من خطة الوحدة 4 ونتيجة الاستعلام.
 * لا تنفّذ أي منطق ذكاء اصطناعي — اشتقاق وعرض فقط.
 */
import type { AiPlan } from "@/lib/ai-query.functions";
import type { HealthReport } from "@/lib/data-health";
import { quoteIdent, TABLE_NAME } from "@/lib/duckdb-service";
import { runValidatedQuery, type SchemaRegistry } from "@/lib/sql-validator";
import type { Row } from "@/lib/parse-file";
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

/** عدد الصفوف الأصلية الداخلة في الحساب (بعد الفلاتر وقبل أي LIMIT). */
export async function countBaseRows(sql: string, schema: SchemaRegistry): Promise<number | null> {
  const where = outerWhere(sql);
  const q = `SELECT count(*) AS base_rows FROM ${quoteIdent(TABLE_NAME)}${where ? ` WHERE ${where}` : ""}`;
  try {
    const { result, rows } = await runValidatedQuery(q, schema);
    if (!result.isValid || !rows?.[0]) return null;
    const n = Number(rows[0]["base_rows"]);
    return Number.isFinite(n) ? n : null;
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
