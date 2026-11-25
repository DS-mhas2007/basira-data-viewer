/** قوالب تخطيط التقرير (مستقلة عن الثيم الفاتح/الداكن). */
export type ReportTemplateId = "classic" | "modern" | "brief" | "narrative";

export interface ReportTemplateMeta {
  id: ReportTemplateId;
  label: string;
  description: string;
}

export const REPORT_TEMPLATES: Record<ReportTemplateId, ReportTemplateMeta> = {
  classic: {
    id: "classic",
    label: "كلاسيكي",
    description: "التقرير الكامل بكل الأقسام المختارة — الأنسب للتدقيق والأرشفة.",
  },
  modern: {
    id: "modern",
    label: "عصري",
    description: "نفس المحتوى الكامل بمظهر أنظف: أشرطة علوية وبطاقات حادة وعناوين مسطّرة.",
  },
  brief: {
    id: "brief",
    label: "موجز",
    description: "صفحة واحدة: المؤشرات وأهم الاستنتاجات والتوصيات مع رسم رئيسي.",
  },
  narrative: {
    id: "narrative",
    label: "سردي",
    description: "قصة بيانات: غلاف، فصل لكل استنتاج بالرسم والتفسير، وخلاصة بالتوصيات.",
  },
};

export const DEFAULT_REPORT_TEMPLATE: ReportTemplateId = "classic";

const STORAGE_KEY = "mizya.report.template";

export function isReportTemplateId(v: unknown): v is ReportTemplateId {
  return v === "classic" || v === "modern" || v === "brief" || v === "narrative";
}

export function readStoredReportTemplate(): ReportTemplateId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isReportTemplateId(v)) return v;
  } catch {
    /* التخزين غير متاح */
  }
  return DEFAULT_REPORT_TEMPLATE;
}

export function storeReportTemplate(id: ReportTemplateId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* تجاهل */
  }
}
