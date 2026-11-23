import { scanSql } from "@/lib/sql-tokenize";

export type SqlAstDialect = "duckdb";
export type SqlAstStatus = "parsed" | "unsupported" | "invalid";

export interface SqlAstToken {
  kind: "word" | "identifier" | "string" | "number" | "symbol" | "operator";
  value: string;
  start: number;
  end: number;
}

export interface SqlAstProjection {
  expression: string;
  alias: string | null;
}

export interface SqlAstRelation {
  name: string;
  alias: string | null;
  kind: "table" | "subquery" | "cte" | "unknown";
  subquery?: SqlAstQuery;
}

export interface SqlAstJoin {
  type: "inner" | "left" | "right" | "full" | "cross" | "natural" | "unknown";
  relation: SqlAstRelation;
  condition: string | null;
  using: string[];
}

export interface SqlAstCte {
  name: string;
  query: SqlAstQuery;
  recursive: boolean;
}

export interface SqlAstQuery {
  kind: "select";
  projections: SqlAstProjection[];
  from: SqlAstRelation | null;
  joins: SqlAstJoin[];
  where: string | null;
  groupBy: string[];
  having: string | null;
  qualify: string | null;
  orderBy: string[];
  limit: string | null;
  offset: string | null;
  ctes: SqlAstCte[];
  setOperations: Array<{ operator: "union" | "intersect" | "except"; all: boolean; query: SqlAstQuery | null }>;
}

export interface SqlAstParseResult {
  status: SqlAstStatus;
  dialect: SqlAstDialect;
  query?: SqlAstQuery;
  tokens: SqlAstToken[];
  warnings: string[];
  error?: string;
}

const CLAUSE_STARTS = [
  ["where"], ["group", "by"], ["having"], ["qualify"], ["window"],
  ["order", "by"], ["limit"], ["offset"], ["fetch"], ["union"], ["intersect"], ["except"],
] as const;

function tokenize(sql: string): SqlAstToken[] {
  const tokens: SqlAstToken[] = [];
  const pattern = /"(?:[^"]|"")*"|'(?:[^']|'')*'|(?:\$[A-Za-z_][A-Za-z0-9_]*\$[\s\S]*?\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$[\s\S]*?\$\$)|[A-Za-z_][A-Za-z0-9_$]*|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|<=|>=|<>|!=|::|:=|\|\||->>|->|=>|[-+*/%^=<>~!@#&|?:]+|[(),.;\[\]{}]/g;
  for (const match of sql.matchAll(pattern)) {
    const value = match[0]!;
    const start = match.index ?? 0;
    const kind: SqlAstToken["kind"] = value.startsWith('"') ? "identifier"
      : value.startsWith("'") || value.startsWith("$") ? "string"
        : /^\d/.test(value) || value.startsWith(".") ? "number"
          : /^[A-Za-z_]/.test(value) ? "word"
            : /^[(),.;\[\]{}]$/.test(value) ? "symbol" : "operator";
    tokens.push({ kind, value, start, end: start + value.length });
  }
  return tokens;
}

function isWord(token: SqlAstToken | undefined, value: string): boolean {
  return token?.kind === "word" && token.value.toLowerCase() === value;
}

function unquoteIdentifier(value: string): string {
  return value.startsWith('"') ? value.slice(1, -1).replace(/""/g, '"') : value;
}

function findTopLevel(tokens: SqlAstToken[], start: number, words: readonly string[]): number {
  let depth = 0;
  for (let i = start; i <= tokens.length - words.length; i++) {
    const token = tokens[i]!;
    if (token.value === "(" || token.value === "[") { depth++; continue; }
    if (token.value === ")" || token.value === "]") { depth = Math.max(0, depth - 1); continue; }
    if (depth !== 0) continue;
    if (words.every((word, offset) => isWord(tokens[i + offset], word))) return i;
  }
  return -1;
}

function splitTopLevel(tokens: SqlAstToken[], start: number, end: number): SqlAstToken[][] {
  const parts: SqlAstToken[][] = [];
  let depth = 0;
  let partStart = start;
  for (let i = start; i < end; i++) {
    const value = tokens[i]!.value;
    if (value === "(" || value === "[") depth++;
    else if (value === ")" || value === "]") depth = Math.max(0, depth - 1);
    else if (value === "," && depth === 0) {
      if (i > partStart) parts.push(tokens.slice(partStart, i));
      partStart = i + 1;
    }
  }
  if (partStart < end) parts.push(tokens.slice(partStart, end));
  return parts;
}

function textOf(sql: string, tokens: SqlAstToken[], start: number, end: number): string {
  if (start >= end) return "";
  return sql.slice(tokens[start]!.start, tokens[end - 1]!.end).trim();
}

function clauseRanges(tokens: SqlAstToken[], fromIndex: number): Map<string, { start: number; end: number }> {
  const found: Array<{ name: string; start: number; width: number }> = [];
  for (const words of CLAUSE_STARTS) {
    const index = findTopLevel(tokens, fromIndex, words);
    if (index >= 0) found.push({ name: words.join(" "), start: index, width: words.length });
  }
  found.sort((a, b) => a.start - b.start);
  const ranges = new Map<string, { start: number; end: number }>();
  for (let i = 0; i < found.length; i++) {
    const item = found[i]!;
    ranges.set(item.name, { start: item.start + item.width, end: found[i + 1]?.start ?? tokens.length });
  }
  return ranges;
}

function parseProjection(sql: string, tokens: SqlAstToken[]): SqlAstProjection {
  const asIndex = findTopLevel(tokens, 0, ["as"]);
  if (asIndex > 0 && tokens[asIndex + 1]) {
    return {
      expression: textOf(sql, tokens, 0, asIndex),
      alias: unquoteIdentifier(tokens[asIndex + 1]!.value),
    };
  }
  const last = tokens[tokens.length - 1];
  const previous = tokens[tokens.length - 2];
  if (last && previous && (last.kind === "word" || last.kind === "identifier") &&
      previous.value !== "." && previous.value !== "::" &&
      !["end", "null", "true", "false"].includes(last.value.toLowerCase())) {
    const expressionTokens = tokens.slice(0, -1);
    if (expressionTokens.length && (previous.kind === "word" || previous.kind === "identifier" || previous.value === ")")) {
      return { expression: textOf(sql, tokens, 0, tokens.length - 1), alias: unquoteIdentifier(last.value) };
    }
  }
  return { expression: textOf(sql, tokens, 0, tokens.length), alias: null };
}

function parseRelation(sql: string, tokens: SqlAstToken[], cteNames: Set<string>): SqlAstRelation | null {
  if (!tokens.length) return null;
  let cursor = 0;
  let kind: SqlAstRelation["kind"] = "table";
  let name = "";
  let subquery: SqlAstQuery | undefined;
  if (tokens[0]!.value === "(") {
    let depth = 0, close = -1;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i]!.value === "(") depth++;
      else if (tokens[i]!.value === ")" && --depth === 0) { close = i; break; }
    }
    if (close < 0) return null;
    const inner = textOf(sql, tokens, 1, close);
    const parsed = parseQuery(inner);
    if (parsed.status !== "parsed" || !parsed.query) return null;
    subquery = parsed.query;
    kind = "subquery";
    name = "(subquery)";
    cursor = close + 1;
  } else {
    const parts: string[] = [];
    while (cursor < tokens.length) {
      const token = tokens[cursor]!;
      if (token.kind !== "word" && token.kind !== "identifier") break;
      parts.push(unquoteIdentifier(token.value));
      cursor++;
      if (tokens[cursor]?.value !== ".") break;
      cursor++;
    }
    if (!parts.length) return null;
    name = parts.join(".");
    if (cteNames.has(name.toLowerCase())) kind = "cte";
    if (tokens[cursor]?.value === "(") kind = "unknown"; // Table functions need dedicated grammar support.
  }
  if (isWord(tokens[cursor], "as")) cursor++;
  let alias: string | null = null;
  const candidate = tokens[cursor];
  if (candidate && (candidate.kind === "word" || candidate.kind === "identifier") &&
      !["on", "using", "join", "inner", "left", "right", "full", "cross", "natural", "where", "group", "order", "having", "limit"].includes(candidate.value.toLowerCase())) {
    alias = unquoteIdentifier(candidate.value);
  }
  return { name, alias, kind, ...(subquery ? { subquery } : {}) };
}

function parseFrom(sql: string, tokens: SqlAstToken[], cteNames: Set<string>): {
  from: SqlAstRelation | null;
  joins: SqlAstJoin[];
  unsupported?: string;
} {
  if (!tokens.length) return { from: null, joins: [] };
  const joinStarts: Array<{ index: number; type: SqlAstJoin["type"]; width: number }> = [];
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const value = tokens[i]!.value;
    if (value === "(") { depth++; continue; }
    if (value === ")") { depth = Math.max(0, depth - 1); continue; }
    if (depth !== 0 || !isWord(tokens[i], "join")) continue;
    const previous = tokens[i - 1]?.value.toLowerCase();
    const beforePrevious = tokens[i - 2]?.value.toLowerCase();
    const modifier = previous === "outer" ? beforePrevious : previous;
    const type = modifier === "left" ? "left" : modifier === "right" ? "right"
      : modifier === "full" ? "full" : modifier === "cross" ? "cross"
        : modifier === "natural" ? "natural" : modifier === "inner" ? "inner" : "unknown";
    joinStarts.push({ index: i, type, width: 1 });
  }
  const firstJoin = joinStarts[0]?.index ?? tokens.length;
  const baseTokens = tokens.slice(0, firstJoin);
  const commaRelations = splitTopLevel(baseTokens, 0, baseTokens.length);
  if (commaRelations.length > 1 && joinStarts.length > 0) {
    return { from: null, joins: [], unsupported: "مزج مصادر FROM المفصولة بفواصل مع JOIN يحتاج قواعد تحليل إضافية؛ تم إيقاف التتبع." };
  }
  if (commaRelations.length > 1) {
    const relations = commaRelations.map((part) => parseRelation(sql, part, cteNames));
    if (relations.some((relation) => !relation || relation.kind === "unknown")) {
      return { from: relations[0] ?? null, joins: [], unsupported: "تعذر تحليل أحد مصادر FROM المفصولة بفواصل بأمان." };
    }
    return {
      from: relations[0]!,
      joins: relations.slice(1).map((relation) => ({
        type: "cross" as const,
        relation: relation!,
        condition: null,
        using: [],
      })),
    };
  }
  const from = parseRelation(sql, baseTokens, cteNames);
  if (from?.kind === "unknown") return { from, joins: [], unsupported: "مصدر جدولي من نوع Table Function غير مدعوم في محلل SQL AST الحالي." };
  const joins: SqlAstJoin[] = [];
  for (let i = 0; i < joinStarts.length; i++) {
    const current = joinStarts[i]!;
    const next = joinStarts[i + 1]?.index ?? tokens.length;
    let relationStart = current.index + 1;
    const joinTokens = tokens.slice(relationStart, next);
    const onRelative = findTopLevel(joinTokens, 0, ["on"]);
    const usingRelative = findTopLevel(joinTokens, 0, ["using"]);
    const on = onRelative >= 0 ? relationStart + onRelative : -1;
    const using = usingRelative >= 0 ? relationStart + usingRelative : -1;
    const conditionStart = on >= 0 ? on + 1 : -1;
    const usingStart = using >= 0 ? using + 1 : -1;
    const relationEnd = Math.min(...[on, using, next].filter((v) => v >= 0));
    const relation = parseRelation(sql, tokens.slice(relationStart, relationEnd), cteNames);
    const conditionEnd = using >= 0 ? using : next;
    const condition = conditionStart >= 0 ? textOf(sql, tokens, conditionStart, conditionEnd) : null;
    let usingColumns: string[] = [];
    if (usingStart >= 0) {
      const open = tokens.findIndex((token, index) => index >= usingStart && token.value === "(");
      const close = open >= 0 ? tokens.findIndex((token, index) => index > open && token.value === ")") : -1;
      if (open >= 0 && close > open) usingColumns = splitTopLevel(tokens, open + 1, close).map((part) => unquoteIdentifier(part[0]!.value));
    }
    if (relation?.kind === "unknown") {
      return { from, joins, unsupported: "مصدر JOIN من نوع Table Function غير مدعوم في محلل SQL AST الحالي." };
    }
    if (relation) joins.push({ type: current.type, relation, condition, using: usingColumns });
  }
  return { from, joins };
}

function parseQuery(sql: string, depth = 0): SqlAstParseResult {
  const scanned = scanSql(sql);
  if (!scanned.ok) return { status: "invalid", dialect: "duckdb", tokens: [], warnings: [], error: scanned.reason };
  if (depth > 12) return { status: "unsupported", dialect: "duckdb", tokens: [], warnings: ["تجاوز الاستعلام عمق التحليل المسموح."] };
  const clean = scanned.clean.trim().replace(/;+\s*$/, "").trim();
  const tokens = tokenize(clean);
  if (!tokens.length || !isWord(tokens[0], "select") && !isWord(tokens[0], "with")) {
    return { status: "unsupported", dialect: "duckdb", tokens, warnings: ["يدعم المحلل حالياً استعلامات SELECT وWITH ... SELECT فقط."] };
  }
  let cursor = 0;
  const ctes: SqlAstCte[] = [];
  if (isWord(tokens[cursor], "with")) {
    cursor++;
    const recursive = isWord(tokens[cursor], "recursive");
    if (recursive) cursor++;
    while (cursor < tokens.length) {
      const nameToken = tokens[cursor];
      if (!nameToken || (nameToken.kind !== "word" && nameToken.kind !== "identifier")) break;
      const name = unquoteIdentifier(nameToken.value);
      cursor++;
      if (tokens[cursor]?.value === "(") {
        let depthCount = 0;
        do {
          if (tokens[cursor]?.value === "(") depthCount++;
          if (tokens[cursor]?.value === ")") depthCount--;
          cursor++;
        } while (cursor < tokens.length && depthCount > 0);
      }
      if (!isWord(tokens[cursor], "as")) break;
      cursor++;
      if (tokens[cursor]?.value !== "(") break;
      const open = cursor++;
      let nested = 1;
      while (cursor < tokens.length && nested > 0) {
        if (tokens[cursor]!.value === "(") nested++;
        if (tokens[cursor]!.value === ")") nested--;
        cursor++;
      }
      if (nested !== 0) break;
      const inner = textOf(clean, tokens, open + 1, cursor - 1);
      const parsed = parseQuery(inner, depth + 1);
      if (!parsed.query) return {
        status: parsed.status,
        dialect: "duckdb",
        tokens,
        warnings: parsed.warnings,
        ...(parsed.error ? { error: parsed.error } : {}),
      };
      ctes.push({ name, query: parsed.query, recursive });
      if (tokens[cursor]?.value !== ",") break;
      cursor++;
    }
  }
  const selectIndex = findTopLevel(tokens, cursor, ["select"]);
  if (selectIndex < 0) return { status: "unsupported", dialect: "duckdb", tokens, warnings: ["تعذر تحديد SELECT الرئيسي."] };
  const fromIndex = findTopLevel(tokens, selectIndex + 1, ["from"]);
  if (fromIndex < 0) return { status: "unsupported", dialect: "duckdb", tokens, warnings: ["استعلام SELECT بلا FROM خارج النطاق المدعوم حالياً."] };
  const setIndex = Math.min(...["union", "intersect", "except"].map((word) => findTopLevel(tokens, fromIndex + 1, [word])).filter((index) => index >= 0), tokens.length);
  const queryEnd = setIndex;
  const ranges = clauseRanges(tokens.slice(0, queryEnd), fromIndex + 1);
  const range = (name: string) => ranges.get(name);
  const projectionParts = splitTopLevel(tokens, selectIndex + 1, fromIndex);
  const projections = projectionParts.map((part) => parseProjection(clean, part));
  const fromClauseStarts = CLAUSE_STARTS
    .map((words) => findTopLevel(tokens.slice(0, queryEnd), fromIndex + 1, words))
    .filter((index) => index >= 0);
  const fromEndIndex = fromClauseStarts.length ? Math.min(...fromClauseStarts) : queryEnd;
  const fromTokens = tokens.slice(fromIndex + 1, fromEndIndex);
  const parsedFrom = parseFrom(clean, fromTokens, new Set(ctes.map((cte) => cte.name.toLowerCase())));
  if (parsedFrom.unsupported) {
    return { status: "unsupported", dialect: "duckdb", tokens, warnings: [parsedFrom.unsupported] };
  }
  const clauseText = (name: string) => {
    const value = range(name);
    return value ? textOf(clean, tokens, value.start, value.end) || null : null;
  };
  const listClause = (name: string) => {
    const value = range(name);
    return value ? splitTopLevel(tokens, value.start, value.end).map((part) => textOf(clean, part, 0, part.length)) : [];
  };
  const setOperations: SqlAstQuery["setOperations"] = [];
  if (setIndex < tokens.length) {
    const operator = tokens[setIndex]!.value.toLowerCase() as "union" | "intersect" | "except";
    const all = isWord(tokens[setIndex + 1], "all");
    const nextStart = setIndex + (all || isWord(tokens[setIndex + 1], "distinct") ? 2 : 1);
    const parsed = parseQuery(textOf(clean, tokens, nextStart, tokens.length), depth + 1);
    setOperations.push({ operator, all, query: parsed.query ?? null });
  }
  const query: SqlAstQuery = {
    kind: "select",
    projections,
    from: parsedFrom.from,
    joins: parsedFrom.joins,
    where: clauseText("where"),
    groupBy: listClause("group by"),
    having: clauseText("having"),
    qualify: clauseText("qualify"),
    orderBy: listClause("order by"),
    limit: clauseText("limit"),
    offset: clauseText("offset"),
    ctes,
    setOperations,
  };
  return { status: "parsed", dialect: "duckdb", query, tokens, warnings: [] };
}

export function parseDuckDbSqlAst(sql: string): SqlAstParseResult {
  return parseQuery(sql);
}


export interface SqlAstResolvedColumn {
  outputName: string;
  expression: string;
  sourceColumns: string[];
  status: "resolved" | "unresolved" | "ambiguous";
}

export interface SqlAstScopeResolution {
  status: "resolved" | "partial" | "unsupported";
  sourceColumns: string[];
  outputColumns: SqlAstResolvedColumn[];
  warnings: string[];
}

type ResolvedProjection = { sourceColumns: string[]; status: "resolved" | "unresolved" | "ambiguous" };
const SCOPE_KEYWORDS = new Set(
  "select from where group by having qualify order limit offset fetch as and or not in is null like ilike between case when then else end distinct true false cast try_cast exists any some over partition rows range preceding following current row unbounded filter interval day month year int integer bigint double float decimal numeric varchar text string boolean date timestamp time blob json asc desc nulls first last".split(/\\s+/),
);

/**
 * Resolve projection dependencies for a deliberately narrow, single-source scope.
 * Joins, recursive CTEs, set operations and unknown relations fail closed.
 */
export function resolveDuckDbSqlAstScope(
  parsed: SqlAstParseResult,
  schema: { table: string; columns: Array<{ name: string; type?: string }> },
): SqlAstScopeResolution {
  if (parsed.status !== "parsed" || !parsed.query) {
    return { status: "unsupported", sourceColumns: [], outputColumns: [], warnings: ["تعذر حل نطاق SQL لأن AST غير مكتمل."] };
  }
  const knownColumns = new Map(schema.columns.map((column) => [column.name.toLowerCase(), column.name]));
  const normalize = (value: string) => value.replace(/^"|"$/g, "").replace(/""/g, '"').toLowerCase();
  const baseTable = normalize(schema.table.split(".").at(-1) ?? schema.table);

  const resolveQuery = (query: SqlAstQuery, inherited: Map<string, ResolvedProjection>, depth: number): {
    outputs: Map<string, ResolvedProjection>;
    columns: Set<string>;
    status: "resolved" | "partial" | "unsupported";
    warnings: string[];
  } => {
    if (depth > 12 || query.joins.length || query.setOperations.length) {
      return { outputs: new Map(), columns: new Set(), status: "unsupported", warnings: ["JOIN أو set operation أو عمق CTE غير مدعوم في محلّل النطاق الحالي."] };
    }
    const scope = new Map(inherited);
    for (const cte of query.ctes) {
      if (cte.recursive) return { outputs: new Map(), columns: new Set(), status: "unsupported", warnings: ["Recursive CTE غير مدعوم في حل الاعتماديات الحالي."] };
      const resolved = resolveQuery(cte.query, scope, depth + 1);
      if (resolved.status !== "resolved") return { outputs: new Map(), columns: new Set(), status: resolved.status, warnings: resolved.warnings };
      for (const [name, value] of resolved.outputs) scope.set(name, value);
    }

    const relation = query.from;
    if (!relation) return { outputs: new Map(), columns: new Set(), status: "unsupported", warnings: ["النطاق لا يحتوي مصدرًا واحدًا معروفًا."] };
    let relationColumns = new Map<string, ResolvedProjection>();
    let relationAlias = normalize(relation.alias ?? relation.name.split(".").at(-1) ?? relation.name);
    if (relation.kind === "cte") {
      const cteOutput = scope;
      relationColumns = new Map([...cteOutput].map(([name, value]) => [name, value]));
    } else if (relation.kind === "subquery" && relation.subquery) {
      const nested = resolveQuery(relation.subquery, scope, depth + 1);
      if (nested.status !== "resolved") return { outputs: new Map(), columns: new Set(), status: nested.status, warnings: nested.warnings };
      relationColumns = nested.outputs;
    } else if (relation.kind === "table" && normalize(relation.name.split(".").at(-1) ?? relation.name) === baseTable) {
      for (const [name, actual] of knownColumns) relationColumns.set(name, { sourceColumns: [actual], status: "resolved" });
    } else {
      return { outputs: new Map(), columns: new Set(), status: "unsupported", warnings: ["مصدر البيانات لا يطابق المخطط النشط أو لم يمكن حله."] };
    }

    const outputs = new Map<string, ResolvedProjection>();
    const allColumns = new Set<string>();
    let partial = false;
    for (let index = 0; index < query.projections.length; index++) {
      const projection = query.projections[index]!;
      const expressionTokens = tokenize(projection.expression);
      const dependencies = new Set<string>();
      let unresolved = false;
      let ambiguous = false;
      for (let i = 0; i < expressionTokens.length; i++) {
        const token = expressionTokens[i]!;
        if (token.kind !== "word" && token.kind !== "identifier") continue;
        const name = normalize(token.value);
        const previous = expressionTokens[i - 1]?.value;
        const next = expressionTokens[i + 1]?.value;
        if (next === "(" || SCOPE_KEYWORDS.has(name)) continue;
        if (previous === "." || next === ".") continue;
        const qualified = previous === "." ? normalize(expressionTokens[i - 2]?.value ?? "") : null;
        if (qualified && qualified !== relationAlias) continue;
        const source = relationColumns.get(name);
        if (source) {
          source.sourceColumns.forEach((column) => dependencies.add(column));
          if (source.status !== "resolved") { unresolved = true; ambiguous ||= source.status === "ambiguous"; }
        } else if (/^\\d/.test(token.value)) {
          continue;
        } else {
          unresolved = true;
        }
      }
      // A projection containing only literals is resolved with no source dependency.
      const hasIdentifier = expressionTokens.some((token) =>
        (token.kind === "word" || token.kind === "identifier") && !SCOPE_KEYWORDS.has(normalize(token.value)) && expressionTokens[expressionTokens.indexOf(token) + 1]?.value !== "(",
      );
      const status = ambiguous ? "ambiguous" : unresolved && hasIdentifier ? "unresolved" : "resolved";
      if (status !== "resolved") partial = true;
      const outputName = normalize(projection.alias ?? projection.expression.split(".").at(-1) ?? `expression_${index + 1}`);
      const result = { sourceColumns: [...dependencies].sort(), status } as ResolvedProjection;
      outputs.set(outputName, result);
      dependencies.forEach((column) => allColumns.add(column));
    }
    return {
      outputs,
      columns: allColumns,
      status: partial ? "partial" : "resolved",
      warnings: partial ? ["تعذر ربط عمود أو أكثر داخل نطاق الاستعلام دون تخمين."] : [],
    };
  };

  const resolved = resolveQuery(parsed.query, new Map(), 0);
  if (resolved.status === "unsupported") {
    return { status: "unsupported", sourceColumns: [], outputColumns: [], warnings: resolved.warnings };
  }
  return {
    status: resolved.status,
    sourceColumns: [...resolved.columns].sort(),
    outputColumns: [...resolved.outputs].map(([outputName, value]) => ({
      outputName,
      expression: outputName,
      sourceColumns: value.sourceColumns,
      status: value.status,
    })),
    warnings: resolved.warnings,
  };
}
