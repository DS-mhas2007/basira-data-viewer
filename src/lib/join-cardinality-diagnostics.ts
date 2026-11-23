import { parseDuckDbSqlAst, type SqlAstJoin, type SqlAstRelation } from "@/lib/sql-ast-lineage";
import type { LineageSchema } from "@/lib/metric-lineage";
import type { JoinDiagnostics } from "@/lib/duckdb-service";

export interface SqlJoinDiagnosticSpec {
  index: number;
  joinType: "inner" | "left" | "right" | "full";
  leftTable: string;
  rightTable: string;
  leftColumns: string[];
  rightColumns: string[];
}

export interface JoinDiagnosticResult {
  index: number;
  status: "measured" | "unsupported" | "failed";
  spec?: SqlJoinDiagnosticSpec;
  diagnostics?: JoinDiagnostics;
  reason: string;
}

export interface JoinCardinalityReport {
  version: "join-cardinality-v1";
  status: "not-applicable" | "complete" | "partial" | "unsupported";
  scope: "registered-base-relations-before-query-filters";
  joins: JoinDiagnosticResult[];
  warnings: string[];
}

interface RelationBinding {
  alias: string;
  schema: LineageSchema;
}

const IDENTIFIER = String.raw`(?:"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)`;
const EQUALITY = new RegExp(String.raw`^\s*(${IDENTIFIER})\s*\.\s*(${IDENTIFIER})\s*=\s*(${IDENTIFIER})\s*\.\s*(${IDENTIFIER})\s*$`, "i");

function unquote(value: string): string {
  return value.startsWith('"') ? value.slice(1, -1).replace(/""/g, '"') : value;
}

function binding(relation: SqlAstRelation | null, schemas: LineageSchema[]): RelationBinding | null {
  if (!relation || relation.kind !== "table") return null;
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
  const schema = matches[0]!;
  return {
    alias: relation.alias ?? relation.name.split(".").at(-1) ?? relation.name,
    schema,
  };
}

function splitAnd(condition: string): string[] | null {
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

function resolveColumn(schema: LineageSchema, name: string): string | null {
  return schema.columns.find((column) => column.name.toLowerCase() === name.toLowerCase())?.name ?? null;
}

function buildSpec(
  index: number,
  join: SqlAstJoin,
  prior: RelationBinding[],
  right: RelationBinding,
): SqlJoinDiagnosticSpec | null {
  if (join.type !== "inner" && join.type !== "left" && join.type !== "right" && join.type !== "full") return null;
  const pairs: Array<{ leftAlias: string; leftColumn: string; rightColumn: string }> = [];
  if (join.using.length) {
    for (const name of join.using) {
      const leftMatches = prior.flatMap((candidate) => {
        const column = resolveColumn(candidate.schema, name);
        return column ? [{ candidate, column }] : [];
      });
      const rightColumn = resolveColumn(right.schema, name);
      if (leftMatches.length !== 1 || !rightColumn) return null;
      pairs.push({
        leftAlias: leftMatches[0]!.candidate.alias,
        leftColumn: leftMatches[0]!.column,
        rightColumn,
      });
    }
  } else {
    if (!join.condition) return null;
    const conditions = splitAnd(join.condition);
    if (!conditions) return null;
    for (const condition of conditions) {
      const match = EQUALITY.exec(condition);
      if (!match) return null;
      const [, aliasA, columnA, aliasB, columnB] = match;
      const a = unquote(aliasA!).toLowerCase();
      const b = unquote(aliasB!).toLowerCase();
      const rightIsA = right.alias.toLowerCase() === a;
      const rightIsB = right.alias.toLowerCase() === b;
      if (rightIsA === rightIsB) return null;
      const leftAlias = rightIsA ? b : a;
      const leftName = rightIsA ? unquote(columnB!) : unquote(columnA!);
      const rightName = rightIsA ? unquote(columnA!) : unquote(columnB!);
      const leftCandidates = prior.filter((candidate) => candidate.alias.toLowerCase() === leftAlias);
      if (leftCandidates.length !== 1) return null;
      const leftColumn = resolveColumn(leftCandidates[0]!.schema, leftName);
      const rightColumn = resolveColumn(right.schema, rightName);
      if (!leftColumn || !rightColumn) return null;
      pairs.push({ leftAlias: leftCandidates[0]!.alias, leftColumn, rightColumn });
    }
  }
  const leftAliases = new Set(pairs.map((pair) => pair.leftAlias.toLowerCase()));
  if (!pairs.length || leftAliases.size !== 1) return null;
  const left = prior.find((candidate) => candidate.alias.toLowerCase() === [...leftAliases][0]);
  if (!left) return null;
  return {
    index,
    joinType: join.type,
    leftTable: left.schema.table,
    rightTable: right.schema.table,
    leftColumns: pairs.map((pair) => pair.leftColumn),
    rightColumns: pairs.map((pair) => pair.rightColumn),
  };
}

/** Extract only simple, registered base-table equi-joins; every unsupported shape fails closed. */
export function buildSqlJoinDiagnosticPlan(sql: string, schemas: LineageSchema[]): {
  status: "not-applicable" | "supported" | "unsupported";
  specs: SqlJoinDiagnosticSpec[];
  unsupported: JoinDiagnosticResult[];
  warnings: string[];
} {
  const parsed = parseDuckDbSqlAst(sql);
  if (parsed.status !== "parsed" || !parsed.query) {
    const hasJoin = /\bjoin\b/i.test(sql);
    const reason = parsed.warnings.length ? parsed.warnings.join(" ") : "تعذر تحليل الاستعلام بأمان.";
    return {
      status: hasJoin ? "unsupported" : "not-applicable",
      specs: [],
      unsupported: hasJoin ? [{ index: 1, status: "unsupported", reason }] : [],
      warnings: hasJoin ? [reason] : [],
    };
  }
  if (!parsed.query.joins.length) {
    return { status: "not-applicable", specs: [], unsupported: [], warnings: [] };
  }
  const current = binding(parsed.query.from, schemas);
  if (!current) {
    return {
      status: "unsupported",
      specs: [],
      unsupported: [{ index: 1, status: "unsupported", reason: "المصدر الأساسي ليس جدولاً مسجلاً قابلاً للتشخيص." }],
      warnings: ["لا يمكن تشخيص JOIN على CTE أو subquery أو مصدر غير مسجل."],
    };
  }
  const prior: RelationBinding[] = [current];
  const specs: SqlJoinDiagnosticSpec[] = [];
  const unsupported: JoinDiagnosticResult[] = [];
  for (let index = 0; index < parsed.query.joins.length; index++) {
    const join = parsed.query.joins[index]!;
    const right = binding(join.relation, schemas);
    if (!right || prior.some((candidate) => candidate.alias.toLowerCase() === right.alias.toLowerCase())) {
      unsupported.push({ index: index + 1, status: "unsupported", reason: "مصدر JOIN غير مسجل أو alias ملتبس." });
      continue;
    }
    const spec = buildSpec(index + 1, join, prior, right);
    if (!spec) {
      unsupported.push({
        index: index + 1,
        status: "unsupported",
        reason: join.type === "cross" || join.type === "natural" || join.type === "unknown"
          ? "نوع JOIN لا يدعم قياس المفاتيح الحالي."
          : "شرط JOIN ليس مفاتيح مساواة بسيطة ومؤهلة بالكامل على علاقة يسارية واحدة؛ لم يتم تخمين المفاتيح.",
      });
    } else specs.push(spec);
    prior.push(right);
  }
  const warnings = unsupported.map((item) => item.reason);
  return {
    status: unsupported.length ? "unsupported" : "supported",
    specs,
    unsupported,
    warnings,
  };
}

/** Executes diagnostics sequentially to avoid concurrent queries on the shared DuckDB connection. */
export async function runSqlJoinDiagnostics(
  sql: string,
  schemas: LineageSchema[],
  diagnose: (spec: SqlJoinDiagnosticSpec) => Promise<JoinDiagnostics>,
): Promise<JoinCardinalityReport> {
  const plan = buildSqlJoinDiagnosticPlan(sql, schemas);
  if (plan.status === "not-applicable") {
    return { version: "join-cardinality-v1", status: "not-applicable", scope: "registered-base-relations-before-query-filters", joins: [], warnings: [] };
  }
  const results: JoinDiagnosticResult[] = [...plan.unsupported];
  for (const spec of plan.specs) {
    try {
      const diagnostics = await diagnose(spec);
      results.push({
        index: spec.index,
        status: "measured",
        spec,
        diagnostics,
        reason: diagnostics.warning
          ? diagnostics.reasons.join(" ")
          : "تم قياس عدد الصفوف الفعلي الناتج عن مفاتيح الربط المسجلة دون ملاحظة تحذير.",
      });
    } catch (error) {
      results.push({
        index: spec.index,
        status: "failed",
        spec,
        reason: error instanceof Error ? error.message : "فشل تنفيذ تشخيص JOIN.",
      });
    }
  }
  results.sort((a, b) => a.index - b.index);
  const warnings = results.filter((item) => item.status !== "measured" || item.diagnostics?.warning)
    .map((item) => item.reason);
  const status = results.every((item) => item.status === "measured" && !item.diagnostics?.warning)
    ? "complete"
    : results.some((item) => item.status === "unsupported") ? "unsupported" : "partial";
  return {
    version: "join-cardinality-v1",
    status,
    scope: "registered-base-relations-before-query-filters",
    joins: results,
    warnings,
  };
}
