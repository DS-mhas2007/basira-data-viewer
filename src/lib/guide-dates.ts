/** تواريخ نشر/تحديث الأدلة (ISO) — تُستخدم في بيانات BlogPosting المنظّمة وlastmod في sitemap. */
const PUBLISHED_DEFAULT = "2026-09-03";
const UPDATED_DEFAULT = "2026-11-17";

/** الأدلة المنشورة حديثاً لها تاريخ نشر مستقل عن الدفعة الأصلية. */
const PUBLISHED_BY_PATH: Record<string, string> = {
  "/guide/missing-values": "2026-11-17",
  "/guide/data-types": "2026-11-17",
  "/guide/date-format": "2026-11-17",
  "/guide/data-dictionary": "2026-11-17",
  "/guide/descriptive-statistics": "2026-11-17",
  "/guide/choose-chart": "2026-11-17",
};

/** استثناءات: دليل لم يُحدَّث منذ تاريخ آخر. حدّث التاريخ هنا عند تعديل محتوى دليل. */
const UPDATED_BY_PATH: Record<string, string> = {};

export function guideDates(path: string): { published: string; updated: string } {
  const clean = path.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "");
  return { published: PUBLISHED_BY_PATH[clean] ?? PUBLISHED_DEFAULT, updated: UPDATED_BY_PATH[clean] ?? UPDATED_DEFAULT };
}
