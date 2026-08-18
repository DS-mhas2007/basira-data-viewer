/**
 * شرح الاستعلام بالعربية — "كيف فكّرت بصيرة؟".
 * تحليل نصي بسيط ومحلي بالكامل (بلا اتصال) لتفكيك SQL إلى خطوات مفهومة.
 */
import { columnLabel } from "@/lib/column-alias";

export interface ExplainStep {
  title: string;
  detail: string;
}

const AGG_LABELS: Record<string, string> = {
  count: "عدد الصفوف",
  sum: "مجموع",
  avg: "متوسط",
  mean: "متوسط",
  min: "أصغر قيمة في",
  max: "أكبر قيمة في",
  median: "وسيط",
};

function clause(sql: string, start: RegExp, stops: RegExp[]): string | null {
  const m = start.exec(sql);
  if (!m) return null;
  const rest = sql.slice(m.index + m[0].length);
  let end = rest.length;
  for (const s of stops) {
    const sm = s.exec(rest);
    if (sm && sm.index < end) end = sm.index;
  }
  return rest.slice(0, end).trim().replace(/;\s*$/, "") || null;
}

function splitTop(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function describeSelectItem(item: string): string {
  const alias = /\s+as\s+([`"\w\u0600-\u06FF]+)\s*$/i.exec(item);
  const expr = alias ? item.slice(0, alias.index).trim() : item.trim();
  const agg = /^(count|sum|avg|mean|min|max|median)\s*\(([^)]*)\)/i.exec(expr);
  if (agg) {
    const fn = AGG_LABELS[agg[1]!.toLowerCase()] ?? agg[1]!;
    const arg = agg[2]!.replace(/["`]/g, "").trim();
    if (/^\*$/.test(arg) || arg === "") return "عدد الصفوف";
    if (/^distinct\s+/i.test(arg))
      return `عدد القيم المميزة في «${columnLabel(arg.replace(/^distinct\s+/i, ""))}»`;
    return `${fn} «${columnLabel(arg)}»`;
  }
  if (expr === "*") return "كل الأعمدة";
  return `«${columnLabel(expr.replace(/["`]/g, ""))}»`;
}

/** يفكك استعلام SELECT إلى خطوات عربية مرتّبة. */
export function explainSql(sqlRaw: string): ExplainStep[] {
  const sql = sqlRaw.replace(/\s+/g, " ").trim();
  if (!sql) return [];
  const steps: ExplainStep[] = [];
  const STOPS = [
    /\bfrom\b/i,
    /\bwhere\b/i,
    /\bgroup\s+by\b/i,
    /\bhaving\b/i,
    /\border\s+by\b/i,
    /\blimit\b/i,
  ];

  if (/^with\b/i.test(sql)) {
    steps.push({
      title: "تحضير جدول مؤقت",
      detail: "بُني جدول وسيط (CTE) لتبسيط الحساب قبل استخراج النتيجة النهائية.",
    });
  }

  const from = clause(sql, /\bfrom\b/i, STOPS.slice(1));
  steps.push({
    title: "مصدر البيانات",
    detail: from
      ? `القراءة من ${from.replace(/["`]/g, "")} — أي نسخة بياناتك بعد خطوات التنظيف المطبّقة.`
      : "القراءة من بياناتك المحمّلة في المتصفح.",
  });

  const select = clause(sql, /\bselect\b/i, STOPS);
  if (select) {
    const items = splitTop(select).map(describeSelectItem);
    steps.push({
      title: "ما الذي تم حسابه",
      detail: items.join("، ") + ".",
    });
  }

  const where = clause(sql, /\bwhere\b/i, STOPS.slice(2));
  if (where) {
    steps.push({
      title: "تصفية الصفوف",
      detail: `استُبعدت الصفوف التي لا تحقق الشرط: ${where}`,
    });
  }

  const group = clause(sql, /\bgroup\s+by\b/i, STOPS.slice(3));
  if (group) {
    const cols = splitTop(group)
      .map((c) => `«${columnLabel(c.replace(/["`]/g, ""))}»`)
      .join("، ");
    steps.push({
      title: "التجميع",
      detail: `جُمعت الصفوف حسب ${cols}، ثم حُسب المؤشر لكل مجموعة على حدة.`,
    });
  }

  const having = clause(sql, /\bhaving\b/i, STOPS.slice(4));
  if (having) {
    steps.push({ title: "تصفية المجموعات", detail: `أُبقيت المجموعات التي تحقق: ${having}` });
  }

  const order = clause(sql, /\border\s+by\b/i, STOPS.slice(5));
  if (order) {
    const dir = /\bdesc\b/i.test(order) ? "تنازلياً (الأعلى أولاً)" : "تصاعدياً (الأقل أولاً)";
    steps.push({
      title: "الترتيب",
      detail: `رُتبت النتائج ${dir} حسب ${order.replace(/\b(asc|desc)\b/gi, "").replace(/["`]/g, "").trim()}.`,
    });
  }

  const limit = clause(sql, /\blimit\b/i, []);
  if (limit) {
    steps.push({ title: "حد النتائج", detail: `عُرضت أول ${limit.trim()} صف فقط لتسهيل القراءة.` });
  }

  return steps;
}
