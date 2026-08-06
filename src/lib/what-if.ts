/**
 * محاكي "ماذا لو؟": يحسب خط الأساس مرة واحدة عبر SQL محلي،
 * ثم يعيد حساب المؤشرات والرسوم والملخص فورياً (بلا استعلام) عند تحريك الشرائط.
 */
import { duckdb, quoteIdent, type TableInfo } from "@/lib/duckdb-service";
import { formatNumber, isDateColumn, isNumericType } from "@/lib/profile";

/** عامل قابل للتغيير بنسبة مئوية. */
export interface WhatIfDriver {
  column: string;
  /** مجموع القيم في خط الأساس. */
  sum: number;
  /** متوسط القيم في خط الأساس. */
  avg: number;
  /** عدد القيم غير الفارغة. */
  count: number;
}

export interface WhatIfBreakdown {
  /** اسم العمود الفئوي أو الزمني المستخدم للتقسيم. */
  column: string;
  /** الشرائح مرتّبة تنازلياً حسب مساهمتها في المقياس الأساسي. */
  slices: { label: string; value: number }[];
  /** هل التقسيم زمني (لعرضه كخط بدل أعمدة). */
  temporal: boolean;
}

export interface WhatIfBaseline {
  table: string;
  rowCount: number;
  drivers: WhatIfDriver[];
  /** عمود الإيراد المشتق (سعر × كمية) إن وُجد. */
  derived: { label: string; value: number; parts: string[] } | null;
  breakdown: WhatIfBreakdown | null;
  /** العمود الأساسي المستخدم في التقسيم والرسوم. */
  primary: string | null;
}

export interface WhatIfMetric {
  label: string;
  hint: string;
  base: number;
  next: number;
  deltaPct: number;
  /** true إذا كان المؤشر متوسطاً (لا مجموعاً). */
  average?: boolean;
}

export interface WhatIfResult {
  metrics: WhatIfMetric[];
  chart: { label: string; base: number; next: number }[];
  temporal: boolean;
  summary: string;
}

const PRICE_RE = /(price|amount|revenue|total|cost|value|سعر|قيمة|مبلغ|إيراد|تكلفة)/i;
const QTY_RE = /(qty|quantity|units|count|عدد|كمية)/i;

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

async function rows(sql: string, limit = 1) {
  try {
    return await duckdb.runSelect(sql, { limit });
  } catch {
    return [];
  }
}

/** يبني خط الأساس عبر استعلامات SQL محلية (مرة واحدة لكل مصدر بيانات). */
export async function buildWhatIfBaseline(info: TableInfo): Promise<WhatIfBaseline | null> {
  const t = quoteIdent(info.table);
  const numeric = info.schema.filter(
    (c) => isNumericType(c.type) && !isDateColumn(c.type, c.name),
  );
  if (numeric.length === 0) return null;

  // نرتّب الأعمدة الرقمية: أعمدة السعر/الكمية أولاً لأنها الأكثر دلالة على الأعمال.
  const ranked = [...numeric].sort((a, b) => {
    const score = (name: string) => (PRICE_RE.test(name) ? 2 : QTY_RE.test(name) ? 1 : 0);
    return score(b.name) - score(a.name);
  });
  const picked = ranked.slice(0, 4);

  const aggSql = picked
    .map(
      (c, i) =>
        `sum(${quoteIdent(c.name)})::DOUBLE AS s${i}, avg(${quoteIdent(c.name)})::DOUBLE AS a${i},
         count(${quoteIdent(c.name)})::BIGINT AS c${i}`,
    )
    .join(", ");
  const [agg] = await rows(`SELECT ${aggSql} FROM ${t}`);
  if (!agg) return null;

  const drivers: WhatIfDriver[] = picked.map((c, i) => ({
    column: c.name,
    sum: n(agg[`s${i}`]),
    avg: n(agg[`a${i}`]),
    count: n(agg[`c${i}`]),
  }));

  // مؤشر مشتق: الإيراد = السعر × الكمية عندما يتوفر العمودان.
  const priceCol = picked.find((c) => PRICE_RE.test(c.name))?.name;
  const qtyCol = picked.find((c) => QTY_RE.test(c.name) && c.name !== priceCol)?.name;
  let derived: WhatIfBaseline["derived"] = null;
  if (priceCol && qtyCol) {
    const [r] = await rows(
      `SELECT sum(${quoteIdent(priceCol)} * ${quoteIdent(qtyCol)})::DOUBLE AS v FROM ${t}`,
    );
    if (r) derived = { label: "إجمالي الإيرادات", value: n(r["v"]), parts: [priceCol, qtyCol] };
  }

  const primary = priceCol ?? picked[0]?.name ?? null;

  // تقسيم: عمود زمني إن وُجد، وإلا أول عمود فئوي منخفض التنوّع.
  let breakdown: WhatIfBreakdown | null = null;
  const dateCol = info.schema.find((c) => isDateColumn(c.type, c.name));
  const catCol = info.schema.find(
    (c) => !isNumericType(c.type) && !isDateColumn(c.type, c.name),
  );
  const groupCol = dateCol?.name ?? catCol?.name ?? null;
  if (primary && groupCol) {
    const g = quoteIdent(groupCol);
    const expr = dateCol
      ? `strftime(CAST(${g} AS TIMESTAMP), '%Y-%m')`
      : `CAST(${g} AS VARCHAR)`;
    const list = await rows(
      `SELECT ${expr} AS k, sum(${quoteIdent(primary)})::DOUBLE AS v
       FROM ${t} WHERE ${g} IS NOT NULL
       GROUP BY 1 ORDER BY ${dateCol ? "1 ASC" : "2 DESC"} LIMIT 8`,
      8,
    );
    if (list.length > 1) {
      breakdown = {
        column: groupCol,
        temporal: !!dateCol,
        slices: list.map((r) => ({ label: String(r["k"] ?? "—"), value: n(r["v"]) })),
      };
    }
  }

  return { table: info.table, rowCount: info.rowCount, drivers, derived, breakdown, primary };
}

function pct(base: number, next: number) {
  if (!Number.isFinite(base) || base === 0) return next === 0 ? 0 : 100;
  return ((next - base) / Math.abs(base)) * 100;
}

/** يطبّق نسب التغيير على خط الأساس فورياً — حساب محلي خالص بلا استعلامات. */
export function simulateWhatIf(
  baseline: WhatIfBaseline,
  deltas: Record<string, number>,
): WhatIfResult {
  const f = (col: string) => 1 + (deltas[col] ?? 0) / 100;

  const metrics: WhatIfMetric[] = baseline.drivers.flatMap((d) => {
    const k = f(d.column);
    return [
      {
        label: `مجموع ${d.column}`,
        hint: "المجموع الكلي للعمود",
        base: d.sum,
        next: d.sum * k,
        deltaPct: pct(d.sum, d.sum * k),
      },
      {
        label: `متوسط ${d.column}`,
        hint: "المتوسط الحسابي",
        base: d.avg,
        next: d.avg * k,
        deltaPct: pct(d.avg, d.avg * k),
        average: true,
      },
    ];
  });

  if (baseline.derived) {
    const k = baseline.derived.parts.reduce((acc, c) => acc * f(c), 1);
    metrics.unshift({
      label: baseline.derived.label,
      hint: baseline.derived.parts.join(" × "),
      base: baseline.derived.value,
      next: baseline.derived.value * k,
      deltaPct: pct(baseline.derived.value, baseline.derived.value * k),
    });
  }

  const primaryK = baseline.primary ? f(baseline.primary) : 1;
  const chart =
    baseline.breakdown?.slices.map((s) => ({
      label: s.label,
      base: s.value,
      next: s.value * primaryK,
    })) ?? [];

  const head = baseline.derived
    ? metrics[0]!
    : metrics.find((m) => !m.average) ?? metrics[0];

  const changed = Object.entries(deltas).filter(([, v]) => Math.abs(v) >= 0.5);
  const changeText = changed
    .map(([c, v]) => `«${c}» ${v > 0 ? "+" : ""}${v.toFixed(0)}%`)
    .join("، ");

  const summary = !head
    ? "لا توجد مؤشرات قابلة للمحاكاة في هذه البيانات."
    : changed.length === 0
      ? "حرّك الشرائط لمعاينة أثر التغيير على مؤشراتك فوراً — الحساب يتم محلياً داخل متصفحك."
      : `عند تغيير ${changeText}، ينتقل «${head.label}» من ${formatNumber(head.base)} إلى ` +
        `${formatNumber(head.next)} أي ${head.deltaPct >= 0 ? "ارتفاع" : "انخفاض"} بنسبة ` +
        `${Math.abs(head.deltaPct).toFixed(1)}%${
          baseline.breakdown
            ? ` — موزّعاً على ${baseline.breakdown.slices.length} شرائح حسب «${baseline.breakdown.column}».`
            : "."
        }`;

  return { metrics, chart, temporal: baseline.breakdown?.temporal ?? false, summary };
}
