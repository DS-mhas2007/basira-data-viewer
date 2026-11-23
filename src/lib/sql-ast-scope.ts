import type { LineageSchema } from "@/lib/metric-lineage";
import {
  parseDuckDbSqlAst,
  type SqlAstQuery,
  type SqlAstRelation,
} from "@/lib/sql-ast-lineage";

export type AstResolutionStatus = "resolved" | "ambiguous" | "unresolved";

export interface AstResolvedProjection {
  outputName: string;
  expression: string;
  sourceColumns: string[];
  status: AstResolutionStatus;
  reason?: string;
}

export interface AstScopeResolution {
  status: "resolved" | "partial" | "unsupported";
  projections: AstResolvedProjection[];
  sourceColumns: string[];
  warnings: string[];
}

interface BoundColumn {
  name: string;
  sourceColumns: string[];
}

interface RelationBinding {
  alias: string;
  columns: BoundColumn[];
}

const SQL_KEYWORDS = new Set(
  "select from where group by having qualify order limit offset fetch distinct all as and or not null true false case when then else end cast try_cast over partition rows range preceding following current row unbounded filter asc desc nulls first last interval day month year hour minute second union intersect except join inner left right full outer cross natural on using exists in is like ilike between escape collate".split(/\s+/),
);

function unquote(value: string): string {
  return value.startsWith('"') ? value.slice(1, -1).replace(/""/g, '"') : value;
}

function expressionIdentifiers(expression: string): Array<{ name: string; qualifier?: string; functionName: boolean }> {
  const pattern = /"(?:[^"]|"")*"|'(?:[^']|'')*'|[A-Za-z_][A-Za-z0-9_$]*|[0-9]+(?:\.[0-9]+)?|\.|::|[^\s]/g;
  const tokens = [...expression.matchAll(pattern)].map((match) => ({
    value: match[0]!,
    index: match.index ?? 0,
  }));
  const found: Array<{ name: string; qualifier?: string; functionName: boolean }> = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.value.startsWith("'") || /^\d/.test(token.value)) continue;
    const quoted = token.value.startsWith('"');
    if (!quoted && !/^[A-Za-z_]/.test(token.value)) continue;
    const name = unquote(token.value);
    if (!quoted && SQL_KEYWORDS.has(name.toLowerCase())) continue;
    if (tokens[i - 1]?.value === ".") continue;
    const qualified = tokens[i + 1]?.value === "." && tokens[i + 2] &&
      (/^[A-Za-z_]/.test(tokens[i + 2]!.value) || tokens[i + 2]!.value.startsWith('"'));
    if (qualified) {
      found.push({ name: unquote(tokens[i + 2]!.value), qualifier: name, functionName: false });
      i += 2;
      continue;
    }
    found.push({
      name,
      functionName: tokens[i + 1]?.value === "(",
    });
  }
  return found;
}

function resolveRelation(
  relation: SqlAstRelation | null,
  query: SqlAstQuery,
  schemas: LineageSchema[],
  depth: number,
): RelationBinding | null {
  if (!relation || depth > 12) return null;
  const alias = relation.alias ?? relation.name.split(".").at(-1) ?? relation.name;
  if (relation.kind === "cte") {
    const cte = query.ctes.find((item) => item.name.toLowerCase() === relation.name.toLowerCase());
    if (!cte) return null;
    const nested = resolveQuery(cte.query, schemas, depth + 1);
    return {
      alias,
      columns: nested.projections.map((column) => ({
        name: column.outputName,
        sourceColumns: column.sourceColumns,
      })),
    };
  }
  if (relation.kind === "subquery" && relation.subquery) {
    const nested = resolveQuery(relation.subquery, schemas, depth + 1);
    return {
      alias,
      columns: nested.projections.map((column) => ({
        name: column.outputName,
        sourceColumns: column.sourceColumns,
      })),
    };
  }
  if (relation.kind !== "table") return null;
  const schema = schemas.find((item) =>
    item.table.toLowerCase() === relation.name.toLowerCase() ||
    item.table.split(".").at(-1)?.toLowerCase() === relation.name.split(".").at(-1)?.toLowerCase(),
  );
  if (!schema) return null;
  return {
    alias,
    columns: schema.columns.map((column) => ({
      name: column.name,
      sourceColumns: [column.name],
    })),
  };
}

function resolveQuery(query: SqlAstQuery, schemas: LineageSchema[], depth = 0): AstScopeResolution {
  if (depth > 12) {
    return { status: "unsupported", projections: [], sourceColumns: [], warnings: ["تجاوز حل النطاق عمق التحليل المسموح."] };
  }
  const bindings: RelationBinding[] = [];
  const base = resolveRelation(query.from, query, schemas, depth);
  if (base) bindings.push(base);
  for (const join of query.joins) {
    const binding = resolveRelation(join.relation, query, schemas, depth);
    if (binding) bindings.push(binding);
  }
  const projections: AstResolvedProjection[] = query.projections.map((projection, index) => {
    const identifiers = expressionIdentifiers(projection.expression).filter((item) => !item.functionName);
    const dependencies = new Set<string>();
    let ambiguous = false;
    let unresolved: string | null = null;
    for (const identifier of identifiers) {
      const matches = identifier.qualifier
        ? bindings.filter((binding) => binding.alias.toLowerCase() === identifier.qualifier!.toLowerCase())
            .flatMap((binding) => binding.columns.filter((column) => column.name.toLowerCase() === identifier.name.toLowerCase()))
        : bindings.flatMap((binding) => binding.columns.filter((column) => column.name.toLowerCase() === identifier.name.toLowerCase()));
      if (matches.length > 1) {
        ambiguous = true;
        unresolved = identifier.name;
        continue;
      }
      if (matches.length === 0) {
        unresolved = identifier.name;
        continue;
      }
      matches[0]!.sourceColumns.forEach((column) => dependencies.add(column));
    }
    const outputName = projection.alias ??
      (identifiers.length === 1 ? identifiers[0]!.name : `expression_${index + 1}`);
    if (ambiguous) {
      return { outputName, expression: projection.expression, sourceColumns: [...dependencies].sort(), status: "ambiguous", reason: `العمود ${unresolved} موجود في أكثر من مصدر ضمن النطاق.` };
    }
    if (unresolved) {
      return { outputName, expression: projection.expression, sourceColumns: [...dependencies].sort(), status: "unresolved", reason: `تعذر حل العمود ${unresolved} ضمن المصادر المعروفة.` };
    }
    return { outputName, expression: projection.expression, sourceColumns: [...dependencies].sort(), status: "resolved" };
  });
  const sourceColumns = [...new Set(projections.flatMap((projection) => projection.sourceColumns))].sort();
  const warnings = projections.filter((projection) => projection.status !== "resolved")
    .map((projection) => `${projection.outputName}: ${projection.reason}`);
  if (query.joins.length && query.joins.some((join) => join.type === "unknown" || join.type === "natural")) {
    warnings.push("نوع JOIN غير مدعوم بالكامل في حل النطاق؛ يلزم التحقق من قواعد DuckDB.");
  }
  const unsupportedSources = (query.from && !base) || query.joins.some((join, index) => !bindings[index + (base ? 1 : 0)]);
  return {
    status: unsupportedSources ? "unsupported" : warnings.length ? "partial" : "resolved",
    projections,
    sourceColumns,
    warnings,
  };
}

/**
 * Resolves projection dependencies through table aliases, CTEs and derived tables.
 * The resolver only accepts explicitly supplied schemas and fails closed for unknown sources.
 */
export function resolveDuckDbSqlScope(sql: string, schemas: LineageSchema[]): AstScopeResolution {
  const parsed = parseDuckDbSqlAst(sql);
  if (parsed.status !== "parsed" || !parsed.query) {
    return {
      status: "unsupported",
      projections: [],
      sourceColumns: [],
      warnings: parsed.warnings.length ? parsed.warnings : ["تعذر بناء AST صالح لحل نطاق SQL."],
    };
  }
  return resolveQuery(parsed.query, schemas);
}
