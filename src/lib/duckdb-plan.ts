/**
 * DuckDB EXPLAIN (FORMAT JSON) normalization.
 *
 * This module deliberately reports operator-level evidence only. Physical-plan
 * strings are not treated as proven column lineage: optimizer rewrites and
 * expression rendering vary by DuckDB version.
 */
export interface DuckDbPlanNode {
  name: string;
  extraInfo: Record<string, unknown>;
  children: DuckDbPlanNode[];
}

export interface DuckDbPlanSummary {
  source: "duckdb-explain-json";
  operators: string[];
  scannedTables: string[];
  projections: string[];
  filters: string[];
  groups: string[];
  aggregates: string[];
  joins: string[];
  warnings: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => {
    if (typeof item === "string" || typeof item === "number") return [String(item)];
    return [];
  });
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function readNode(value: unknown, out: DuckDbPlanNode[], depth = 0): void {
  if (depth > 256) return;
  if (Array.isArray(value)) {
    for (const item of value) readNode(item, out, depth + 1);
    return;
  }
  const record = asRecord(value);
  if (!record) return;

  const name = typeof record.name === "string" ? record.name : "";
  const extraInfo = asRecord(record.extra_info) ?? asRecord(record.extraInfo) ?? {};
  const rawChildren = Array.isArray(record.children) ? record.children : [];
  const children: DuckDbPlanNode[] = [];
  for (const child of rawChildren) readNodeInto(child, children, depth + 1);
  if (name) out.push({ name, extraInfo, children });
  else {
    // Some DuckDB releases wrap the physical plan in an object without a name.
    for (const child of rawChildren) readNode(child, out, depth + 1);
  }
}

function readNodeInto(value: unknown, out: DuckDbPlanNode[], depth: number): void {
  if (depth > 256) return;
  if (Array.isArray(value)) {
    for (const item of value) readNodeInto(item, out, depth + 1);
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  const name = typeof record.name === "string" ? record.name : "";
  const extraInfo = asRecord(record.extra_info) ?? asRecord(record.extraInfo) ?? {};
  const children: DuckDbPlanNode[] = [];
  for (const child of Array.isArray(record.children) ? record.children : []) {
    readNodeInto(child, children, depth + 1);
  }
  if (name) out.push({ name, extraInfo, children });
}

function collect(nodes: DuckDbPlanNode[], keyMatchers: RegExp[]): string[] {
  const found = new Set<string>();
  const visit = (node: DuckDbPlanNode) => {
    for (const [key, value] of Object.entries(node.extraInfo)) {
      if (keyMatchers.some((matcher) => matcher.test(key))) {
        for (const entry of strings(value)) found.add(entry);
      }
    }
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return [...found];
}

/**
 * Accepts either DuckDB's Arrow rows (plain objects with explain_key/value),
 * the JSON payload itself, or a JSON string. Returns null for unknown formats.
 */
export function summarizeDuckDbExplain(raw: unknown): DuckDbPlanSummary | null {
  let payload = parseJson(raw);
  if (Array.isArray(payload) && payload.length > 0) {
    const rows = payload.map(asRecord);
    const physical = rows.find((row) =>
      typeof row?.explain_key === "string" &&
      row.explain_key.toLowerCase().includes("physical"),
    );
    const value = physical?.explain_value ?? physical?.physical_plan;
    if (value !== undefined) payload = parseJson(value);
    else if (rows.some((row) => row && "explain_value" in row)) return null;
  }

  const nodes: DuckDbPlanNode[] = [];
  readNode(payload, nodes);
  if (nodes.length === 0) return null;

  const all: DuckDbPlanNode[] = [];
  const flatten = (node: DuckDbPlanNode) => {
    all.push(node);
    node.children.forEach(flatten);
  };
  nodes.forEach(flatten);

  const operators = [...new Set(all.map((node) => node.name))];
  const scannedTables = collect(nodes, [/^table$/i, /table name/i]);
  const projections = collect(nodes, [/projection/i]);
  const filters = collect(nodes, [/filter/i]);
  const groups = collect(nodes, [/group/i, /grouping/i]);
  const aggregates = collect(nodes, [/aggregate/i]);
  const joins = collect(nodes, [/condition/i, /join type/i]);

  return {
    source: "duckdb-explain-json",
    operators,
    scannedTables,
    projections,
    filters,
    groups,
    aggregates,
    joins,
    warnings: [
      "خطة DuckDB دليل على بنية التنفيذ الفيزيائية، وليست وحدها إثباتاً لعلاقات أعمدة المصدر أو تعريف المقياس.",
      "قد تتغير أسماء المشغّلات وتفاصيل الخطة بين إصدارات DuckDB والتحسينات التي يجريها المحسّن.",
    ],
  };
}
