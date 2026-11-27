import type { ChartConfig } from "@/lib/chart-studio";
import { parseChartConfigFile } from "@/lib/chart-export";

/** حقول التنسيق فقط: لا أعمدة ولا تجميع ولا فرز، فيصلح القالب لأي جدول ولوحة. */
export const STYLE_KEYS = [
  "palette",
  "colors",
  "gradient",
  "radius",
  "curve",
  "align",
  "prefix",
  "suffix",
  "compact",
  "dataLabels",
  "grid",
  "legend",
  "xAngle",
  "gridStyle",
  "axisTitles",
] as const satisfies readonly (keyof ChartConfig)[];

export interface ChartPreset {
  id: string;
  name: string;
  style: Partial<ChartConfig>;
}

const STORAGE_KEY = "mizya.chart.presets";
export const MAX_PRESETS = 20;
export const MAX_NAME = 40;

export function pickStyle(config: ChartConfig): Partial<ChartConfig> {
  const out: Record<string, unknown> = {};
  for (const k of STYLE_KEYS) if (config[k] !== undefined) out[k] = config[k];
  return out as Partial<ChartConfig>;
}

/** يطبّق قالباً على إعداد قائم دون المساس بالأعمدة والتجميع والعنوان. */
export function applyPreset(config: ChartConfig, preset: ChartPreset): ChartConfig {
  return { ...config, ...pickStyle({ ...config, ...preset.style } as ChartConfig) };
}

function sanitizeStyle(style: unknown): Partial<ChartConfig> | null {
  // نعيد استخدام مُدقّق ملف الإعدادات (قائمة بيضاء) ثم نُبقي حقول التنسيق فقط.
  const parsed = parseChartConfigFile(
    JSON.stringify({ kind: "mizyai-chart", version: 1, config: style }),
  );
  if (!parsed.ok) return null;
  const out: Record<string, unknown> = {};
  for (const k of STYLE_KEYS) if (parsed.config[k] !== undefined) out[k] = parsed.config[k];
  return Object.keys(out).length ? (out as Partial<ChartConfig>) : null;
}

export function parsePresets(raw: string | null): ChartPreset[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    const out: ChartPreset[] = [];
    for (const item of list) {
      const it = item as { id?: unknown; name?: unknown; style?: unknown };
      if (typeof it?.id !== "string" || typeof it.name !== "string") continue;
      const style = sanitizeStyle(it.style);
      if (style) out.push({ id: it.id, name: it.name.slice(0, MAX_NAME), style });
    }
    return out.slice(0, MAX_PRESETS);
  } catch {
    return [];
  }
}

export function loadPresets(): ChartPreset[] {
  try {
    return parsePresets(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function persist(list: ChartPreset[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export type SaveResult = { ok: true; presets: ChartPreset[] } | { ok: false; error: string };

/** يحفظ (أو يستبدل بنفس الاسم) قالباً من الإعداد الحالي. */
export function savePreset(
  name: string,
  config: ChartConfig,
  existing = loadPresets(),
): SaveResult {
  const clean = name.trim().slice(0, MAX_NAME);
  if (!clean) return { ok: false, error: "اكتب اسماً للقالب." };
  const style = pickStyle(config);
  const idx = existing.findIndex((p) => p.name === clean);
  if (idx < 0 && existing.length >= MAX_PRESETS)
    return { ok: false, error: `الحد الأقصى ${MAX_PRESETS} قالباً؛ احذف قالباً أولاً.` };
  const preset: ChartPreset = {
    id: idx >= 0 ? existing[idx]!.id : crypto.randomUUID(),
    name: clean,
    style,
  };
  const next = idx >= 0 ? existing.map((p, i) => (i === idx ? preset : p)) : [...existing, preset];
  return persist(next)
    ? { ok: true, presets: next }
    : { ok: false, error: "تعذّر الحفظ (التخزين المحلي غير متاح)." };
}

export function deletePreset(id: string, existing = loadPresets()): ChartPreset[] {
  const next = existing.filter((p) => p.id !== id);
  persist(next);
  return next;
}
