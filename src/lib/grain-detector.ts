/** 
 * Dataset-grain diagnostics shared by every file format that is normalized into DuckDB.
 *
 * This module never deletes or rewrites rows. It probes repeated entity keys and
 * numeric measures, then returns evidence-backed warnings for the planner/UI.
 */

export interface GrainColumn {
  name: string;
  type: string;
}

export interface GrainKeyProfileRow {
  column_name: string;
  distinct_values: number;
  non_null_values: number;
  repeated_groups: number;
  max_frequency: number;
}

export interface GrainProbeRow {
  entity_column: string;
  measure_column: string;
  repeated_groups: number;
  repeated_rows: number;
  stable_groups: number;
  variable_groups: number;
}

export interface GrainFinding {
  entityColumn: string;
  measureColumn: string;
  repeatedGroups: number;
  repeatedRows: number;
  stableGroups: number;
  variableGroups: number;
  confidence: "high" | "medium";
  likelyAggregate: boolean;
  hint: string;
}

const KEY_NAME = /(^id$|(?:id|key|code|number|no)$|order.?id|customer.?id|invoice.?id|transaction.?id|رقم|معرف|كود)/i;
const AGGREGATE_NAME = /(total|amount|revenue|sales|balance|subtotal|gross|net|إجمالي|مبلغ|قيمة|مبيعات|رصيد|المجموع)/i;
const NUMERIC_TYPE = /^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT|FLOAT|REAL|DOUBLE|DECIMAL|NUMERIC)/i;

export function quoteGrainIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function buildKeyProfileSql(table: string, schema: GrainColumn[]): string | null {
  // Structural profiling is intentionally bounded: avoid scanning every wide text column.
  const candidates = schema
    .filter((column) =>
      !/DATE|TIME|INTERVAL|JSON|BLOB|GEOMETRY|FLOAT|REAL|DOUBLE|DECIMAL|NUMERIC/i.test(column.type) &&
      /(VARCHAR|TEXT|STRING|CHAR|TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UINTEGER|UBIGINT)/i.test(column.type)
    )
    .slice(0, 30);
  if (candidates.length === 0) return null;

  const source = quoteGrainIdentifier(table);
  const probes = candidates.map((column) => {
    const c = quoteGrainIdentifier(column.name);
    const name = "'" + column.name.replace(/'/g, "''") + "'";
    return "SELECT " + name + " AS column_name, COUNT(*)::BIGINT AS distinct_values, " +
      "COALESCE(SUM(group_rows), 0)::BIGINT AS non_null_values, " +
      "COUNT(*) FILTER (WHERE group_rows > 1)::BIGINT AS repeated_groups, " +
      "COALESCE(MAX(group_rows), 0)::BIGINT AS max_frequency " +
      "FROM (SELECT COUNT(*)::BIGINT AS group_rows FROM " + source +
      " WHERE " + c + " IS NOT NULL GROUP BY CAST(" + c + " AS VARCHAR)) AS value_groups";
  });
  return probes.join("\nUNION ALL\n") + "\nLIMIT 30";
}

/**
 * Infer likely entity columns from full-table cardinality and repetition statistics.
 * Low-cardinality categories are excluded conservatively to avoid treating Status/Region as IDs.
 */
export function inferStructuralKeyCandidates(
  rows: GrainKeyProfileRow[],
  rowCount: number,
): string[] {
  if (rowCount < 10) return [];
  return rows
    .map((row) => {
      const distinct = Number(row.distinct_values ?? 0);
      const nonNull = Number(row.non_null_values ?? 0);
      const repeated = Number(row.repeated_groups ?? 0);
      const maxFrequency = Number(row.max_frequency ?? 0);
      const cardinalityRatio = distinct / Math.max(nonNull, 1);
      const coverage = nonNull / rowCount;
      const eligible =
        distinct >= 5 &&
        cardinalityRatio >= 0.02 &&
        cardinalityRatio <= 0.95 &&
        coverage >= 0.8 &&
        repeated >= 2 &&
        maxFrequency < rowCount * 0.8;
      return {
        name: row.column_name,
        eligible,
        // Prefer columns with more distinct entities, while penalizing null-heavy or near-unique columns.
        score: cardinalityRatio * coverage,
      };
    })
    .filter((candidate) => candidate.eligible)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((candidate) => candidate.name);
}

export function selectGrainCandidates(schema: GrainColumn[], inferredKeyNames: string[] = []) {
  const inferred = new Set(inferredKeyNames);
  const keys = schema
    .filter((column) =>
      (KEY_NAME.test(column.name) || inferred.has(column.name)) &&
      !/DATE|TIME|INTERVAL/i.test(column.type)
    )
    .slice(0, 6);
  const keyNames = new Set(keys.map((column) => column.name));
  const measures = schema
    .filter((column) => NUMERIC_TYPE.test(column.type) && !keyNames.has(column.name) && !KEY_NAME.test(column.name))
    .slice(0, 10);
  return { keys, measures };
}

/**
 * Builds one read-only DuckDB query for all candidate key/measure pairs.
 * Every subquery groups the complete dataset, not the AI preview/sample.
 */
export function buildGrainProbeSql(
  table: string,
  schema: GrainColumn[],
  inferredKeyNames: string[] = [],
): string | null {
  const { keys, measures } = selectGrainCandidates(schema, inferredKeyNames);
  const source = quoteGrainIdentifier(table);
  const probes: string[] = [];

  for (const key of keys) {
    const candidates = measures.filter((measure) => measure.name !== key.name);
    if (candidates.length === 0) continue;
    const k = quoteGrainIdentifier(key.name);
    const names = candidates.map((measure) => "'" + measure.name.replace(/'/g, "''") + "'");
    const values = candidates.map((measure) => "TRY_CAST(" + quoteGrainIdentifier(measure.name) + " AS DOUBLE)");
    probes.push("SELECT '" + key.name.replace(/'/g, "''") + "' AS entity_column, measure_column, " +
      "COUNT(*)::BIGINT AS repeated_groups, COALESCE(SUM(group_rows), 0)::BIGINT AS repeated_rows, " +
      "COUNT(*) FILTER (WHERE distinct_values = 1 AND non_null_values = group_rows)::BIGINT AS stable_groups, " +
      "COUNT(*) FILTER (WHERE distinct_values > 1 OR non_null_values < group_rows)::BIGINT AS variable_groups " +
      "FROM (SELECT measure_column, COUNT(*)::BIGINT AS group_rows, " +
      "COUNT(DISTINCT measure_value)::BIGINT AS distinct_values, COUNT(measure_value)::BIGINT AS non_null_values " +
      "FROM (SELECT CAST(" + k + " AS VARCHAR) AS entity_key, " +
      "UNNEST([" + names.join(", ") + "]) AS measure_column, " +
      "UNNEST([" + values.join(", ") + "]) AS measure_value FROM " + source + " WHERE " + k + " IS NOT NULL) AS expanded " +
      "GROUP BY entity_key, measure_column HAVING COUNT(*) > 1) AS repeated_entities GROUP BY measure_column");
  }

  if (probes.length === 0) return null;
  return probes.join("\nUNION ALL\n") + "\nLIMIT 100";
}

export function interpretGrainProbeRows(rows: GrainProbeRow[]): GrainFinding[] {
  return rows.flatMap((row): GrainFinding[] => {
    const repeatedGroups = Number(row.repeated_groups ?? 0);
    const stableGroups = Number(row.stable_groups ?? 0);
    const variableGroups = Number(row.variable_groups ?? 0);
    const repeatedRows = Number(row.repeated_rows ?? 0);
    if (repeatedGroups < 2 || stableGroups < 2) return [];

    const stableRatio = stableGroups / repeatedGroups;
    if (stableRatio < 0.7) return [];

    const likelyAggregate = AGGREGATE_NAME.test(row.measure_column);
    const confidence: GrainFinding["confidence"] =
      stableRatio >= 0.9 && repeatedGroups >= 3 ? "high" : "medium";
    const hint = likelyAggregate
      ? `تحذير Grain: «${row.measure_column}» يتكرر بقيمة ثابتة داخل ${stableGroups} من ${repeatedGroups} مجموعات «${row.entity_column}». لا تستخدم SUM على مستوى الصفوف قبل التحقق؛ قد يتضخم الإجمالي بسبب تكرار قيمة الكيان.`
      : `ملاحظة Grain: «${row.measure_column}» ثابت داخل ${stableGroups} من ${repeatedGroups} مجموعات «${row.entity_column}». تحقق من مستوى هذا المقياس قبل SUM.`;

    const finding: GrainFinding = {
      entityColumn: row.entity_column,
      measureColumn: row.measure_column,
      repeatedGroups,
      repeatedRows,
      stableGroups,
      variableGroups,
      confidence,
      likelyAggregate,
      hint,
    };
    return [finding];
  }).sort((a, b) =>
    Number(b.likelyAggregate) - Number(a.likelyAggregate) ||
    b.stableGroups - a.stableGroups
  );
}

/** Adds concise, deterministic hints to the relevant key and measure columns. */
export function grainHintsByColumn(findings: GrainFinding[]): Record<string, string> {
  const hints: Record<string, string> = {};
  for (const finding of findings.slice(0, 8)) {
    hints[finding.entityColumn] = [
      hints[finding.entityColumn],
      `مفتاح مرشح لمستوى الكيان؛ ${finding.repeatedGroups} مجموعات بها سجلات متعددة عند فحص «${finding.measureColumn}».`,
    ].filter(Boolean).join(" ");
    hints[finding.measureColumn] = [
      hints[finding.measureColumn],
      finding.hint,
    ].filter(Boolean).join(" ");
  }
  return hints;
}
