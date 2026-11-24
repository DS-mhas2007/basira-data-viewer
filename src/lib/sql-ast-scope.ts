import type { LineageSchema } from "@/lib/metric-lineage";
import {
  parseDuckDbSqlAst,
  type SqlAstQuery,
  type SqlAstRelation,
} from "@/lib/sql-ast-lineage";

export type AstResolutionStatus = "resolved" | "ambiguous" | "unresolved";

export interface AstSourceReference {
  table: string;
  column: string;
}

export interface AstResolvedProjection {
  outputName: string;
  expression: string;
  sourceColumns: string[];
  sourceReferences: AstSourceReference[];
  /** Dependencies used to compute the output value, excluding CASE predicates. */
  valueSourceColumns: string[];
  valueSourceReferences: AstSourceReference[];
  /** Dependencies used to select CASE branches rather than supply their returned value. */
  conditionSourceColumns: string[];
  conditionSourceReferences: AstSourceReference[];
  /** Sources that affect row membership without supplying the output value (INTERSECT / EXCEPT right branches). */
  rowFilterSourceColumns: string[];
  rowFilterSourceReferences: AstSourceReference[];
  status: AstResolutionStatus;
  reason?: string;
}

export interface AstScopeResolution {
  status: "resolved" | "partial" | "unsupported";
  projections: AstResolvedProjection[];
  sourceColumns: string[];
  sourceReferences: AstSourceReference[];
  warnings: string[];
}

interface BoundColumn {
  name: string;
  sourceColumns: string[];
  sourceReferences: AstSourceReference[];
}

interface RelationBinding {
  alias: string;
  columns: BoundColumn[];
  warnings?: string[];
  sourceColumns?: string[];
  sourceReferences?: AstSourceReference[];
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
        sourceReferences: column.sourceReferences,
      })),
      warnings: nested.warnings,
      sourceColumns: nested.sourceColumns,
      sourceReferences: nested.sourceReferences,
    };
  }
  if (relation.kind === "subquery" && relation.subquery) {
    const nested = resolveQuery(relation.subquery, schemas, depth + 1);
    return {
      alias,
      columns: nested.projections.map((column) => ({
        name: column.outputName,
        sourceColumns: column.sourceColumns,
        sourceReferences: column.sourceReferences,
      })),
      warnings: nested.warnings,
      sourceColumns: nested.sourceColumns,
      sourceReferences: nested.sourceReferences,
    };
  }
  if (relation.kind !== "table") return null;
  const relationName = relation.name.toLowerCase();
  const relationLeaf = relation.name.split(".").at(-1)?.toLowerCase();
  const exactMatches = schemas.filter((item) =>
    item.table.toLowerCase() === relationName ||
    item.aliases?.some((alias) => alias.toLowerCase() === relationName),
  );
  const fallbackMatches = relation.name.includes(".") ? [] : schemas.filter((item) =>
    item.table.split(".").at(-1)?.toLowerCase() === relationLeaf ||
    item.aliases?.some((alias) => alias.split(".").at(-1)?.toLowerCase() === relationLeaf),
  );
  const candidates = exactMatches.length ? exactMatches : fallbackMatches;
  // Never pick the first schema when an unqualified relation name is ambiguous.
  const schema = candidates.length === 1 ? candidates[0] : null;
  if (!schema) return null;
  return {
    alias,
    columns: schema.columns.map((column) => ({
      name: column.name,
      sourceColumns: [column.name],
      sourceReferences: [{ table: schema.table, column: column.name }],
    })),
  };
}


interface CaseExpressionParts {
  valueParts: string[];
  conditionParts: string[];
  valid: boolean;
}

/**
 * Separates CASE predicates from returned expressions without evaluating SQL.
 * Nested CASE expressions are handled with a stack; quoted strings/identifiers
 * are treated as indivisible tokens so keywords inside them are ignored.
 */
function stripCastTypeAnnotations(expression: string): string {
  // CAST(value AS TYPE) contains a type name that is not a source-column dependency.
  // The parser has already isolated the projection expression, so AS here is a cast annotation.
  return expression.replace(/\bAS\s+[A-Za-z_][A-Za-z0-9_]*(?:\s*\([^)]*\))?/gi, " ");
}

function splitCaseExpression(expression: string): CaseExpressionParts {
  const valueParts: string[] = [];
  const conditionParts: string[] = [];
  const tokens = [...expression.matchAll(/"(?:[^"]|"")*"|'(?:[^']|'')*'|[A-Za-z_][A-Za-z0-9_$]*|./gs)];
  const stack: Array<{ state: "condition" | "value" }> = [];
  let mode: "condition" | "value" = "value";
  let cursor = 0;
  const flush = (end: number) => {
    const part = expression.slice(cursor, end).trim();
    if (part) (mode === "condition" ? conditionParts : valueParts).push(part);
    cursor = end;
  };

  for (const match of tokens) {
    const token = match[0]!;
    if (token.startsWith("'") || token.startsWith('"') || !/^[A-Za-z_]/.test(token)) continue;
    const keyword = token.toLowerCase();
    const start = match.index ?? 0;
    const end = start + token.length;
    if (keyword === "case") {
      flush(start);
      stack.push({ state: "condition" });
      mode = "condition";
      cursor = end;
    } else if (stack.length && keyword === "when") {
      flush(start);
      stack[stack.length - 1]!.state = "condition";
      mode = "condition";
      cursor = end;
    } else if (stack.length && (keyword === "then" || keyword === "else")) {
      flush(start);
      stack[stack.length - 1]!.state = "value";
      mode = "value";
      cursor = end;
    } else if (stack.length && keyword === "end") {
      flush(start);
      stack.pop();
      mode = stack.length ? stack[stack.length - 1]!.state : "value";
      cursor = end;
    }
  }
  flush(expression.length);
  return { valueParts, conditionParts, valid: stack.length === 0 };
}

function resolveQuery(query: SqlAstQuery, schemas: LineageSchema[], depth = 0): AstScopeResolution {
  if (depth > 12) {
    return { status: "unsupported", projections: [], sourceColumns: [], sourceReferences: [], warnings: ["تجاوز حل النطاق عمق التحليل المسموح."] };
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
    if (join.type === "cross") {
      inheritedWarnings.push("CROSS JOIN لا يملك شرط مطابقة؛ قد يضاعف الصفوف وفق حاصل الضرب الديكارتي.");
    } else if (!join.condition && join.using.length === 0) {
      inheritedWarnings.push("لم يُعثر على شرط ON أو USING لهذا JOIN؛ لا يمكن تقييم مفاتيح المطابقة.");
    } else if (join.condition && !/(?:^|[^<>!])=(?!=)/.test(join.condition)) {
      inheritedWarnings.push("شرط JOIN ليس مساواة مباشرة مؤكدة؛ لا يمكن استنتاج علاقة المفاتيح أو cardinality منه.");
    }
  }

  const resolveIdentifiers = (expression: string, allowOutputAliases = false) => {
    const identifiers = expressionIdentifiers(expression).filter((item) => !item.functionName);
    const dependencies = new Set<string>();
    const sourceReferences = new Map<string, AstSourceReference>();
    const issues: string[] = [];
    const expressionTokens = [...expression.matchAll(/"(?:[^"]|"")*"|'(?:[^']|'')*'|[A-Za-z_][A-Za-z0-9_$]*|[0-9]+(?:\.[0-9]+)?|\*|[^\s]/g)]
      .map((match) => match[0]);
    const hasWildcardProjection = expressionTokens.some((token, index) =>
      token === "*" && (index === 0 || expressionTokens[index - 1] === "."),
    );
    if (hasWildcardProjection) {
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
            aliasDeps.sourceReferences.forEach((reference) => sourceReferences.set(
              `${reference.table.toLowerCase()}::${reference.column.toLowerCase()}`, reference,
            ));
            issues.push(...aliasDeps.issues);
            continue;
          }
        }
        issues.push(`تعذر حل العمود ${identifier.qualifier ? identifier.qualifier + "." : ""}${identifier.name} ضمن المصادر المعروفة.`);
        continue;
      }
      matches[0]!.sourceColumns.forEach((column) => dependencies.add(column));
      matches[0]!.sourceReferences.forEach((reference) => sourceReferences.set(
        `${reference.table.toLowerCase()}::${reference.column.toLowerCase()}`, reference,
      ));
    }
    return { dependencies, sourceReferences: [...sourceReferences.values()], issues };
  };

  let projections: AstResolvedProjection[] = query.projections.map((projection, index) => {
    const caseParts = splitCaseExpression(projection.expression);
    const hasCase = /\bcase\b/i.test(projection.expression);
    const valueExpression = hasCase ? caseParts.valueParts.join(" ") : projection.expression;
    const valueResult = resolveIdentifiers(stripCastTypeAnnotations(valueExpression));
    const conditionResult = hasCase
      ? resolveIdentifiers(stripCastTypeAnnotations(caseParts.conditionParts.join(" ")))
      : { dependencies: new Set<string>(), sourceReferences: [] as AstSourceReference[], issues: [] as string[] };
    const allDependencies = new Set([...valueResult.dependencies, ...conditionResult.dependencies]);
    const allReferences = [...new Map(
      [...valueResult.sourceReferences, ...conditionResult.sourceReferences].map((reference) => [
        `${reference.table.toLowerCase()}::${reference.column.toLowerCase()}`,
        reference,
      ]),
    ).values()];
    const issues = [...valueResult.issues, ...conditionResult.issues];
    if (hasCase && !caseParts.valid) issues.push("بنية CASE غير مكتملة؛ تعذر فصل شروطها عن تعبيرات القيم بأمان.");
    const outputName = projection.alias ??
      (expressionIdentifiers(projection.expression).filter((item) => !item.functionName).length === 1
        ? expressionIdentifiers(projection.expression).find((item) => !item.functionName)!.name
        : `expression_${index + 1}`);
    const status: AstResolutionStatus = issues.some((issue) => issue.includes("ملتبس"))
      ? "ambiguous" : issues.length ? "unresolved" : "resolved";
    return {
      outputName,
      expression: projection.expression,
      sourceColumns: [...allDependencies].sort(),
      sourceReferences: allReferences,
      valueSourceColumns: [...valueResult.dependencies].sort(),
      valueSourceReferences: [...valueResult.sourceReferences].sort((a, b) =>
        a.table.localeCompare(b.table) || a.column.localeCompare(b.column)),
      conditionSourceColumns: [...conditionResult.dependencies].sort(),
      conditionSourceReferences: [...conditionResult.sourceReferences].sort((a, b) =>
        a.table.localeCompare(b.table) || a.column.localeCompare(b.column)),
      rowFilterSourceColumns: [],
      rowFilterSourceReferences: [],
      status,
      ...(issues.length ? { reason: issues.join(" ") } : {}),
    };
  });

  let unsupportedSetOperationBranch = false;
  const setOperationWarnings: string[] = [];
  const setOperationSourceColumns = new Set<string>();
  const setOperationSourceReferences = new Map<string, AstSourceReference>();
  const mergeReferences = (...groups: AstSourceReference[][]): AstSourceReference[] => {
    const merged = new Map<string, AstSourceReference>();
    groups.flat().forEach((reference) => merged.set(
      `${reference.table.toLowerCase()}::${reference.column.toLowerCase()}`, reference,
    ));
    return [...merged.values()].sort((a, b) =>
      a.table.localeCompare(b.table) || a.column.localeCompare(b.column));
  };
  const mergeStatus = (left: AstResolutionStatus, right: AstResolutionStatus): AstResolutionStatus => {
    if (left === "ambiguous" || right === "ambiguous") return "ambiguous";
    if (left === "unresolved" || right === "unresolved") return "unresolved";
    return "resolved";
  };

  // Resolve every set-operation branch. UNION contributes values from both sides;
  // INTERSECT / EXCEPT right branches affect row membership, not output values.
  for (const operation of query.setOperations) {
    if (!operation.query || operation.projectionAlignment.length !== projections.length ||
        operation.projectionAlignment.some((alignment, index) => alignment.outputIndex !== index)) {
      unsupportedSetOperationBranch = true;
      setOperationWarnings.push("تعذر التحقق من محاذاة أعمدة أحد فروع Set Operation؛ تم إيقاف اعتماد Lineage.");
      continue;
    }
    const branchResult = resolveQuery(operation.query, schemas, depth + 1);
    if (branchResult.projections.length !== projections.length) {
      unsupportedSetOperationBranch = true;
      setOperationWarnings.push("عدد أعمدة فرع Set Operation لا يطابق مخرجات الفرع الأساسي.");
      continue;
    }
    if (branchResult.status === "unsupported") unsupportedSetOperationBranch = true;
    setOperationWarnings.push(...branchResult.warnings);
    branchResult.sourceColumns.forEach((column) => setOperationSourceColumns.add(column));
    branchResult.sourceReferences.forEach((reference) => setOperationSourceReferences.set(
      `${reference.table.toLowerCase()}::${reference.column.toLowerCase()}`, reference,
    ));

    projections = projections.map((projection, index) => {
      const branchProjection = branchResult.projections[index]!;
      if (operation.operator === "union") {
        return {
          ...projection,
          sourceColumns: [...new Set([...projection.sourceColumns, ...branchProjection.sourceColumns])].sort(),
          sourceReferences: mergeReferences(projection.sourceReferences, branchProjection.sourceReferences),
          valueSourceColumns: [...new Set([...projection.valueSourceColumns, ...branchProjection.valueSourceColumns])].sort(),
          valueSourceReferences: mergeReferences(projection.valueSourceReferences, branchProjection.valueSourceReferences),
          conditionSourceColumns: [...new Set([...projection.conditionSourceColumns, ...branchProjection.conditionSourceColumns])].sort(),
          conditionSourceReferences: mergeReferences(projection.conditionSourceReferences, branchProjection.conditionSourceReferences),
          rowFilterSourceColumns: [...new Set([
            ...projection.rowFilterSourceColumns,
            ...branchProjection.rowFilterSourceColumns,
          ])].sort(),
          rowFilterSourceReferences: mergeReferences(
            projection.rowFilterSourceReferences,
            branchProjection.rowFilterSourceReferences,
          ),
          status: mergeStatus(projection.status, branchProjection.status),
          ...(branchProjection.reason
            ? { reason: [projection.reason, branchProjection.reason].filter(Boolean).join(" ") }
            : {}),
        };
      }
      return {
        ...projection,
        rowFilterSourceColumns: [...new Set([
          ...projection.rowFilterSourceColumns,
          ...branchProjection.sourceColumns,
          ...branchProjection.rowFilterSourceColumns,
        ])].sort(),
        rowFilterSourceReferences: mergeReferences(
          projection.rowFilterSourceReferences,
          branchProjection.sourceReferences,
          branchProjection.rowFilterSourceReferences,
        ),
      };
    });
  }

  const allDependencies = new Set([
    ...projections.flatMap((projection) => [
      ...projection.sourceColumns,
      ...projection.rowFilterSourceColumns,
    ]),
    ...setOperationSourceColumns,
  ]);
  const allSourceReferences = new Map<string, AstSourceReference>();
  const addSourceReference = (reference: AstSourceReference) => allSourceReferences.set(
    `${reference.table.toLowerCase()}::${reference.column.toLowerCase()}`, reference,
  );
  projections.forEach((projection) => {
    projection.sourceReferences.forEach(addSourceReference);
    projection.rowFilterSourceReferences.forEach(addSourceReference);
  });
  setOperationSourceReferences.forEach(addSourceReference);
  bindings.forEach((binding) => {
    binding.sourceColumns?.forEach((column) => allDependencies.add(column));
    binding.sourceReferences?.forEach(addSourceReference);
  });
  const clauseExpressions = [
    query.where, query.having, query.qualify,
    ...query.groupBy, ...query.orderBy,
    ...query.joins.map((join) => join.condition),
  ].filter((value): value is string => Boolean(value));
  for (const expression of clauseExpressions) {
    const result = resolveIdentifiers(expression, true);
    result.dependencies.forEach((column) => allDependencies.add(column));
    result.sourceReferences.forEach(addSourceReference);
    inheritedWarnings.push(...result.issues);
  }
  // USING columns are join keys present on both relations; include both source dependencies.
  for (const join of query.joins) {
    for (const name of join.using) {
      const matches = bindings.flatMap((binding) => binding.columns.filter((column) => column.name.toLowerCase() === name.toLowerCase()));
      if (matches.length < 2) inheritedWarnings.push(`تعذر التحقق من عمود USING(${name}) في طرفي JOIN.`);
      matches.forEach((column) => {
        column.sourceColumns.forEach((source) => allDependencies.add(source));
        column.sourceReferences.forEach(addSourceReference);
      });
    }
  }

  const warnings = [
    ...inheritedWarnings,
    ...setOperationWarnings,
    ...projections.filter((projection) => projection.status !== "resolved")
      .map((projection) => `${projection.outputName}: ${projection.reason}`),
  ];
  const unsupportedSources = Boolean(query.from && !base) ||
    query.joins.some((join, index) => !bindings[index + (base ? 1 : 0)]);
  return {
    status: unsupportedSources || unsupportedSetOperationBranch ? "unsupported" : warnings.length ? "partial" : "resolved",
    projections,
    sourceColumns: [...allDependencies].sort(),
    sourceReferences: [...allSourceReferences.values()].sort((a, b) =>
      a.table.localeCompare(b.table) || a.column.localeCompare(b.column)),
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
      sourceReferences: [],
      warnings: parsed.warnings.length ? parsed.warnings : ["تعذر بناء AST صالح لحل نطاق SQL."],
    };
  }
  return resolveQuery(parsed.query, schemas);
}
