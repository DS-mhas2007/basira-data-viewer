/**
 * Metric Lineage v1 — conservative SQL dependency tracing.
 *
 * This module intentionally does not pretend to be a full SQL parser.
 * It records dependencies that can be tied to the active dataset schema and
 * marks constructs that require a dialect-aware AST parser as partial.
 */
import { scanSql } from "@/lib/sql-tokenize";
import type { CleanStep } from "@/lib/cleaning";
import type { DuckDbPlanSummary } from "@/lib/duckdb-plan";

export type LineageConfidence = "high" | "medium" | "low";
export type LineageStatus = "complete" | "partial" | "unsupported";
export type LineageOperationKind =
  | "source"
  | "cleaning"
  | "filter"
  | "join"
  | "group"
  | "aggregate"
  | "having"
  | "window"
  | "distinct"
  | "cast"
  | "projection"
  | "sort"
  | "limit";

export interface MetricLineageColumn {
  outputName: string;
  expression: string;
  sourceColumns: string[];
  operations: string[];
  role: "metric" | "dimension" | "derived" | "unknown";
  confidence: LineageConfidence;
}

export interface MetricLineageOperation {
  kind: LineageOperationKind;
  label: string;
  detail?: string | undefined;
}

export interface MetricLineage {
  version: 1;
  status: LineageStatus;
  confidence: LineageConfidence;
  sourceTable: string;
  sourceColumns: string[];
  outputColumns: MetricLineageColumn[];
  operations: MetricLineageOperation[];
  warnings: string[];
  executionPlan?: DuckDbPlanSummary;
}

export interface LineageSchema {
  table: string;
  columns: { name: string; type: string }[];
}

const KEYWORDS = new Set(
  `SELECT FROM WHERE GROUP BY ORDER HAVING LIMIT OFFSET AS AND OR NOT IN IS NULL LIKE ILIKE
   BETWEEN CASE WHEN THEN ELSE END JOIN INNER LEFT RIGHT FULL OUTER CROSS NATURAL USING UNION ALL
   EXCEPT INTERSECT DISTINCT WITH RECURSIVE ASC DESC NULLS FIRST LAST TRUE FALSE CAST TRY_CAST
   EXISTS ANY SOME OVER PARTITION ROWS RANGE PRECEDING FOLLOWING CURRENT ROW UNBOUNDED FILTER
   QUALIFY WINDOW LATERAL VALUES INTERVAL DAY MONTH YEAR HOUR MINUTE SECOND EPOCH
   INT INTEGER BIGINT DOUBLE FLOAT DECIMAL NUMERIC VARCHAR TEXT STRING BOOLEAN DATE TIMESTAMP TIME BLOB JSON
   ESCAPE COLLATE SIMILAR TO GLOB`.split(/\s+/).filter(Boolean),
);

const AGGREGATES = /\b(sum|avg|average|count|min|max|median|quantile|approx_count_distinct|stddev|stddev_pop|stddev_samp|variance|var_pop|var_samp|list|array_agg|string_agg)\s*[(]/i;
const WINDOW = /\bover\s*[(]/i;
const CAST = /\b(try_cast|cast)\s*[(]/i;

function normalizeIdentifier(raw: string): string {
  return raw.startsWith('"') ? raw.slice(1, -1).replace(/""/g, '"') : raw;
}

function isWordChar(ch: string | undefined): boolean {
  return Boolean(ch && /[A-Za-z0-9_$]/.test(ch));
}

/** Split a SQL fragment on a delimiter only when outside parentheses and quoted identifiers. */
export function splitSqlTopLevel(input: string, delimiter = ","): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let inIdentifier = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (inIdentifier) {
      if (ch === '"' && input[i + 1] === '"') { i++; continue; }
      if (ch === '"') inIdentifier = false;
      continue;
    }
    if (ch === '"') { inIdentifier = true; continue; }
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === delimiter && depth === 0) {
      parts.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(input.slice(start).trim());
  return parts.filter(Boolean);
}

/** Find a clause keyword at depth zero. */
function findTopLevelKeyword(sql: string, keyword: string, from = 0): number {
  let depth = 0;
  let inIdentifier = false;
  const lower = sql.toLowerCase();
  const target = keyword.toLowerCase();
  for (let i = from; i <= sql.length - target.length; i++) {
    const ch = sql[i]!;
    if (inIdentifier) {
      if (ch === '"' && sql[i + 1] === '"') { i++; continue; }
      if (ch === '"') inIdentifier = false;
      continue;
    }
    if (ch === '"') { inIdentifier = true; continue; }
    if (ch === "(") { depth++; continue; }
    if (ch === ")") { depth = Math.max(0, depth - 1); continue; }
    if (depth !== 0 || !lower.startsWith(target, i)) continue;
    if (isWordChar(sql[i - 1]) || isWordChar(sql[i + target.length])) continue;
    return i;
  }
  return -1;
}

function clauseEnd(sql: string, start: number): number {
  const clauses = ["where", "group by", "having", "qualify", "window", "order by", "limit", "offset", "union", "except", "intersect"];
  const found = clauses.map((clause) => findTopLevelKeyword(sql, clause, start)).filter((index) => index >= 0);
  return found.length ? Math.min(...found) : sql.length;
}

function mainSelectRange(sql: string): { selectStart: number; fromStart: number; selectEnd: number; fromEnd: number } | null {
  const selectStart = findTopLevelKeyword(sql, "select");
  if (selectStart < 0) return null;
  const fromStart = findTopLevelKeyword(sql, "from", selectStart + 6);
  if (fromStart < 0) return null;
  const selectEnd = fromStart;
  const fromEnd = clauseEnd(sql, fromStart + 4);
  return { selectStart, fromStart, selectEnd, fromEnd };
}

function extractAlias(expression: string, index: number): { body: string; alias: string } {
  const asMatch = /\s+as\s+("(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)\s*$/i.exec(expression);
  if (asMatch) {
    return { body: expression.slice(0, asMatch.index).trim(), alias: normalizeIdentifier(asMatch[1]!) };
  }
  const direct = /^\s*("(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)\s*$/.exec(expression);
  if (direct) {
    const name = normalizeIdentifier(direct[1]!);
    return { body: expression.trim(), alias: name };
  }
  return { body: expression.trim(), alias: `expression_${index + 1}` };
}

function referencedColumns(expression: string, schema: LineageSchema): string[] {
  const known = new Map(schema.columns.map((column) => [column.name.toLowerCase(), column.name]));
  const found = new Set<string>();
  const pattern = /"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*/g;
  for (const match of expression.matchAll(pattern)) {
    const raw = match[0]!;
    const name = normalizeIdentifier(raw);
    const after = expression.slice((match.index ?? 0) + raw.length).trimStart();
    if (after.startsWith("(")) continue; // function name, not a column
    if (!raw.startsWith('"') && KEYWORDS.has(name.toUpperCase())) continue;
    const column = known.get(name.toLowerCase());
    if (column) found.add(column);
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

function operationKinds(expression: string): string[] {
  const out: string[] = [];
  if (AGGREGATES.test(expression)) out.push("aggregate");
  if (WINDOW.test(expression)) out.push("window");
  if (CAST.test(expression)) out.push("cast");
  if (/\bcase\b/i.test(expression)) out.push("conditional");
  if (/\bdistinct\b/i.test(expression)) out.push("distinct");
  if (/[+*/-]/.test(expression)) out.push("arithmetic");
  return out;
}

function clauseValue(sql: string, clause: string, nextClauses: string[]): string | null {
  const start = findTopLevelKeyword(sql, clause);
  if (start < 0) return null;
  const valueStart = start + clause.length;
  const ends = nextClauses.map((next) => findTopLevelKeyword(sql, next, valueStart)).filter((i) => i >= 0);
  const end = ends.length ? Math.min(...ends) : sql.length;
  return sql.slice(valueStart, end).trim() || null;
}

function isLiteralOnlyExpression(expression: string): boolean {
  return /^\s*(?:[-+]?\d+(?:\.\d+)?|''|true|false|null)\s*$/i.test(expression);
}

function summarizeExpressionRole(expression: string, operations: string[]): MetricLineageColumn["role"] {
  if (operations.includes("aggregate")) return "metric";
  if (operations.length > 0) return "derived";
  return /^[\s]*("?[^"]+"?|[A-Za-z_][A-Za-z0-9_$]*)[\s]*$/.test(expression) ? "dimension" : "derived";
}

export function buildMetricLineage(
  sql: string,
  schema: LineageSchema,
  cleaningSteps: CleanStep[] = [],
  executionPlan?: DuckDbPlanSummary,
): MetricLineage {
  const warnings: string[] = [];
  const operations: MetricLineageOperation[] = [
    { kind: "source", label: `المصدر: ${schema.table}` },
  ];
  for (const step of cleaningSteps) {
    const columns = [...(step.params.column ? [step.params.column] : []), ...(step.params.textColumns ?? [])];
    operations.push({
      kind: "cleaning",
      label: step.label,
      detail: columns.length ? `الأعمدة: ${[...new Set(columns)].join("، ")}` : step.kind,
    });
  }

  const scanned = scanSql(sql);
  if (!scanned.ok) {
    return {
      version: 1, status: "unsupported", confidence: "low", sourceTable: schema.table,
      sourceColumns: [], outputColumns: [], operations,
      warnings: ["تعذّر تحليل SQL بأمان؛ لم يتم تخمين مسار اشتقاق المقاييس."],
    };
  }
  const query = scanned.skeleton.trim().replace(/;+\s*$/, "").trim();
  const range = mainSelectRange(query);
  if (!range) {
    return {
      version: 1, status: "unsupported", confidence: "low", sourceTable: schema.table,
      sourceColumns: [], outputColumns: [], operations,
      warnings: ["لم يمكن تحديد بنية SELECT/FROM؛ لم يتم إنشاء تتبّع تقريبي."],
    };
  }

  const selectList = query.slice(range.selectStart + 6, range.selectEnd).trim();
  const fromClause = query.slice(range.fromStart + 4, range.fromEnd).trim();
  const outputColumns: MetricLineageColumn[] = splitSqlTopLevel(selectList).flatMap((item, index) => {
    const { body, alias } = extractAlias(item, index);
    // A wildcard is safe to expand only against the declared active-table schema.
    if (body === "*" || /^([A-Za-z_][A-Za-z0-9_$]*)\.\*$/.test(body)) {
      return schema.columns.map((column) => ({
        outputName: column.name,
        expression: body,
        sourceColumns: [column.name],
        operations: [],
        role: "dimension" as const,
        confidence: "medium" as const,
      }));
    }
    const sourceColumns = referencedColumns(body, schema);
    const ops = operationKinds(body);
    const complex = /\b(select|with|join)\b/i.test(body) || /\bover\s*[(]/i.test(body);
    return [{
      outputName: alias,
      expression: body.slice(0, 500),
      sourceColumns,
      operations: ops,
      role: summarizeExpressionRole(body, ops),
      confidence: complex ? "low" : sourceColumns.length > 0 || /count\s*[(]\s*\*\s*[)]/i.test(body) ? "high" : "medium",
    }];
  });

  // Include dependencies used only by filters, grouping, ordering and join predicates,
  // not just columns projected into the result.
  const hasWildcard = splitSqlTopLevel(selectList).some((item) => {
    const { body } = extractAlias(item, 0);
    return body === "*" || /^([A-Za-z_][A-Za-z0-9_$]*)\.\*$/.test(body);
  });
  const sourceColumns = [...new Set([
    ...referencedColumns(query, schema),
    ...(hasWildcard ? schema.columns.map((column) => column.name) : []),
  ])].sort((a, b) => a.localeCompare(b));
  const hasJoin = /\b(join)\b/i.test(fromClause);
  const hasCte = /^with\b/i.test(query);
  const hasSubquery = /[(]\s*select\b/i.test(query);
  const hasSetOperation = /\b(union|intersect|except)\b/i.test(query);
  const hasGroup = findTopLevelKeyword(query, "group by") >= 0;
  const hasWhere = findTopLevelKeyword(query, "where") >= 0;
  const hasHaving = findTopLevelKeyword(query, "having") >= 0;
  const hasDistinct = /^select\s+distinct\b/i.test(query);
  const hasWindow = /\bover\s*[(]/i.test(query);
  const hasCast = /\b(try_cast|cast)\s*[(]/i.test(query);
  const hasLimit = findTopLevelKeyword(query, "limit") >= 0;
  const hasOrder = findTopLevelKeyword(query, "order by") >= 0;

  if (hasWhere) operations.push({ kind: "filter", label: "تصفية صفوف", detail: clauseValue(query, "where", ["group by", "having", "order by", "limit"]) ?? undefined });
  if (hasJoin) operations.push({ kind: "join", label: "دمج مصادر", detail: fromClause.slice(0, 300) });
  if (hasGroup) operations.push({ kind: "group", label: "تجميع حسب أبعاد", detail: clauseValue(query, "group by", ["having", "order by", "limit"]) ?? undefined });
  if (outputColumns.some((column) => column.operations.includes("aggregate"))) operations.push({ kind: "aggregate", label: "اشتقاق مقاييس تجميعية" });
  if (hasHaving) operations.push({ kind: "having", label: "تصفية بعد التجميع", detail: clauseValue(query, "having", ["order by", "limit"]) ?? undefined });
  if (hasWindow) operations.push({ kind: "window", label: "دوال نافذة" });
  if (hasDistinct) operations.push({ kind: "distinct", label: "إزالة التكرار المنطقي عبر DISTINCT" });
  if (hasCast) operations.push({ kind: "cast", label: "تحويل نوع بيانات" });
  if (hasOrder) operations.push({ kind: "sort", label: "ترتيب النتائج" });
  if (hasLimit) operations.push({ kind: "limit", label: "تحديد عدد النتائج" });
  if (outputColumns.length) operations.push({ kind: "projection", label: "اختيار/اشتقاق أعمدة النتيجة" });

  if (hasCte || hasSubquery || hasJoin || hasWindow || hasSetOperation) {
    warnings.push("الاستعلام يحتوي CTE أو استعلاماً فرعياً أو JOIN أو نافذة أو عملية مجموعات؛ تتبّع الاعتماديات هنا محافظ وقد لا يربط كل عمود وسيط بمصدره النهائي.");
  }
  const hasUnresolvedOutputs = outputColumns.some((column) =>
    column.sourceColumns.length === 0 &&
    !/count\s*[(]\s*[*]\s*[)]/i.test(column.expression) &&
    !isLiteralOnlyExpression(column.expression)
  );
  if (hasUnresolvedOutputs) {
    warnings.push("بعض أعمدة النتيجة لم يمكن ربطها بأعمدة المصدر المعروفة؛ لم يتم اختراع اعتماديات لها.");
  }
  if (hasJoin) warnings.push("تتبّع أعمدة الربط لا يثبت صحة العلاقة أو يمنع تضاعف الصفوف؛ راجع تشخيص Join Safety بصورة مستقلة.");

  const status: LineageStatus = hasCte || hasSubquery || hasJoin || hasWindow || hasSetOperation || hasUnresolvedOutputs ? "partial" : "complete";
  const confidence: LineageConfidence = status === "complete"
    ? (outputColumns.every((column) => column.confidence !== "low") ? "high" : "medium")
    : "medium";

  return { version: 1, status, confidence, sourceTable: schema.table, sourceColumns, outputColumns, operations, warnings, ...(executionPlan ? { executionPlan } : {}) };
}
