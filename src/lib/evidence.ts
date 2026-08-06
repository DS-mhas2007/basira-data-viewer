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

/** يختار أبرز رقم/رقمين من نتيجة الاستعلام. */
export function pickHighlights(plan: AiPlan, rows: Row[]): HighlightMetric[] {
  if (rows.length === 0) return [];
  const first = rows[0]!;
  const keys = Object.keys(first);
  const x = plan.chart.x && keys.includes(plan.chart.x) ? plan.chart.x : null;
  const numericKeys = keys.filter(
    (k) => k !== x && first[k] !== null && first[k] !== "" && Number.isFinite(Number(first[k])),
  );
  const preferred = plan.chart.y.filter((k) => numericKeys.includes(k));
  const metrics = (preferred.length > 0 ? preferred : numericKeys).slice(0, 2);
  if (metrics.length === 0) return [];

  const context = x ? String(first[x] ?? "") : null;
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
