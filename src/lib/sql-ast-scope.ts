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
  warnings?: string[];
  sourceColumns?: string[];
}

const SQL_KEYWORDS = new Set(
  "select from where group by having qualify order limit offset fetch distinct all as and or not null true false case when then else end cast try_cast over partition rows range preceding following current row unbounded filter asc desc nulls first last interval day month year hour minute second varchar char text string boolean bool tinyint smallint integer int bigint hugeint uinteger ubigint float real double precision decimal numeric date timestamp timestamptz time timetz blob json uuid current_date current_time current_timestamp localtimestamp localtime current_user current_role current_catalog current_schema union intersect except join inner left right full outer cross natural on using exists in is like ilike between escape collate".split(/\s+/),
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
    if (!cte || cte.recursive) return null;
    const nested = resolveQuery(cte.query, schemas, depth + 1);
    return {
      alias,
      columns: nested.projections.map((column) => ({
        name: column.outputName,
        sourceColumns: column.sourceColumns,
      })),
      warnings: nested.warnings,
      sourceColumns: nested.sourceColumns,
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
      warnings: nested.warnings,
      sourceColumns: nested.sourceColumns,
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
  const inheritedWarnings: string[] = [];
  const base = resolveRelation(query.from, query, schemas, depth);
  if (base) {
    bindings.push(base);
    inheritedWarnings.push(...(base.warnings ?? []));
  } else if (query.from) inheritedWarnings.push(`تعذر حل مصدر البيانات ${query.from.name}.`);
  for (const join of query.joins) {
    const binding = resolveRelation(join.relation, query, schemas, depth);
    if (binding) {
      bindings.push(binding);
      inheritedWarnings.push(...(binding.warnings ?? []));
    } else inheritedWarnings.push(`تعذر حل مصدر JOIN ${join.relation.name}.`);
    if (join.type === "unknown" || join.type === "natural") {
      inheritedWarnings.push("نوع JOIN غير مدعوم بالكامل في حل النطاق؛ يلزم التحقق من قواعد DuckDB.");
    }
  }

  const resolveIdentifiers = (expression: string, allowOutputAliases = false) => {
    const identifiers = expressionIdentifiers(expression).filter((item) => !item.functionName);
    const dependencies = new Set<string>();
    const issues: string[] = [];
    if (/(^|\s|\.)\*(?=\s|$|,)/.test(expression.trim())) {
      issues.push("استخدام wildcard يتطلب توسيعاً مؤكداً للأعمدة قبل اعتماد lineage.");
    }
    for (const identifier of identifiers) {
      const matches = identifier.qualifier
        ? bindings.filter((binding) => binding.alias.toLowerCase() === identifier.qualifier!.toLowerCase())
            .flatMap((binding) => binding.columns.filter((column) => column.name.toLowerCase() === identifier.name.toLowerCase()))
        : bindings.flatMap((binding) => binding.columns.filter((column) => column.name.toLowerCase() === identifier.name.toLowerCase()));
      if (matches.length > 1) {
        issues.push(`العمود ${identifier.name} ملتبس بين أكثر من مصدر.`);
        continue;
      }
      if (matches.length === 0) {
        if (allowOutputAliases && !identifier.qualifier) {
          const aliases = query.projections.filter((projection) => projection.alias?.toLowerCase() === identifier.name.toLowerCase());
          if (aliases.length === 1) {
            const aliasDeps = resolveIdentifiers(aliases[0]!.expression, false);
            aliasDeps.dependencies.forEach((column) => dependencies.add(column));
            issues.push(...aliasDeps.issues);
            continue;
          }
        }
        issues.push(`تعذر حل العمود ${identifier.qualifier ? identifier.qualifier + "." : ""}${identifier.name} ضمن المصادر المعروفة.`);
        continue;
      }
      matches[0]!.sourceColumns.forEach((column) => dependencies.add(column));
    }
    return { dependencies, issues };
  };

  const projections: AstResolvedProjection[] = query.projections.map((projection, index) => {
    const result = resolveIdentifiers(projection.expression);
    const outputName = projection.alias ??
      (expressionIdentifiers(projection.expression).filter((item) => !item.functionName).length === 1
        ? expressionIdentifiers(projection.expression).find((item) => !item.functionName)!.name
        : `expression_${index + 1}`);
    const status: AstResolutionStatus = result.issues.some((issue) => issue.includes("ملتبس"))
      ? "ambiguous" : result.issues.length ? "unresolved" : "resolved";
    return {
      outputName,
      expression: projection.expression,
      sourceColumns: [...result.dependencies].sort(),
      status,
      ...(result.issues.length ? { reason: result.issues.join(" ") } : {}),
    };
  });

  const allDependencies = new Set(projections.flatMap((projection) => projection.sourceColumns));
  bindings.forEach((binding) => binding.sourceColumns?.forEach((column) => allDependencies.add(column)));
  const clauseExpressions = [
    query.where, query.having, query.qualify,
    ...query.groupBy, ...query.orderBy,
    ...query.joins.map((join) => join.condition),
  ].filter((value): value is string => Boolean(value));
  for (const expression of clauseExpressions) {
    const result = resolveIdentifiers(expression, true);
    result.dependencies.forEach((column) => allDependencies.add(column));
    inheritedWarnings.push(...result.issues);
  }
  // USING columns are join keys present on both relations; include both source dependencies.
  for (const join of query.joins) {
    for (const name of join.using) {
      const matches = bindings.flatMap((binding) => binding.columns.filter((column) => column.name.toLowerCase() === name.toLowerCase()));
      if (matches.length < 2) inheritedWarnings.push(`تعذر التحقق من عمود USING(${name}) في طرفي JOIN.`);
      matches.forEach((column) => column.sourceColumns.forEach((source) => allDependencies.add(source)));
    }
  }

  const warnings = [
    ...inheritedWarnings,
    ...projections.filter((projection) => projection.status !== "resolved")
      .map((projection) => `${projection.outputName}: ${projection.reason}`),
  ];
  const unsupportedSources = Boolean(query.from && !base) ||
    query.joins.some((join, index) => !bindings[index + (base ? 1 : 0)]);
  return {
    status: unsupportedSources ? "unsupported" : warnings.length ? "partial" : "resolved",
    projections,
    sourceColumns: [...allDependencies].sort(),
    warnings: [...new Set(warnings)],
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
