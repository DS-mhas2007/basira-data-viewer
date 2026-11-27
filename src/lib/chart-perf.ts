/** مهلة تجميع تغييرات المحاور المتتالية قبل إرسال استعلام لـ DuckDB. */
export const QUERY_DEBOUNCE_MS = 150;
/** فوق هذا الزمن نعرض تلميحاً بأن الاستعلام بطيء. */
export const SLOW_QUERY_MS = 1500;

export function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} مللي ث` : `${(ms / 1000).toFixed(1)} ث`;
}

/** تلميح عملي عند بطء الاستعلام، أو null إن كان سريعاً. */
export function slowQueryHint(ms: number, rowCount: number, limit: number): string | null {
  if (ms < SLOW_QUERY_MS) return null;
  const tips = [
    rowCount > 1_000_000 ? "الجدول كبير جداً" : null,
    limit === 0 ? "حدّد عدداً أقصى للفئات" : null,
    "جرّب التجميع الزمني أو تصفية الصفوف",
  ].filter(Boolean);
  return `استغرق الاستعلام ${formatDuration(ms)}؛ ${tips.join("، ")}.`;
}
