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

/** الجمهور المستهدف من التقرير — يحدّد الهيكل ومستوى التفاصيل. */
export type ReportAudience = "executive" | "analyst" | "operational" | "custom";

/** أقسام التقرير القابلة للتشغيل/الإخفاء. */
export type ReportSectionId =
  | "kpi"
  | "headline"
  | "actions"
  | "health"
  | "healthLog"
  | "insights"
  | "sql"
  | "stats"
  | "lineage"
  | "topBottom"
  | "anomalies"
  | "methodology";

export interface ReportSectionMeta {
  id: ReportSectionId;
  label: string;
  description: string;
  /** هل يعتمد القسم على وجود استنتاجات (يستدعي التوليد التلقائي عند غيابها)؟ */
  needsInsights: boolean;
}

export const REPORT_SECTIONS: ReportSectionMeta[] = [
  { id: "kpi", label: "كروت المؤشرات الرئيسية", description: "3–5 أرقام جوهرية بنط عريض", needsInsights: false },
  { id: "headline", label: "الاستنتاج الذهبي", description: "جملة واحدة واضحة لكل محور", needsInsights: true },
  { id: "actions", label: "مصفوفة التوصيات", description: "إجراء فوري / فرصة نمو / تنبيه مخاطر", needsInsights: true },
  { id: "health", label: "ملخص جودة البيانات", description: "الدرجة والمؤشرات العامة", needsInsights: false },
  { id: "healthLog", label: "سجل الجودة التفصيلي", description: "كل عمود: مفقود، أنواع، تفرّد", needsInsights: false },
  { id: "insights", label: "صفحات الاستنتاجات", description: "رسم بياني وتحليل لكل سؤال", needsInsights: true },
  { id: "sql", label: "شجرة استعلامات SQL", description: "الكود المنفَّذ وعدد الصفوف لكل رسم", needsInsights: true },
  { id: "stats", label: "الحدود الإحصائية", description: "متوسط، وسيط، مدى، وأثر النقص", needsInsights: false },
  { id: "lineage", label: "سجل التحويلات والتنظيف", description: "توثيق كل خطوة على الملف الخام", needsInsights: false },
  { id: "topBottom", label: "قوائم التوب والفلوب", description: "أفضل 10 وأسوأ 10", needsInsights: true },
  { id: "anomalies", label: "تنبيهات الانحراف", description: "الأرقام الغريبة والقيم الشاذة", needsInsights: true },
  { id: "methodology", label: "المنهجية والقيود", description: "كيف حُسبت الأرقام وحدود التفسير", needsInsights: false },
];

export type ReportSections = Record<ReportSectionId, boolean>;

function sectionsOf(ids: ReportSectionId[]): ReportSections {
  const base = {} as ReportSections;
  for (const s of REPORT_SECTIONS) base[s.id] = false;
  for (const id of ids) base[id] = true;
  return base;
}

export interface ReportAudienceMeta {
  id: ReportAudience;
  label: string;
  audience: string;
  description: string;
  sections: ReportSections;
}

export const REPORT_AUDIENCES: ReportAudienceMeta[] = [
  {
    id: "executive",
    label: "تقرير تنفيذي",
    audience: "المدراء وأصحاب القرار",
    description: "الزبدة فقط: مؤشرات، استنتاج ذهبي، ومصفوفة توصيات — بلا SQL.",
    sections: sectionsOf(["kpi", "headline", "actions"]),
  },
  {
    id: "analyst",
    label: "تقرير تحليلي تدقيقي",
    audience: "المحللون والمدققون",
    description: "شفافية كاملة: سجل جودة تفصيلي، كود SQL، حدود إحصائية، وسجل تحويلات.",
    sections: sectionsOf([
      "health",
      "healthLog",
      "insights",
      "sql",
      "stats",
      "lineage",
      "methodology",
    ]),
  },
  {
    id: "operational",
    label: "تقرير تشغيلي",
    audience: "مديرو الفرق والموظفون",
    description: "قوائم توب/فلوب، رسوم مقارنة، وتنبيهات انحراف يومية.",
    sections: sectionsOf(["kpi", "topBottom", "insights", "anomalies", "actions"]),
  },
  {
    id: "custom",
    label: "تقرير مخصص",
    audience: "أنت تحدّد",
    description: "اختر الأقسام التي تريد إظهارها أو إخفاءها يدوياً.",
    sections: sectionsOf(["kpi", "health", "insights", "actions", "methodology"]),
  },
];

export function audienceMeta(id: ReportAudience): ReportAudienceMeta {
  return REPORT_AUDIENCES.find((a) => a.id === id) ?? REPORT_AUDIENCES[0]!;
}

/** هل تحتاج مجموعة الأقسام المختارة استنتاجات؟ */
export function sectionsNeedInsights(sections: ReportSections): boolean {
  return REPORT_SECTIONS.some((s) => s.needsInsights && sections[s.id]);
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
