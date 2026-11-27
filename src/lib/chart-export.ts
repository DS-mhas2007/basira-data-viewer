import { buildEChartsOption, decorateAxes } from "@/lib/echarts-adapter";
import { glassify, isGlassTheme } from "@/lib/echarts-glass";
import { renderEChartsSvg } from "@/lib/echarts-svg-export";
import { CHART_KINDS, PALETTES, type ChartConfig, type ChartPoint } from "@/lib/chart-studio";

/** تحييد حقن الصيغ في Excel: الخلايا النصية التي تبدأ برموز صيغة تُسبق بفاصلة عليا. */
function csvCell(v: string | number | undefined): string {
  if (v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV للنقاط المرسومة (مع BOM كي يقرأ Excel العربية صحيحاً). */
export function chartToCsv(points: ChartPoint[], config: Pick<ChartConfig, "x" | "y">): string {
  const hasSeries = points.some((p) => p.series !== undefined);
  const hasV2 = points.some((p) => p.value2 !== undefined);
  const header = [
    config.x,
    ...(hasSeries ? ["series"] : []),
    config.y,
    ...(hasV2 ? ["value2"] : []),
  ];
  const rows = points.map((p) =>
    [p.label, ...(hasSeries ? [p.series] : []), p.value, ...(hasV2 ? [p.value2] : [])]
      .map((c) => csvCell(c as string | number | undefined))
      .join(","),
  );
  return `﻿${header.map(csvCell).join(",")}\r\n${rows.join("\r\n")}\r\n`;
}

export const CONFIG_FILE_KIND = "mizyai-chart";
export const CONFIG_FILE_VERSION = 1;

/** ملف إعدادات قابل لإعادة الاستخدام: لا يحوي بيانات ولا استعلامات، فقط الإعدادات. */
export function serializeChartConfig(config: ChartConfig): string {
  return JSON.stringify({ kind: CONFIG_FILE_KIND, version: CONFIG_FILE_VERSION, config }, null, 2);
}

const STR = [
  "x",
  "y",
  "agg",
  "sort",
  "palette",
  "title",
  "subtitle",
  "align",
  "prefix",
  "suffix",
  "legend",
  "curve",
  "bucket",
  "dateFormat",
  "series",
  "y2",
  "gridStyle",
] as const;
const BOOL = ["gradient", "compact", "dataLabels", "grid", "stackPercent", "axisTitles"] as const;
const ENUMS: Record<string, string[]> = {
  agg: ["SUM", "AVG", "COUNT", "MAX", "MIN"],
  sort: ["value_desc", "value_asc", "label_asc"],
  align: ["right", "center", "left"],
  legend: ["top", "bottom", "hidden"],
  curve: ["monotone", "linear"],
  bucket: ["auto", "day", "week", "month", "year"],
  gridStyle: ["dashed", "solid"],
};

export type ParsedConfig =
  { ok: true; config: Partial<ChartConfig> } | { ok: false; error: string };

/** يتحقق من الملف المستورد ويُرجع الحقول الصالحة فقط (لا يثق بأي قيمة غير معروفة). */
export function parseChartConfigFile(text: string): ParsedConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "الملف ليس JSON صالحاً." };
  }
  const obj = raw as { kind?: unknown; version?: unknown; config?: Record<string, unknown> };
  if (!obj || obj.kind !== CONFIG_FILE_KIND || typeof obj.config !== "object" || !obj.config)
    return { ok: false, error: "هذا ليس ملف إعدادات رسم من MIZYAi." };
  if (typeof obj.version !== "number" || obj.version > CONFIG_FILE_VERSION)
    return { ok: false, error: "إصدار الملف أحدث من المدعوم." };
  const c = obj.config;
  const out: Record<string, unknown> = {};
  if (typeof c["kind"] === "string" && CHART_KINDS.some((k) => k.id === c["kind"]))
    out["kind"] = c["kind"];
  for (const k of STR) {
    const v = c[k];
    if (typeof v !== "string" || v.length > 300) continue;
    if (ENUMS[k] && !ENUMS[k]!.includes(v)) continue;
    out[k] = v;
  }
  for (const k of BOOL) if (typeof c[k] === "boolean") out[k] = c[k];
  if (
    typeof c["limit"] === "number" &&
    Number.isInteger(c["limit"]) &&
    c["limit"] >= 0 &&
    c["limit"] <= 500
  )
    out["limit"] = c["limit"];
  if (typeof c["radius"] === "number" && c["radius"] >= 0 && c["radius"] <= 100)
    out["radius"] = c["radius"];
  if ([0, -45, -90].includes(c["xAngle"] as number)) out["xAngle"] = c["xAngle"];
  if (
    Array.isArray(c["colors"]) &&
    c["colors"].length > 0 &&
    c["colors"].length <= 16 &&
    c["colors"].every((h) => typeof h === "string" && /^#[0-9a-fA-F]{6}$/.test(h))
  )
    out["colors"] = c["colors"];
  if (
    typeof out["palette"] === "string" &&
    out["palette"] !== "custom" &&
    !PALETTES.some((p) => p.id === out["palette"])
  )
    delete out["palette"];
  if (Object.keys(out).length === 0) return { ok: false, error: "لا توجد إعدادات صالحة في الملف." };
  return { ok: true, config: out as Partial<ChartConfig> };
}

/** أعمدة الإعداد المفقودة في الجدول الحالي (ليُنبَّه المستخدم بدل فشل صامت). */
export function missingColumns(config: Partial<ChartConfig>, columns: string[]): string[] {
  return ([config.x, config.y, config.series, config.y2] as (string | undefined)[]).filter(
    (c): c is string => !!c && !columns.includes(c),
  );
}

export const PNG_SCALES = [1, 2, 3, 4] as const;

/** SVG مطابق للمعاينة (نفس المحوّل والتزجيج والمحاور) بخلفية اختيارية أو شفافة. كله محلي. */
export async function chartToSvg(
  config: ChartConfig,
  points: ChartPoint[],
  opts: { width?: number; height?: number; background: string | null },
): Promise<string> {
  const built = buildEChartsOption(config, points);
  const skinned = isGlassTheme() ? glassify(built, {}) : built;
  const option = decorateAxes(skinned as Record<string, unknown>, config) as Record<
    string,
    unknown
  >;
  option["backgroundColor"] = opts.background ?? "transparent";
  return renderEChartsSvg(option as never, {
    width: opts.width ?? 960,
    height: opts.height ?? 540,
  });
}
