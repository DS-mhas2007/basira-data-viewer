/** تواريخ نشر/تحديث الأدلة (ISO) — تُستخدم في بيانات BlogPosting المنظّمة وlastmod في sitemap. */
const PUBLISHED = "2026-09-03";
const UPDATED_DEFAULT = "2026-11-17";

/** استثناءات: دليل لم يُحدَّث منذ تاريخ آخر. حدّث التاريخ هنا عند تعديل محتوى دليل. */
const UPDATED_BY_PATH: Record<string, string> = {};

export function guideDates(path: string): { published: string; updated: string } {
  const clean = path.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "");
  return { published: PUBLISHED, updated: UPDATED_BY_PATH[clean] ?? UPDATED_DEFAULT };
}
