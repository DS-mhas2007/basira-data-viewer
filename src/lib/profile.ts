/**
 * الوحدة 9: التوصيف التلقائي (Auto Profiling).
 * يبني لوحة ملخص بصري من البيانات مباشرة عبر SQL على DuckDB — بلا أي استدعاء AI.
 */
import { duckdb, quoteIdent, type TableInfo } from "@/lib/duckdb-service";

const DATE_RE = /(date|time|year|month|day|يوم|تاريخ|سنة|شهر)/i;

export function isNumericType(t: string) {
  return /(INT|DECIMAL|DOUBLE|FLOAT|REAL|NUMERIC|HUGEINT)/i.test(t);
}
export function isDateColumn(t: string, name: string) {
  return /(DATE|TIMESTAMP|TIME)/i.test(t) || DATE_RE.test(name);
}

export interface NumericProfile {
  kind: "numeric";
  column: string;
  min: number;
  max: number;
  avg: number;
  median: number;
  nulls: number;
  histogram: { label: string; count: number }[];
}

export interface CategoricalProfile {
  kind: "categorical";
  column: string;
  distinct: number;
  top: { label: string; count: number }[];
}

export interface TrendProfile {
  kind: "trend";
  column: string;
  points: { label: string; count: number }[];
}

export type ColumnProfile = NumericProfile | CategoricalProfile | TrendProfile;

export interface DatasetProfile {
  rowCount: number;
  cards: ColumnProfile[];
}

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function profileNumeric(table: string, column: string): Promise<NumericProfile | null> {
  const c = quoteIdent(column);
  const t = quoteIdent(table);
  const [stats] = await duckdb.runSelect(
    `SELECT min(${c})::DOUBLE AS mn, max(${c})::DOUBLE AS mx, avg(${c})::DOUBLE AS av,
            median(${c})::DOUBLE AS md, count(*) FILTER (WHERE ${c} IS NULL)::BIGINT AS nulls
     FROM ${t}`,
    { limit: 1 },
  );
  if (!stats) return null;
  const mn = num(stats["mn"]);
  const mx = num(stats["mx"]);
  const buckets = 8;
  let histogram: { label: string; count: number }[] = [];
  if (mx > mn) {
    const width = (mx - mn) / buckets;
    const rows = await duckdb.runSelect(
      `SELECT least(floor((${c} - ${mn}) / ${width}), ${buckets - 1})::INT AS b,
              count(*)::BIGINT AS n
       FROM ${t} WHERE ${c} IS NOT NULL GROUP BY 1 ORDER BY 1`,
      { limit: buckets + 2 },
    );
    const map = new Map(rows.map((r) => [num(r["b"]), num(r["n"])]));
    histogram = Array.from({ length: buckets }, (_, i) => ({
      label: formatNumber(mn + width * i),
      count: map.get(i) ?? 0,
    }));
  }
  return {
    kind: "numeric",
    column,
    min: mn,
    max: mx,
    avg: num(stats["av"]),
    median: num(stats["md"]),
    nulls: num(stats["nulls"]),
    histogram,
  };
}

async function profileCategorical(
  table: string,
  column: string,
): Promise<CategoricalProfile | null> {
  const c = quoteIdent(column);
  const t = quoteIdent(table);
  const [d] = await duckdb.runSelect(
    `SELECT count(DISTINCT ${c})::BIGINT AS n FROM ${t}`,
    { limit: 1 },
  );
  const rows = await duckdb.runSelect(
    `SELECT CAST(${c} AS VARCHAR) AS v, count(*)::BIGINT AS n
     FROM ${t} WHERE ${c} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
    { limit: 8 },
  );
  if (rows.length === 0) return null;
  return {
    kind: "categorical",
    column,
    distinct: num(d?.["n"]),
    top: rows.map((r) => ({ label: String(r["v"] ?? "—"), count: num(r["n"]) })),
  };
}

async function profileTrend(table: string, column: string): Promise<TrendProfile | null> {
  const c = quoteIdent(column);
  const t = quoteIdent(table);
  try {
    const rows = await duckdb.runSelect(
      `SELECT CAST(date_trunc('month', TRY_CAST(${c} AS TIMESTAMP)) AS VARCHAR) AS p,
              count(*)::BIGINT AS n
       FROM ${t} WHERE TRY_CAST(${c} AS TIMESTAMP) IS NOT NULL
       GROUP BY 1 ORDER BY 1 LIMIT 24`,
      { limit: 24 },
    );
    if (rows.length < 2) return null;
    return {
      kind: "trend",
      column,
      points: rows.map((r) => ({
        label: String(r["p"] ?? "").slice(0, 7),
        count: num(r["n"]),
      })),
    };
  } catch {
    return null;
  }
}

export function formatNumber(n: number) {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Number.isInteger(n)) return n.toLocaleString("en-US");
  return n.toFixed(2);
}

/** يبني حتى 6 بطاقات توصيف: أعمدة زمنية ثم رقمية ثم فئوية. */
export async function profileDataset(info: TableInfo): Promise<DatasetProfile> {
  const dates = info.schema.filter((c) => isDateColumn(c.type, c.name)).slice(0, 1);
  const numeric = info.schema
    .filter((c) => isNumericType(c.type) && !isDateColumn(c.type, c.name))
    .slice(0, 3);
  const categorical = info.schema
    .filter((c) => !isNumericType(c.type) && !isDateColumn(c.type, c.name))
    .slice(0, 3);

  const tasks: Promise<ColumnProfile | null>[] = [
    ...dates.map((c) => profileTrend(info.table, c.name)),
    ...numeric.map((c) => profileNumeric(info.table, c.name)),
    ...categorical.map((c) => profileCategorical(info.table, c.name)),
  ];

  const settled = await Promise.allSettled(tasks);
  const cards: ColumnProfile[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value) cards.push(s.value);
  }
  return { rowCount: info.rowCount, cards: cards.slice(0, 6) };
}