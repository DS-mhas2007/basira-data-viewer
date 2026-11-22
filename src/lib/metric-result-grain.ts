/** Conservative, independently testable result-Grain verification helpers. */

export interface ResultGrainProbeRow {
  group_count?: unknown;
  duplicate_groups?: unknown;
}

export interface ResultGrainEligibility {
  lineageStatus: "complete" | "partial" | "unsupported";
  hasExplicitLimit: boolean;
  returnedRows: number;
  maxRows: number;
  grainColumns: string[];
}

/** Only verify Grain when the result is complete and its row cap did not truncate it. */
export function canVerifyResultGrain(input: ResultGrainEligibility): boolean {
  return input.lineageStatus === "complete" &&
    !input.hasExplicitLimit &&
    Number.isInteger(input.returnedRows) &&
    input.returnedRows > 0 &&
    Number.isInteger(input.maxRows) &&
    input.maxRows > input.returnedRows &&
    input.grainColumns.length > 0 &&
    input.grainColumns.every((column) => column.trim().length > 0);
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Build a read-only DuckDB probe around a previously validated SELECT.
 * The inner query is not rewritten; only caller-supplied result aliases are quoted.
 */
export function buildResultGrainProbeSql(query: string, grainColumns: string[]): string | null {
  const sql = query.trim().replace(/;+\s*$/, "");
  if (!/^\s*(select|with)\b/i.test(sql) || sql.length > 20_000) return null;
  if (!grainColumns.length || grainColumns.some((column) => !column.trim())) return null;
  const groupBy = grainColumns.map(quoteIdentifier).join(", ");
  return `SELECT COUNT(*) AS group_count, COALESCE(SUM(CASE WHEN "__n" > 1 THEN 1 ELSE 0 END), 0) AS duplicate_groups FROM (SELECT COUNT(*) AS "__n" FROM (${sql}) AS "__metric_result" GROUP BY ${groupBy}) AS "__grain_groups"`;
}

/** A non-empty result with zero duplicate groups proves tuple uniqueness for this query result. */
export function interpretResultGrainProbe(row: ResultGrainProbeRow | undefined): boolean {
  if (!row) return false;
  const groups = Number(row.group_count);
  const duplicates = Number(row.duplicate_groups);
  return Number.isFinite(groups) && groups > 0 &&
    Number.isFinite(duplicates) && duplicates === 0;
}
