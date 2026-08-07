/**
 * التنبيهات الذكية: قواعد مراقبة تُقيَّم محلياً عبر SQL على DuckDB.
 * لا يغادر أي رقم المتصفح — التقييم والتخزين محليان بالكامل.
 */
import { duckdb, quoteIdent, type TableInfo } from "@/lib/duckdb-service";
import { isNumericType, isDateColumn } from "@/lib/profile";

export type AlertMetric =
  | "row_count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "null_pct"
  | "distinct"
  | "duplicate_pct";

export type AlertOperator = ">" | ">=" | "<" | "<=" | "==" | "!=";

export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertRule {
  id: string;
  name: string;
  metric: AlertMetric;
  column?: string | undefined;
  operator: AlertOperator;
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
}

export interface AlertResult {
  rule: AlertRule;
  value: number | null;
  triggered: boolean;
  error?: string | undefined;
}

export const METRIC_LABELS: Record<AlertMetric, string> = {
  row_count: "عدد الصفوف",
  sum: "مجموع العمود",
  avg: "متوسط العمود",
  min: "أصغر قيمة",
  max: "أكبر قيمة",
  null_pct: "نسبة الفراغات %",
  distinct: "عدد القيم الفريدة",
  duplicate_pct: "نسبة التكرار %",
};

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  info: "معلومة",
  warning: "تحذير",
  critical: "حرِج",
};

export const OPERATOR_LABELS: Record<AlertOperator, string> = {
  ">": "أكبر من",
  ">=": "أكبر أو يساوي",
  "<": "أصغر من",
  "<=": "أصغر أو يساوي",
  "==": "يساوي",
  "!=": "لا يساوي",
};

export function needsColumn(metric: AlertMetric) {
  return metric !== "row_count";
}

const STORAGE_KEY = "basira.alerts.rules";

export function loadRules(): AlertRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AlertRule[]) : [];
  } catch {
    return [];
  }
}

export function saveRules(rules: AlertRule[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch {
    /* تجاهل امتلاء التخزين */
  }
}

export function newRuleId() {
  return `alert_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** يبني تعبير SQL للمقياس المطلوب. */
function metricSql(rule: AlertRule, table: string) {
  const t = quoteIdent(table);
  if (rule.metric === "row_count") return `SELECT count(*)::DOUBLE AS v FROM ${t}`;
  if (!rule.column) return null;
  const c = quoteIdent(rule.column);
  switch (rule.metric) {
    case "sum":
      return `SELECT coalesce(sum(TRY_CAST(${c} AS DOUBLE)), 0)::DOUBLE AS v FROM ${t}`;
    case "avg":
      return `SELECT coalesce(avg(TRY_CAST(${c} AS DOUBLE)), 0)::DOUBLE AS v FROM ${t}`;
    case "min":
      return `SELECT coalesce(min(TRY_CAST(${c} AS DOUBLE)), 0)::DOUBLE AS v FROM ${t}`;
    case "max":
      return `SELECT coalesce(max(TRY_CAST(${c} AS DOUBLE)), 0)::DOUBLE AS v FROM ${t}`;
    case "null_pct":
      return `SELECT (100.0 * count(*) FILTER (WHERE ${c} IS NULL OR trim(CAST(${c} AS VARCHAR)) = '')
              / nullif(count(*), 0))::DOUBLE AS v FROM ${t}`;
    case "distinct":
      return `SELECT count(DISTINCT ${c})::DOUBLE AS v FROM ${t}`;
    case "duplicate_pct":
      return `SELECT (100.0 * (count(*) - count(DISTINCT ${c})) / nullif(count(*), 0))::DOUBLE AS v FROM ${t}`;
    default:
      return null;
  }
}

function compare(value: number, op: AlertOperator, threshold: number) {
  switch (op) {
    case ">":
      return value > threshold;
    case ">=":
      return value >= threshold;
    case "<":
      return value < threshold;
    case "<=":
      return value <= threshold;
    case "==":
      return Math.abs(value - threshold) < 1e-9;
    case "!=":
      return Math.abs(value - threshold) >= 1e-9;
    default:
      return false;
  }
}

export async function evaluateRule(rule: AlertRule, tableInfo: TableInfo): Promise<AlertResult> {
  const sql = metricSql(rule, tableInfo.table);
  if (!sql) return { rule, value: null, triggered: false, error: "قاعدة غير مكتملة" };
  try {
    const [row] = await duckdb.runSelect(sql, { limit: 1 });
    const raw = row ? Number(Object.values(row)[0]) : NaN;
    if (!Number.isFinite(raw)) return { rule, value: null, triggered: false, error: "تعذّر الحساب" };
    const value = Math.round(raw * 100) / 100;
    return { rule, value, triggered: compare(value, rule.operator, rule.threshold) };
  } catch {
    return { rule, value: null, triggered: false, error: "تعذّر تنفيذ الاستعلام" };
  }
}

export async function evaluateRules(rules: AlertRule[], tableInfo: TableInfo): Promise<AlertResult[]> {
  const out: AlertResult[] = [];
  for (const rule of rules) {
    if (!rule.enabled) {
      out.push({ rule, value: null, triggered: false });
      continue;
    }
    out.push(await evaluateRule(rule, tableInfo));
  }
  return out;
}

/** اقتراحات قواعد ذكية مبنية على مخطط الملف الحالي. */
export function suggestRules(tableInfo: TableInfo): AlertRule[] {
  const rules: AlertRule[] = [];
  const numeric = tableInfo.schema.filter((c) => isNumericType(c.type));
  const idLike = tableInfo.schema.find((c) => /(id|رقم|code|كود)/i.test(c.name));
  const dateCol = tableInfo.schema.find((c) => isDateColumn(c.type, c.name));

  rules.push({
    id: newRuleId(),
    name: "انخفاض حجم البيانات",
    metric: "row_count",
    operator: "<",
    threshold: Math.max(1, Math.floor(tableInfo.rowCount * 0.8)),
    severity: "warning",
    enabled: true,
  });

  for (const col of numeric.slice(0, 2)) {
    rules.push({
      id: newRuleId(),
      name: `قيم سالبة في «${col.name}»`,
      metric: "min",
      column: col.name,
      operator: "<",
      threshold: 0,
      severity: "critical",
      enabled: true,
    });
  }

  const gapCol = tableInfo.schema[0];
  if (gapCol) {
    rules.push({
      id: newRuleId(),
      name: `فراغات كثيرة في «${gapCol.name}»`,
      metric: "null_pct",
      column: gapCol.name,
      operator: ">",
      threshold: 5,
      severity: "warning",
      enabled: true,
    });
  }

  if (idLike) {
    rules.push({
      id: newRuleId(),
      name: `تكرار في «${idLike.name}»`,
      metric: "duplicate_pct",
      column: idLike.name,
      operator: ">",
      threshold: 0,
      severity: "critical",
      enabled: true,
    });
  }

  if (dateCol) {
    rules.push({
      id: newRuleId(),
      name: `تغطية زمنية ضعيفة في «${dateCol.name}»`,
      metric: "distinct",
      column: dateCol.name,
      operator: "<",
      threshold: 3,
      severity: "info",
      enabled: false,
    });
  }

  return rules;
}

export function describeRule(rule: AlertRule) {
  const metric = METRIC_LABELS[rule.metric];
  const col = rule.column ? ` (${rule.column})` : "";
  return `${metric}${col} ${OPERATOR_LABELS[rule.operator]} ${rule.threshold.toLocaleString("en-US")}`;
}
