import { parseDuckDbSqlAst, type SqlAstJoin, type SqlAstRelation } from "@/lib/sql-ast-lineage";
import type { LineageSchema } from "@/lib/metric-lineage";

export type JoinCardinality = "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many" | "unknown";
export type JoinDiagnosticStatus = "aligned" | "insufficient-evidence" | "unsupported";

export interface JoinKeyReference {
  leftTable: string;
  leftAlias: string;
  leftColumn: string;
  rightTable: string;
  rightAlias: string;
  rightColumn: string;
}

export interface JoinKeyProfile {
  rowCount: number;
  nonNullKeyRows: number;
  nullKeyRows: number;
  duplicateGroups: number;
  duplicateExcessRows: number;
  uniqueAmongNonNullKeys: boolean | null;
}

export interface JoinCardinalityCheck {
  index: number;
  joinType: SqlAstJoin["type"];
  leftTables: string[];
  rightTable: string;
  keys: JoinKeyReference[];
  leftProfile: JoinKeyProfile | null;
  rightProfile: JoinKeyProfile | null;
  cardinality: JoinCardinality;
  rowMultiplication: "none" | "possible" | "unknown";
  status: JoinDiagnosticStatus;
  reason: string;
}

export interface JoinCardinalityReport {
  version: "join-cardinality-v1";
  status: "not-applicable" | "complete" | "partial" | "unsupported";
  scope: "registered-base-relations-before-query-filters";
  joins: JoinCardinalityCheck[];
  warnings: string[];
}

type QueryExecutor = (sql: string) => Promise<Record<string, unknown>[]>;

interface RelationBinding {
  alias: string;
  schema: LineageSchema;
}

const IDENTIFIER = String.raw`(?:"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)`;
const QUALIFIED_EQUALITY = new RegExp(String.raw`^\s*(${IDENTIFIER})\s*\\.\s*(${IDENTIFIER})\s*=\s*(${IDENTIFIER})\s*\\.\s*(${IDENTIFIER})\s*$`, "i");

function unquote(value: string): string {
  return value.startsWith('"') ? value.slice(1, -1).replace(/""/g, '"') : value;
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function quoteRelation(value: string): string {
  return value.split(".").map(quoteIdentifier).join(".");
}

function relationBinding(relation: SqlAstRelation, schemas: LineageSchema[]): RelationBinding | null {
  if (relation.kind !== "table") return null;
  const name = relation.name.toLowerCase();
  const exact = schemas.filter((schema) =>
    schema.table.toLowerCase() === name || schema.aliases?.some((alias) => alias.toLowerCase() === name),
  );
  const leaf = relation.name.split(".").at(-1)?.toLowerCase();
  const fallback = relation.name.includes(".") ? [] : schemas.filter((schema) =>
    schema.table.split(".").at(-1)?.toLowerCase() === leaf ||
    schema.aliases?.some((alias) => alias.split(".").at(-1)?.toLowerCase() === leaf),
  );
  const matches = exact.length ? exact : fallback;
  if (matches.length !== 1) return null;
  return {
    alias: relation.alias ?? relation.name.split(".").at(-1) ?? relation.name,
    schema: matches[0]!,
  };
}

function splitConjunction(condition: string): string[] | null {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  for (let i = 0; i < condition.length; i++) {
    const ch = condition[i]!;
    if (quote) {
      if (ch === quote && condition[i + 1] === quote) { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && /^and\b/i.test(condition.slice(i))) {
      parts.push(condition.slice(start, i).trim());
      i += 2;
      start = i + 1;
    }
  }
  parts.push(condition.slice(start).trim());
  return parts.every(Boolean) ? parts : null;
}

function resolveColumn(binding: RelationBinding, columnName: string): string | null {
  const column = binding.schema.columns.find((item) => item.name.toLowerCase() === columnName.toLowerCase());
  return column?.name ?? null;
}

function extractJoinKeys(
  join: SqlAstJoin,
  prior: RelationBinding[],
  right: RelationBinding,
): JoinKeyReference[] | null {
  if (join.using.length) {
    const keys: JoinKeyReference[] = [];
    for (const requested of join.using) {
      const rightColumn = resolveColumn(right, requested);
      const leftMatches = prior.flatMap((binding) => {
        const column = resolveColumn(binding, requested);
        return column ? [{ binding, column }] : [];
      });
      if (!rightColumn || leftMatches.length !== 1) return null;
      const left = leftMatches[0]!;
      keys.push({
        leftTable: left.binding.schema.table,
        leftAlias: left.binding.alias,
        leftColumn: left.column,
        rightTable: right.schema.table,
        rightAlias: right.alias,
        rightColumn,
      });
    }
    return keys;
  }

  if (!join.condition) return null;
  const conditions = splitConjunction(join.condition);
  if (!conditions) return null;
  const keys: JoinKeyReference[] = [];
  for (const condition of conditions) {
    const match = QUALIFIED_EQUALITY.exec(condition);
    if (!match) return null;
    const [, rawAliasA, rawColumnA, rawAliasB, rawColumnB] = match;
    const aliasA = unquote(rawAliasA!).toLowerCase();
    const aliasB = unquote(rawAliasB!).toLowerCase();
    const columnAName = unquote(rawColumnA!);
    const columnBName = unquote(rawColumnB!);
    const aIsRight = right.alias.toLowerCase() === aliasA;
    const bIsRight = right.alias.toLowerCase() === aliasB;
    if (aIsRight === bIsRight) return null;
    const leftAlias = aIsRight ? aliasB : aliasA;
    const leftColumnName = aIsRight ? columnBName : columnAName;
    const rightColumnName = aIsRight ? columnAName : columnBName;
    const leftMatches = prior.filter((binding) => binding.alias.toLowerCase() === leftAlias);
    if (leftMatches.length !== 1) return null;
    const left = leftMatches[0]!;
    const leftColumn = resolveColumn(left, leftColumnName);
    const rightColumn = resolveColumn(right, rightColumnName);
    if (!leftColumn || !rightColumn) return null;
    keys.push({
      leftTable: left.schema.table,
      leftAlias: left.alias,
      leftColumn,
      rightTable: right.schema.table,
      rightAlias: right.alias,
      rightColumn,
    });
  }
  return keys.length ? keys : null;
}

function numeric(value: unknown): number {
  const parsed = typeof value === "bigint" ? Number(value) : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildProfileSql(table: string, columns: string[]): string {
  const quotedColumns = columns.map(quoteIdentifier);
  const selectColumns = quotedColumns.join(", ");
  const allNonNull = quotedColumns.map((column) => `${column} IS NOT NULL`).join(" AND ");
  const anyNull = quotedColumns.map((column) => `${column} IS NULL`).join(" OR ");
  return `WITH key_groups AS (
    SELECT ${selectColumns}, COUNT(*) AS key_count
    FROM ${quoteRelation(table)}
    WHERE ${allNonNull}
    GROUP BY ${selectColumns}
  )
  SELECT
    (SELECT COUNT(*) FROM ${quoteRelation(table)}) AS row_count,
    (SELECT COUNT(*) FROM ${quoteRelation(table)} WHERE ${anyNull}) AS null_key_rows,
    (SELECT COALESCE(SUM(key_count), 0) FROM key_groups) AS non_null_key_rows,
    (SELECT COUNT(*) FROM key_groups WHERE key_count > 1) AS duplicate_groups,
    (SELECT COALESCE(SUM(key_count - 1), 0) FROM key_groups WHERE key_count > 1) AS duplicate_excess_rows`;
}

async function profileKeys(
  binding: RelationBinding,
  columns: string[],
  execute: QueryExecutor,
): Promise<JoinKeyProfile> {
  const rows = await execute(buildProfileSql(binding.schema.table, columns));
  const row = rows[0];
  if (!row) throw new Error("DuckDB did not return a key profile row.");
  const rowCount = numeric(row.row_count);
  const nonNullKeyRows = numeric(row.non_null_key_rows);
  const nullKeyRows = numeric(row.null_key_rows);
  const duplicateGroups = numeric(row.duplicate_groups);
  const duplicateExcessRows = numeric(row.duplicate_excess_rows);
  return {
    rowCount,
    nonNullKeyRows,
    nullKeyRows,
    duplicateGroups,
    duplicateExcessRows,
    uniqueAmongNonNullKeys: nonNullKeyRows > 0 ? duplicateGroups === 0 : null,
  };
}

function classifyCardinality(left: JoinKeyProfile, right: JoinKeyProfile): JoinCardinality {
  if (left.uniqueAmongNonNullKeys === null || right.uniqueAmongNonNullKeys === null) return "unknown";
  if (left.uniqueAmongNonNullKeys && right.uniqueAmongNonNullKeys) return "one-to-one";
  if (left.uniqueAmongNonNullKeys && !right.uniqueAmongNonNullKeys) return "one-to-many";
  if (!left.uniqueAmongNonNullKeys && right.uniqueAmongNonNullKeys) return "many-to-one";
  return "many-to-many";
}

/**
 * Profiles only simple equality/USING joins over registered base relations.
 * It deliberately does not claim to measure the exact filtered join output:
 * profiles are computed on source relations before query WHERE predicates.
 */
export async function analyzeDuckDbJoinCardinality(
  sql: string,
  schemas: LineageSchema[],
  execute: QueryExecutor,
): Promise<JoinCardinalityReport> {
  const parsed = parseDuckDbSqlAst(sql);
  const joins = parsed.query?.joins ?? [];
  if (parsed.status !== "parsed" || !parsed.query) {
    return {
      version: "join-cardinality-v1",
      status: "unsupported",
      scope: "registered-base-relations-before-query-filters",
      joins: [],
      warnings: parsed.warnings.length ? parsed.warnings : ["تعذر تحليل JOIN بأمان."],
    };
  }
  if (!joins.length) {
    return {
      version: "join-cardinality-v1",
      status: "not-applicable",
      scope: "registered-base-relations-before-query-filters",
      joins: [],
      warnings: [],
    };
  }

  const base = parsed.query.from ? relationBinding(parsed.query.from, schemas) : null;
  if (!base) {
    return {
      version: "join-cardinality-v1",
      status: "unsupported",
      scope: "registered-base-relations-before-query-filters",
      joins: [],
      warnings: ["لا يمكن تشخيص JOIN قبل ربط المصدر الأساسي بجدول DuckDB مسجل بصورة مؤكدة."],
    };
  }
  const prior: RelationBinding[] = [base];
  const checks: JoinCardinalityCheck[] = [];
  for (let index = 0; index < joins.length; index++) {
    const join = joins[index]!;
    const right = relationBinding(join.relation, schemas);
    const leftTables = prior.map((binding) => binding.schema.table);
    if (!right || prior.some((binding) => binding.alias.toLowerCase() === right.alias.toLowerCase())) {
      checks.push({
        index: index + 1, joinType: join.type, leftTables, rightTable: join.relation.name,
        keys: [], leftProfile: null, rightProfile: null, cardinality: "unknown",
        rowMultiplication: "unknown", status: "unsupported",
        reason: "مصدر JOIN غير مسجل أو اسم alias ملتبس؛ لم يتم تنفيذ استعلامات تشخيصية.",
      });
      continue;
    }
    if (join.type === "cross" || join.type === "natural" || join.type === "unknown") {
      checks.push({
        index: index + 1, joinType: join.type, leftTables, rightTable: right.schema.table,
        keys: [], leftProfile: null, rightProfile: null, cardinality: "unknown",
        rowMultiplication: join.type === "cross" ? "possible" : "unknown",
        status: "unsupported",
        reason: join.type === "cross"
          ? "CROSS JOIN قد ينتج حاصل ضرب ديكارتي؛ لا توجد مفاتيح مساواة لقياس cardinality."
          : "نوع JOIN غير مدعوم في تشخيص المفاتيح الحالي.",
      });
      prior.push(right);
      continue;
    }

    const keys = extractJoinKeys(join, prior, right);
    if (!keys) {
      checks.push({
        index: index + 1, joinType: join.type, leftTables, rightTable: right.schema.table,
        keys: [], leftProfile: null, rightProfile: null, cardinality: "unknown",
        rowMultiplication: "unknown", status: "unsupported",
        reason: "شرط JOIN ليس مجموعة مفاتيح مساواة بسيطة ومؤهلة بالكامل؛ لم يتم تخمين المفاتيح.",
      });
      prior.push(right);
      continue;
    }

    const leftBindings = keys.map((key) => prior.find((binding) =>
      binding.schema.table === key.leftTable && binding.alias === key.leftAlias,
    )!);
    const leftTableNames = new Set(leftBindings.map((binding) => binding.schema.table));
    if (leftTableNames.size !== 1 || keys.some((key) => key.rightTable !== right.schema.table)) {
      checks.push({
        index: index + 1, joinType: join.type, leftTables, rightTable: right.schema.table,
        keys, leftProfile: null, rightProfile: null, cardinality: "unknown",
        rowMultiplication: "unknown", status: "unsupported",
        reason: "مفاتيح JOIN تمتد عبر أكثر من علاقة يسارية؛ يلزم تحليل مركب متعدد العلاقات قبل التصنيف.",
      });
      prior.push(right);
      continue;
    }
    const leftBinding = leftBindings[0]!;
    try {
      const leftColumns = keys.map((key) => key.leftColumn);
      const rightColumns = keys.map((key) => key.rightColumn);
      const [leftProfile, rightProfile] = await Promise.all([
        profileKeys(leftBinding, leftColumns, execute),
        profileKeys(right, rightColumns, execute),
      ]);
      const cardinality = classifyCardinality(leftProfile, rightProfile);
      const rightUnique = rightProfile.uniqueAmongNonNullKeys === true;
      const leftUnique = leftProfile.uniqueAmongNonNullKeys === true;
      const rowMultiplication = join.type === "left"
        ? (rightUnique ? "none" : rightProfile.uniqueAmongNonNullKeys === false ? "possible" : "unknown")
        : join.type === "right"
          ? (leftUnique ? "none" : leftProfile.uniqueAmongNonNullKeys === false ? "possible" : "unknown")
          : (leftUnique && rightUnique ? "none" : leftProfile.uniqueAmongNonNullKeys === false || rightProfile.uniqueAmongNonNullKeys === false ? "possible" : "unknown");
      const status: JoinDiagnosticStatus = rowMultiplication === "none" ? "aligned" : "insufficient-evidence";
      checks.push({
        index: index + 1,
        joinType: join.type,
        leftTables,
        rightTable: right.schema.table,
        keys,
        leftProfile,
        rightProfile,
        cardinality,
        rowMultiplication,
        status,
        reason: rowMultiplication === "none"
          ? "لم تُرصد مفاتيح مكررة غير NULL على الجانب الذي قد يضاعف صفوف الجانب المحفوظ في هذا JOIN."
          : rowMultiplication === "possible"
            ? "رُصدت مفاتيح غير NULL مكررة؛ قد يضاعف JOIN صفوف المصدر الآخر. القياس على الجداول المسجلة قبل مرشحات الاستعلام."
            : "تعذر إثبات تفرد مفاتيح JOIN على الجانبين.",
      });
    } catch (error) {
      checks.push({
        index: index + 1, joinType: join.type, leftTables, rightTable: right.schema.table,
        keys, leftProfile: null, rightProfile: null, cardinality: "unknown",
        rowMultiplication: "unknown", status: "insufficient-evidence",
        reason: error instanceof Error ? `فشل قياس مفاتيح JOIN: ${error.message}` : "فشل قياس مفاتيح JOIN.",
      });
    }
    prior.push(right);
  }

  const warnings = checks.filter((check) => check.status !== "aligned").map((check) => check.reason);
  const status = checks.every((check) => check.status === "aligned")
    ? "complete"
    : checks.some((check) => check.status === "unsupported") ? "unsupported" : "partial";
  return {
    version: "join-cardinality-v1",
    status,
    scope: "registered-base-relations-before-query-filters",
    joins: checks,
    warnings,
  };
}
