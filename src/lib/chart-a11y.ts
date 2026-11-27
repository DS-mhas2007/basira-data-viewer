import { formatValue, type ChartConfig, type ChartPoint } from "@/lib/chart-studio";

const KIND_NAME: Partial<Record<ChartConfig["kind"], string>> = {
  bar: "أعمدة",
  horizontalBar: "أعمدة أفقية",
  stacked: "أعمدة مكدسة",
  line: "خطي",
  area: "مساحي",
  pie: "دائري",
  combo: "مركّب",
  funnel: "قمع",
  waterfall: "شلال",
  treemap: "خريطة شجرية",
  radar: "رادار",
  histogram: "مدرج تكراري",
  boxplot: "صندوق وشعيرات",
  scatter: "تشتت",
  heatmap: "خريطة حرارية",
};

/** وصف نصي موجز للرسم لقارئ الشاشة: النوع، عدد النقاط، الأعلى والأدنى والمجموع. */
export function describeChart(
  config: Pick<ChartConfig, "kind" | "x" | "y" | "prefix" | "suffix" | "compact" | "title">,
  points: ChartPoint[],
): string {
  const kind = KIND_NAME[config.kind] ?? "بياني";
  const head = `رسم ${kind}${config.title ? ` بعنوان «${config.title}»` : ""}: ${config.y} حسب ${config.x}.`;
  const valid = points.filter((p) => Number.isFinite(p.value));
  if (valid.length === 0) return `${head} لا توجد نقاط.`;
  const hi = valid.reduce((a, b) => (b.value > a.value ? b : a));
  const lo = valid.reduce((a, b) => (b.value < a.value ? b : a));
  const f = (v: number) => formatValue(v, config);
  const parts = [`${valid.length} نقطة`, `الأعلى «${hi.label}» ${f(hi.value)}`];
  if (valid.length > 1) parts.push(`الأدنى «${lo.label}» ${f(lo.value)}`);
  return `${head} ${parts.join("، ")}.`;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export function prefersMoreContrast(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-contrast: more)").matches;
}

/** يضيف خيارات الإتاحة: إيقاف الحركة عند الطلب، وأنماط تعبئة (decal) عند التباين العالي. */
export function withA11y<T extends Record<string, unknown>>(
  option: T,
  env: { reducedMotion: boolean; moreContrast: boolean },
): T {
  const out: Record<string, unknown> = { ...option };
  if (env.reducedMotion) out["animation"] = false;
  if (env.moreContrast) out["aria"] = { enabled: true, decal: { show: true } };
  return out as T;
}

/** صفوف الجدول البديل (مقصوصة بسقف لسلامة الأداء). */
export function altTableRows(points: ChartPoint[], cap = 50) {
  return { rows: points.slice(0, cap), hidden: Math.max(0, points.length - cap) };
}
