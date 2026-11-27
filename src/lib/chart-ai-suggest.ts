import { z } from "zod";
import { CHART_KINDS, type ChartConfig, type ChartPoint } from "@/lib/chart-studio";
import { isNumericType } from "@/lib/profile";

export const MAX_SUGGEST_POINTS = 30;
export const MAX_SUGGEST_COLUMNS = 60;

/** الحمولة الكاملة التي تغادر المتصفح — تُعرض للمستخدم حرفياً قبل الإرسال. */
export interface SuggestPayload {
  columns: { name: string; type: string }[];
  current: { kind: string; x: string; y: string; agg: string };
  points: { label: string; value: number }[];
  totalPoints: number;
}

export function buildSuggestPayload(
  info: { schema: { name: string; type: string }[] },
  config: Pick<ChartConfig, "kind" | "x" | "y" | "agg">,
  points: ChartPoint[],
): SuggestPayload {
  return {
    columns: info.schema
      .slice(0, MAX_SUGGEST_COLUMNS)
      .map((c) => ({ name: c.name.slice(0, 120), type: c.type.slice(0, 60) })),
    current: { kind: config.kind, x: config.x, y: config.y, agg: config.agg },
    points: points
      .filter((p) => Number.isFinite(p.value))
      .slice(0, MAX_SUGGEST_POINTS)
      .map((p) => ({ label: String(p.label).slice(0, 60), value: p.value })),
    totalPoints: points.length,
  };
}

export const SuggestionZ = z.object({
  title_ar: z.string().min(1).max(120),
  why_ar: z.string().min(1).max(400),
  kind: z.string().max(30),
  x: z.string().max(120).optional(),
  y: z.string().max(120).optional(),
  agg: z.enum(["SUM", "AVG", "COUNT", "MAX", "MIN"]).optional(),
});
export const SuggestionsResponseZ = z.object({ suggestions: z.array(SuggestionZ).max(8) });
export type ChartSuggestion = z.infer<typeof SuggestionZ>;

export interface ValidSuggestion {
  title: string;
  why: string;
  patch: Partial<Pick<ChartConfig, "kind" | "x" | "y" | "agg">>;
}

/**
 * لا نثق بمخرجات النموذج: نقبل فقط أنواعاً معروفة وأعمدة موجودة فعلاً في الجدول،
 * ونرفض المقياس غير الرقمي (إلا مع COUNT). ما يتجاوز التحقق يُسقط بصمت.
 */
export function validateSuggestions(
  raw: unknown,
  info: { schema: { name: string; type: string }[] },
  max = 4,
): ValidSuggestion[] {
  const parsed = SuggestionsResponseZ.safeParse(raw);
  if (!parsed.success) return [];
  const cols = new Map(info.schema.map((c) => [c.name, c.type]));
  const out: ValidSuggestion[] = [];
  for (const s of parsed.data.suggestions) {
    if (!CHART_KINDS.some((k) => k.id === s.kind)) continue;
    if (s.x !== undefined && !cols.has(s.x)) continue;
    if (s.y !== undefined && !cols.has(s.y)) continue;
    const agg = s.agg;
    if (s.y !== undefined && agg !== "COUNT" && !isNumericType(cols.get(s.y)!)) continue;
    const patch: ValidSuggestion["patch"] = { kind: s.kind as ChartConfig["kind"] };
    if (s.x !== undefined) patch.x = s.x;
    if (s.y !== undefined) patch.y = s.y;
    if (agg !== undefined) patch.agg = agg;
    out.push({ title: s.title_ar, why: s.why_ar, patch });
    if (out.length >= max) break;
  }
  return out;
}
