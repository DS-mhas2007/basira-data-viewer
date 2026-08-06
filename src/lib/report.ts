/**
 * الوحدة 8: أدوات التقرير التنفيذي (PDF).
 * اشتقاق المحتوى فقط — لا تعديل على منطق الوحدات 3/4/6/7.
 */
import type { AiPlan } from "@/lib/ai-query.functions";
import type { EvidenceData } from "@/components/EvidenceCard";
import type { Row } from "@/lib/parse-file";

/** استنتاج مثبّت كامل: بطاقة الدليل + خطة الوحدة 4 + صفوف النتيجة (لإعادة رسم المخطط في التقرير). */
export interface PinnedInsight {
  evidence: EvidenceData;
  plan: AiPlan;
  rows: Row[];
}

/** توصية عامة قابلة للتنفيذ لكل نوع intent من الوحدة 4. */
export const RECOMMENDATION_BY_INTENT: Record<AiPlan["intent"], string> = {
  ranking: "ركّز على العناصر الأعلى أداءً المذكورة أعلاه، وافحص أسباب تراجع العناصر الأدنى قبل تغيير الخطة.",
  compare: "قارن العناصر المذكورة على فترات متتالية للتأكد أن الفرق ثابت وليس نتيجة تذبذب قصير.",
  trend: "تابع هذا الاتجاه في الفترات القادمة، وحدّد العامل الذي تغيّر قبل تعميم النتيجة.",
  distribution: "راجع الفئات ذات الحصة الأكبر وتأكد أن التوزيع يعكس الواقع التشغيلي وليس نقصاً في التسجيل.",
  anomaly: "راجع القيم غير المعتادة يدوياً للتأكد من صحتها قبل بناء أي قرار عليها.",
  summary: "استخدم هذا الملخص كنقطة انطلاق، ثم تعمّق في الأعمدة الأكثر تأثيراً على النتيجة.",
};

const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/** تاريخ عربي واضح: 6 أغسطس 2026 */
export function arabicDate(d = new Date()): string {
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** اسم ملف التصدير: تقرير-بصيرة-[اسم_الملف]-[التاريخ].pdf */
export function reportFileName(sourceName: string, d = new Date()): string {
  const base = sourceName.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "_").trim() || "بيانات";
  return `تقرير-بصيرة-${base}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.pdf`;
}
