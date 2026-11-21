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

export function selectGrainCandidates(schema: GrainColumn[]) {
  const keys = schema
    .filter((column) => KEY_NAME.test(column.name) && !/DATE|TIME|INTERVAL/i.test(column.type))
    .slice(0, 6);
  const measures = schema
    .filter((column) => NUMERIC_TYPE.test(column.type))
    .slice(0, 10);
  return { keys, measures };
}

/**
 * Builds one read-only DuckDB query for all candidate key/measure pairs.
 * Every subquery groups the complete dataset, not the AI preview/sample.
 */
export function buildGrainProbeSql(table: string, schema: GrainColumn[]): string | null {
  const { keys, measures } = selectGrainCandidates(schema);
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
