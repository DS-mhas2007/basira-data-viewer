/**
 * يحدّد كيف يُرسم جواب «اسأل بياناتك» من خطة النموذج ونتائج SQL.
 * النموذج يعيد غالباً chart.type = "table" حتى لو كانت النتيجة قابلة للرسم، وDuckDB يعيد COUNT كـ BigInt
 * والأعداد العشرية أحياناً نصوصاً؛ لذلك نستنتج الرسم من شكل النتيجة بدل الاعتماد على اختيار النموذج وحده.
 */
export type AskChartType = "bar" | "line" | "scatter" | "histogram" | "table" | "kpi";

export interface AskChartPlan {
  chart: { type: AskChartType; x: string | null; y: string[] };
}

export type AskRow = Record<string, unknown>;

export interface AskChartSpec {
  type: Exclude<AskChartType, "table" | "histogram">;
  x: string;
  metrics: string[];
  inferred: boolean;
}

export function isNumericValue(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "bigint") return true;
  if (typeof v === "string") return v.trim() !== "" && Number.isFinite(Number(v));
  return false;
}

export function toNumber(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

const DATE_LIKE = /^\d{4}-\d{2}(-\d{2})?([ T]|$)/;

export function resolveAskChart(plan: AskChartPlan, rows: AskRow[]): AskChartSpec | null {
  const keys = Object.keys(rows[0] ?? {});
  if (rows.length === 0 || keys.length === 0) return null;

  const x = plan.chart.x && keys.includes(plan.chart.x) ? plan.chart.x : keys[0]!;
  const asked = plan.chart.y.filter((k) => keys.includes(k) && k !== x);
  const numericKeys = keys.filter((k) => k !== x && rows.some((r) => isNumericValue(r[k])));
  const metrics = (asked.length > 0 ? asked : numericKeys).slice(0, asked.length > 0 ? 6 : 2);

  if (plan.chart.type === "kpi") {
    return { type: "kpi", x, metrics: metrics.length ? metrics : [keys[0]!], inferred: false };
  }
  // صف واحد: القيمة الرقمية الأولى بطاقة رقم حتى لو كانت هي العمود الأول.
  if (rows.length === 1 && plan.chart.type === "table") {
    const only = keys.find((k) => isNumericValue(rows[0]![k]));
    return only ? { type: "kpi", x, metrics: [only], inferred: true } : null;
  }
  if (metrics.length === 0) return null;

  if (plan.chart.type === "table") {
    // نتيجة صف واحد بقيمة واحدة = بطاقة رقم؛ وإلا نرسم عندما تكون النقاط معقولة.
    if (rows.length === 1) return { type: "kpi", x, metrics: metrics.slice(0, 1), inferred: true };
    if (rows.length < 2 || rows.length > 60) return null;
    const temporal = rows.every((r) => DATE_LIKE.test(String(r[x] ?? "")));
    return { type: temporal ? "line" : "bar", x, metrics, inferred: true };
  }

  const type = plan.chart.type === "histogram" ? "bar" : plan.chart.type;
  return { type, x, metrics, inferred: false };
}
