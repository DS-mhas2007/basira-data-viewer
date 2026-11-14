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

export type TimeBucket = "auto" | "day" | "week" | "month" | "year";

/** خيارات التجميع الزمني في الواجهة (none = القيم الأصلية بلا تجميع). */
export const TIME_BUCKETS: { id: TimeBucket | "none"; label: string }[] = [
  { id: "none", label: "بلا تجميع" },
  { id: "auto", label: "تلقائي" },
  { id: "day", label: "يومي" },
  { id: "week", label: "أسبوعي" },
  { id: "month", label: "شهري" },
  { id: "year", label: "سنوي" },
];

/** هل العمود زمني فعلياً (DATE/TIMESTAMP)؟ التجميع الزمني يعمل لهذه الأنواع فقط. */
export function isTemporalColumn(info: Pick<TableInfo, "schema">, name: string): boolean {
  return /^(DATE|TIMESTAMP)/i.test(info.schema.find((c) => c.name === name)?.type ?? "");
}

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
  /** "auto" = تجميع زمني يُختار من مدى التواريخ (للأعمدة الزمنية فقط). */
  bucket?: TimeBucket | undefined;
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
  const ID_RE = /(^|_)(id|uuid|code|رقم|معرف)($|_)/i;
  const other = info.schema.filter((c) => !isNumericType(c.type));
  // نتجنّب أعمدة المعرّفات كمحور أفقي لأنها عالية التنوّع وغير مفيدة بصرياً.
  const x = (other.find((c) => !ID_RE.test(c.name)) ?? other[0] ?? info.schema[0])?.name ?? "";
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
    xAngle: -45,
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
  const xType = info.schema.find((c) => c.name === cfg.x)?.type ?? "";
  const isTemporal = isTemporalColumn(info, cfg.x);

  // تجميع زمني. الصيغ ISO فيبقى ORDER BY 1 مرتباً زمنياً.
  if (cfg.bucket && isTemporal) {
    const d = `CAST(${x} AS DATE)`;
    const fixed: Record<Exclude<TimeBucket, "auto">, string> = {
      day: `strftime(${d}, '%Y-%m-%d')`,
      week: `strftime(date_trunc('week', ${d}), '%Y-%m-%d')`,
      month: `strftime(${d}, '%Y-%m')`,
      year: `strftime(${d}, '%Y')`,
    };
    if (cfg.bucket !== "auto") {
      return `SELECT ${fixed[cfg.bucket]} AS label, ${yExpr} AS value\nFROM ${t}\nWHERE ${x} IS NOT NULL\nGROUP BY 1\n${order}${limit}`;
    }
    // تلقائي: يومي حتى 90 يوماً، شهري حتى ~3 سنوات، وإلا سنوي.
    const label = `CASE WHEN _bs.span <= 90 THEN ${fixed.day} WHEN _bs.span <= 1100 THEN ${fixed.month} ELSE ${fixed.year} END`;
    return `WITH _bs AS (SELECT date_diff('day', min(${d}), max(${d})) AS span FROM ${t})\nSELECT ${label} AS label, ${yExpr} AS value\nFROM ${t}, _bs\nWHERE ${x} IS NOT NULL\nGROUP BY 1\n${order}${limit}`;
  }

  // أعمدة TIMESTAMP بوقت منتصف الليل تظهر «2025-01-01 00:00:00»؛ نحذف الوقت الفارغ من التسمية فقط.
  const label = /^TIMESTAMP/i.test(xType)
    ? `regexp_replace(CAST(${x} AS VARCHAR), ' 00:00:00$', '')`
    : `CAST(${x} AS VARCHAR)`;
  return `SELECT ${label} AS label, ${yExpr} AS value\nFROM ${t}\nWHERE ${x} IS NOT NULL\nGROUP BY 1\n${order}${limit}`;
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


/** أقصى عدد نقاط يُرسم في الرسم الواحد. */
export const CHART_ROW_CAP = 500;

/** يقصّ الصفوف إلى السقف ويُبلغ هل كان هناك المزيد (نطلب CAP+1 لنعرف دون تخمين). */
export function capRows<T>(rows: T[], cap = CHART_ROW_CAP): { rows: T[]; truncated: boolean } {
  return rows.length > cap ? { rows: rows.slice(0, cap), truncated: true } : { rows, truncated: false };
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface NormalizedChartRows {
  points: ChartPoint[];
  omitted: number;
}

/**
 * يحوّل نتائج SQL إلى نقاط قابلة للرسم دون تحويل القيم المفقودة أو غير الصالحة إلى صفر.
 * تُستبعد أيضاً أعداد BigInt التي تتجاوز دقة Number الآمنة.
 */
export function normalizeChartRows(rows: Record<string, unknown>[]): NormalizedChartRows {
  const points: ChartPoint[] = [];
  let omitted = 0;

  for (const row of rows) {
    const raw = row["value"];
    if (
      raw === null ||
      raw === undefined ||
      raw === "" ||
      typeof raw === "boolean" ||
      raw instanceof Date
    ) {
      omitted++;
      continue;
    }

    const value = Number(raw);
    if (!Number.isFinite(value) || (typeof raw === "bigint" && !Number.isSafeInteger(value))) {
      omitted++;
      continue;
    }

    points.push({ label: String(row["label"] ?? "—"), value });
  }

  return { points, omitted };
}
