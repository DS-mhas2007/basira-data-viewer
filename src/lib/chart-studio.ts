/**
 * استوديو الرسوم: أنواع الإعدادات + توليد SQL محلي + أدوات التنسيق.
 * كل شيء يُنفَّذ داخل المتصفح عبر DuckDB-WASM — لا يغادر أي صف جهاز المستخدم.
 */
import { quoteIdent, type TableInfo } from "@/lib/duckdb-service";
import { isNumericType } from "@/lib/profile";

export type ChartKind = "bar" | "stacked" | "line" | "area" | "pie" | "combo";
export type AggFn = "SUM" | "AVG" | "COUNT" | "MAX" | "MIN";
export type SortMode = "value_desc" | "value_asc" | "label_asc";
export type LegendPos = "top" | "bottom" | "hidden";
export type Align = "right" | "center" | "left";

export interface ChartConfig {
  kind: ChartKind;
  x: string;
  y: string;
  agg: AggFn;
  sort: SortMode;
  limit: number; // 0 = الكل
  palette: string;
  colors: string[];
  gradient: boolean;
  radius: number;
  curve: "monotone" | "linear";
  title: string;
  subtitle: string;
  align: Align;
  prefix: string;
  suffix: string;
  compact: boolean;
  dataLabels: boolean;
  grid: boolean;
  legend: LegendPos;
  xAngle: 0 | -45 | -90;
}

export interface Palette {
  id: string;
  name: string;
  colors: string[];
}

export const PALETTES: Palette[] = [
  { id: "basira", name: "بصيرة نيون", colors: ["#60F5D2", "#D6B2FC", "#7DD3FC", "#FDE68A", "#F9A8D4"] },
  { id: "corporate", name: "أزرق الشركات", colors: ["#3B82F6", "#1D4ED8", "#60A5FA", "#93C5FD", "#1E3A8A"] },
  { id: "emerald", name: "زمردي فاخر", colors: ["#34D399", "#10B981", "#6EE7B7", "#A7F3D0", "#047857"] },
  { id: "sunset", name: "شفق غروب", colors: ["#A78BFA", "#FB7185", "#FDBA74", "#F472B6", "#C084FC"] },
];

export const CHART_KINDS: { id: ChartKind; label: string }[] = [
  { id: "bar", label: "أعمدة (Bar)" },
  { id: "stacked", label: "أعمدة متراكمة (Stacked)" },
  { id: "line", label: "خط (Line)" },
  { id: "area", label: "مساحة منحنية (Area)" },
  { id: "pie", label: "دائري / دونات (Pie)" },
  { id: "combo", label: "مركّب (Combo)" },
];

export const AGGS: { id: AggFn; label: string }[] = [
  { id: "SUM", label: "مجموع (SUM)" },
  { id: "AVG", label: "متوسط (AVG)" },
  { id: "COUNT", label: "عدد (COUNT)" },
  { id: "MAX", label: "أعلى (MAX)" },
  { id: "MIN", label: "أدنى (MIN)" },
];

export const SORTS: { id: SortMode; label: string }[] = [
  { id: "value_desc", label: "أعلى القيم أولاً" },
  { id: "value_asc", label: "أدنى القيم أولاً" },
  { id: "label_asc", label: "ترتيب أبجدي" },
];

/** إعدادات افتراضية ذكية مشتقة من مخطط الجدول. */
export function defaultConfig(info: TableInfo, seedTitle?: string): ChartConfig {
  const numeric = info.schema.filter((c) => isNumericType(c.type));
  const other = info.schema.filter((c) => !isNumericType(c.type));
  const x = other[0]?.name ?? info.schema[0]?.name ?? "";
  const y = numeric[0]?.name ?? x;
  return {
    kind: "bar",
    x,
    y,
    agg: numeric.length > 0 ? "SUM" : "COUNT",
    sort: "value_desc",
    limit: 10,
    palette: "basira",
    colors: [...PALETTES[0]!.colors],
    gradient: true,
    radius: 8,
    curve: "monotone",
    title: seedTitle?.slice(0, 80) ?? "رسم مخصص",
    subtitle: "مبني محلياً عبر DuckDB-WASM",
    align: "right",
    prefix: "",
    suffix: "",
    compact: true,
    dataLabels: false,
    grid: true,
    legend: "bottom",
    xAngle: 0,
  };
}

/** يبني استعلام SQL آمن من الإعدادات (أسماء الأعمدة مقتبسة). */
export function buildSql(info: TableInfo, cfg: ChartConfig): string {
  const t = quoteIdent(info.table);
  const x = quoteIdent(cfg.x);
  const yExpr =
    cfg.agg === "COUNT" ? `count(*)::DOUBLE` : `${cfg.agg.toLowerCase()}(${quoteIdent(cfg.y)})::DOUBLE`;
  const order =
    cfg.sort === "label_asc" ? `ORDER BY 1 ASC` : `ORDER BY 2 ${cfg.sort === "value_asc" ? "ASC" : "DESC"}`;
  const limit = cfg.limit > 0 ? `\nLIMIT ${cfg.limit}` : "";
  return `SELECT CAST(${x} AS VARCHAR) AS label, ${yExpr} AS value\nFROM ${t}\nWHERE ${x} IS NOT NULL\nGROUP BY 1\n${order}${limit}`;
}

/** تنسيق الأرقام بحسب خيارات المستخدم (اختصار + بادئة/لاحقة). */
export function formatValue(v: number, cfg: Pick<ChartConfig, "prefix" | "suffix" | "compact">) {
  if (!Number.isFinite(v)) return "—";
  let body: string;
  const abs = Math.abs(v);
  if (cfg.compact && abs >= 1_000_000) body = `${(v / 1_000_000).toFixed(1)}M`;
  else if (cfg.compact && abs >= 1_000) body = `${(v / 1_000).toFixed(1)}K`;
  else body = Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(2);
  return `${cfg.prefix}${body}${cfg.suffix ? ` ${cfg.suffix}` : ""}`;
}
