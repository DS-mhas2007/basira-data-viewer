/**
 * اكتشافات جاهزة بجمل عربية، تُحسب محلياً بـ DuckDB بلا أي استدعاء للذكاء الاصطناعي
 * (فلا تستهلك من حصة المستخدم ولا ترسل شيئاً خارج المتصفح).
 */
import { duckdb, quoteIdent, type TableInfo } from "@/lib/duckdb-service";
import { formatNumber, isDateColumn, isNumericType } from "@/lib/profile";
import { isIdName, measureScore } from "@/lib/templates";

export type FindingKind = "share" | "trend" | "concentration";

export interface Finding {
  id: string;
  kind: FindingKind;
  /** الجملة الرئيسية. */
  text: string;
  /** سطر داعم صغير. */
  detail: string;
  /** نسبة 0..100 لرسم شريط صغير (اختياري). */
  bar?: number;
  /** اتجاه التغيّر للاتجاهات: +1 ارتفاع، -1 انخفاض. */
  direction?: 1 | -1;
}

/** يعزل مقطعاً لاتينياً/رقمياً داخل جملة عربية حتى لا ينعكس ترتيبه (مثل 2025-11). */
export function ltr(text: string): string {
  return `\u2066${text}\u2069`;
}

export function pct(v: number, digits = 0): string {
  return ltr(`${v.toFixed(digits)}%`);
}

const AVERAGE_LIKE_RE = /(rating|score|age|rank|grade|تقييم|عمر|ترتيب|درجة|معدل)/i;

/** SUM للإجماليات والكميات، و AVG للأسعار والأعمار والتقييمات وما عداها. */
export function aggFor(measure: string): "SUM" | "AVG" {
  if (AVERAGE_LIKE_RE.test(measure)) return "AVG";
  const score = measureScore(measure);
  return score === 3 || score === 0 ? "SUM" : "AVG";
}

const aggWord = (agg: "SUM" | "AVG") => (agg === "SUM" ? "إجمالي" : "متوسط");

export function shareFinding(args: {
  measure: string;
  cat: string;
  agg: "SUM" | "AVG";
  top: { label: string; value: number };
  overall: number;
  groups: number;
}): Finding | null {
  const { measure, cat, agg, top, overall, groups } = args;
  if (groups < 2 || !Number.isFinite(top.value) || !Number.isFinite(overall) || overall === 0) return null;
  if (agg === "SUM") {
    if (top.value <= 0 || overall <= 0) return null;
    const share = (top.value / overall) * 100;
    return {
      id: `share:${cat}:${measure}`,
      kind: "share",
      text: `«${top.label}» هي الأعلى في «${cat}» وتمثل ${pct(share)} من إجمالي «${measure}».`,
      detail: `${ltr(formatNumber(top.value))} من ${ltr(formatNumber(overall))} · ${groups} فئات`,
      bar: Math.min(100, share),
    };
  }
  const diff = ((top.value - overall) / Math.abs(overall)) * 100;
  if (Math.abs(diff) < 1) return null;
  return {
    id: `share:${cat}:${measure}`,
    kind: "share",
    text: `متوسط «${measure}» في «${top.label}» (ضمن «${cat}») أعلى بـ ${pct(Math.abs(diff))} من المتوسط العام.`,
    detail: `${ltr(formatNumber(top.value))} مقابل ${ltr(formatNumber(overall))} · ${groups} فئات`,
  };
}

export function trendFinding(args: {
  measure: string;
  agg: "SUM" | "AVG";
  prev: { label: string; value: number };
  last: { label: string; value: number };
}): Finding | null {
  const { measure, agg, prev, last } = args;
  if (!Number.isFinite(prev.value) || !Number.isFinite(last.value) || prev.value === 0) return null;
  const change = ((last.value - prev.value) / Math.abs(prev.value)) * 100;
  if (Math.abs(change) < 1) return null;
  const up = change > 0;
  return {
    id: `trend:${measure}`,
    kind: "trend",
    text: `${aggWord(agg)} «${measure}» في ${ltr(last.label)} ${up ? "ارتفع" : "انخفض"} بنسبة ${pct(Math.abs(change))} عن ${ltr(prev.label)}.`,
    detail: `${ltr(formatNumber(prev.value))} ← ${ltr(formatNumber(last.value))}`,
    direction: up ? 1 : -1,
  };
}

export function concentrationFinding(args: {
  measure: string;
  cat: string;
  groups: number;
  topGroups: number;
  topShare: number;
}): Finding | null {
  const { measure, cat, groups, topGroups, topShare } = args;
  if (groups < 10 || !Number.isFinite(topShare) || topShare < 50) return null;
  return {
    id: `concentration:${cat}:${measure}`,
    kind: "concentration",
    text: `أعلى ${topGroups} من أصل ${groups} قيمة في «${cat}» (20%) تمثل ${pct(topShare)} من إجمالي «${measure}».`,
    detail: topShare >= 80 ? "تركّز عالٍ: قلة من القيم تحمل معظم الإجمالي" : "الإجمالي متركّز نسبياً في قلة من القيم",
    bar: Math.min(100, topShare),
  };
}

function n(v: unknown): number {
  return typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : Number(v);
}

/** يختار الأعمدة ويحسب حتى 3 اكتشافات. أي فشل جزئي يُتجاهل بصمت. */
export async function computeFindings(info: TableInfo): Promise<Finding[]> {
  const t = quoteIdent(info.table);
  const temporal = (c: { name: string; type: string }) => isDateColumn(c.type, c.name);
  const measures = info.schema
    .filter((c) => isNumericType(c.type) && !temporal(c) && !isIdName(c.name))
    .map((c, i) => ({ c, i }))
    .sort((a, b) => measureScore(b.c.name) - measureScore(a.c.name) || a.i - b.i)
    .map((x) => x.c.name);
  const cats = info.schema
    .filter((c) => !isNumericType(c.type) && !temporal(c) && !isIdName(c.name))
    .map((c) => c.name);
  const dateCol = info.schema.find((c) => /^(DATE|TIMESTAMP)/i.test(c.type))?.name;
  const measure = measures[0];
  const out: Finding[] = [];
  const attempt = async (fn: () => Promise<Finding | null>) => {
    try {
      const f = await fn();
      if (f) out.push(f);
    } catch {
      /* اكتشاف واحد فاشل لا يمنع غيره */
    }
  };
  if (!measure) return out;
  const agg = aggFor(measure);
  const m = quoteIdent(measure);
  const aggSql = (col: string) => (agg === "SUM" ? `sum(${col})` : `avg(${col})`);

  // 1) أعلى فئة
  if (cats[0]) {
    const cat = cats[0];
    const c = quoteIdent(cat);
    await attempt(async () => {
      const rows = await duckdb.runSelect(
        `SELECT CAST(${c} AS VARCHAR) AS label, ${aggSql(m)}::DOUBLE AS v, count(*) OVER ()::BIGINT AS g,
                (SELECT ${aggSql(m)}::DOUBLE FROM ${t}) AS overall
         FROM ${t} WHERE ${c} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`,
        { limit: 1 },
      );
      const r = rows[0];
      if (!r) return null;
      return shareFinding({
        measure,
        cat,
        agg,
        top: { label: String(r["label"]), value: n(r["v"]) },
        overall: n(r["overall"]),
        groups: n(r["g"]),
      });
    });
  }

  // 2) اتجاه آخر شهر مكتمل
  if (dateCol) {
    const d = `CAST(${quoteIdent(dateCol)} AS DATE)`;
    await attempt(async () => {
      const rows = await duckdb.runSelect(
        `WITH mx AS (SELECT max(${d}) AS mx FROM ${t}),
              m AS (SELECT strftime(${d}, '%Y-%m') AS label, ${aggSql(m)}::DOUBLE AS v FROM ${t}
                    WHERE ${quoteIdent(dateCol)} IS NOT NULL GROUP BY 1)
         SELECT label, v,
                (SELECT mx FROM mx) = last_day((SELECT mx FROM mx)) AS complete
         FROM m ORDER BY label DESC`,
        { limit: 4 },
      );
      if (rows.length < 2) return null;
      // الشهر الأخير غير المكتمل يعطي هبوطاً كاذباً، فنتجاوزه
      const usable = rows[0]!["complete"] === false ? rows.slice(1) : rows;
      if (usable.length < 2) return null;
      return trendFinding({
        measure,
        agg,
        last: { label: String(usable[0]!["label"]), value: n(usable[0]!["v"]) },
        prev: { label: String(usable[1]!["label"]), value: n(usable[1]!["v"]) },
      });
    });
  }

  // 3) تركّز القيم (باريتو) لأول فئة بعدد قيم كافٍ — للإجماليات فقط
  if (agg === "SUM") {
    for (const cat of cats.slice(0, 3)) {
      if (out.some((f) => f.kind === "concentration")) break;
      const c = quoteIdent(cat);
      await attempt(async () => {
        const rows = await duckdb.runSelect(
          `WITH g AS (SELECT ${c} AS k, sum(${m})::DOUBLE AS v FROM ${t} WHERE ${c} IS NOT NULL GROUP BY 1),
                r AS (SELECT v, row_number() OVER (ORDER BY v DESC) AS rn, count(*) OVER () AS n FROM g WHERE v > 0)
           SELECT max(n)::BIGINT AS n, ceil(max(n) * 0.2)::BIGINT AS k, sum(v)::DOUBLE AS total,
                  sum(v) FILTER (WHERE rn <= ceil(n * 0.2))::DOUBLE AS top
           FROM r`,
          { limit: 1 },
        );
        const r = rows[0];
        if (!r || !n(r["total"])) return null;
        return concentrationFinding({
          measure,
          cat,
          groups: n(r["n"]),
          topGroups: n(r["k"]),
          topShare: (n(r["top"]) / n(r["total"])) * 100,
        });
      });
    }
  }
  return out.slice(0, 3);
}
