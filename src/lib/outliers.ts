/**
 * كشف القيم الشاذة بقاعدة IQR: خارج [Q1 - 1.5×IQR ، Q3 + 1.5×IQR].
 * تُحسب بالكامل داخل DuckDB باستعلامين (الأرباع ثم العدّ).
 */
import { duckdb, quoteIdent } from "./duckdb-service";

export const OUTLIER_FENCE = 1.5;
export const OUTLIER_MAX_COLUMNS = 20;

export interface OutlierInfo {
  column: string;
  lower: number;
  upper: number;
  count: number;
  /** نسبة الشاذ من القيم غير المفقودة (0–1). */
  ratio: number;
}

export function iqrBounds(q1: number, q3: number, fence = OUTLIER_FENCE): { lower: number; upper: number } | null {
  const iqr = q3 - q1;
  if (!Number.isFinite(iqr) || iqr <= 0) return null;
  return { lower: q1 - fence * iqr, upper: q3 + fence * iqr };
}

export function buildQuartilesSql(from: string, columns: string[]): string {
  const parts = columns.flatMap((c, i) => [
    `quantile_cont(CAST(${quoteIdent(c)} AS DOUBLE), 0.25) AS q1_${i}`,
    `quantile_cont(CAST(${quoteIdent(c)} AS DOUBLE), 0.75) AS q3_${i}`,
  ]);
  return `SELECT ${parts.join(", ")} FROM (${from}) _s`;
}

export function buildOutlierCountSql(
  from: string,
  items: { column: string; lower: number; upper: number }[],
): string {
  const parts = items.flatMap((it, i) => {
    const x = `CAST(${quoteIdent(it.column)} AS DOUBLE)`;
    return [
      `sum(CASE WHEN ${x} < ${it.lower} OR ${x} > ${it.upper} THEN 1 ELSE 0 END)::BIGINT AS o_${i}`,
      `count(${x})::BIGINT AS n_${i}`,
    ];
  });
  return `SELECT ${parts.join(", ")} FROM (${from}) _s`;
}

/** يعيد الأعمدة الرقمية التي فيها قيم شاذة (مرتبة بنسبة الشذوذ). */
export async function detectOutliers(from: string, numericColumns: string[]): Promise<OutlierInfo[]> {
  const cols = numericColumns.slice(0, OUTLIER_MAX_COLUMNS);
  if (cols.length === 0) return [];
  const qRow = (await duckdb.runSelect(buildQuartilesSql(from, cols), { limit: 1 }))[0] ?? {};
  const items = cols.flatMap((column, i) => {
    const b = iqrBounds(Number(qRow[`q1_${i}`]), Number(qRow[`q3_${i}`]));
    return b ? [{ column, ...b }] : [];
  });
  if (items.length === 0) return [];
  const cRow = (await duckdb.runSelect(buildOutlierCountSql(from, items), { limit: 1 }))[0] ?? {};
  return items
    .map((it, i) => {
      const count = Number(cRow[`o_${i}`] ?? 0);
      const n = Number(cRow[`n_${i}`] ?? 0);
      return { column: it.column, lower: it.lower, upper: it.upper, count, ratio: n > 0 ? count / n : 0 };
    })
    .filter((o) => o.count > 0)
    .sort((a, b) => b.ratio - a.ratio);
}

export function formatBound(v: number): string {
  return Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
}
