export const APP_NAME = "بصيرة";
export const APP_NAME_EN = "BASIRA";
export const APP_TAGLINE = "منصة الذكاء الاصطناعي لتحليل البيانات واتخاذ القرارات";

export const ROUTES = {
  HOME: "/",
  DATA: "/data",
  QUALITY: "/quality",
  ANALYTICS: "/analytics",
  ASK_BASIRA: "/ask",
  INSIGHTS: "/insights",
  WHAT_IF: "/what-if",
  REPORTS: "/reports",
  SETTINGS: "/settings",
} as const;

export const BREAKPOINTS = {
  mobile: 320,
  tablet: 768,
  laptop: 1024,
  desktop: 1440,
} as const;

export const DATA_TYPES = {
  NUMERIC: "numeric",
  TEXT: "text",
  DATE: "date",
  BOOLEAN: "boolean",
  CATEGORY: "category",
} as const;

export const PRIORITY_LEVELS = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const;

export const CONFIDENCE_LEVELS = {
  HIGH: { label: "عالية", min: 80, color: "success" },
  MEDIUM: { label: "متوسطة", min: 60, color: "warning" },
  LOW: { label: "منخفضة", min: 0, color: "error" },
} as const;

export const SUGGESTED_QUESTIONS = [
  "ما أكثر المنتجات مبيعًا؟",
  "لماذا انخفضت المبيعات؟",
  "اكتشف القيم الشاذة",
  "توقع الشهر القادم",
] as const;

export const ANALYSIS_STEPS = [
  { id: "understand", label: "فهم السؤال" },
  { id: "plan", label: "بناء خطة التحليل" },
  { id: "tools", label: "اختيار الأدوات" },
  { id: "execute", label: "تنفيذ التحليل" },
  { id: "verify", label: "التحقق من النتائج" },
  { id: "insight", label: "صياغة الرؤية" },
] as const;

export const QUALITY_DIMENSIONS = [
  { id: "missing", label: "القيم المفقودة" },
  { id: "duplicates", label: "الصفوف المكررة" },
  { id: "invalid", label: "القيم غير الصالحة" },
  { id: "types", label: "اتساق الأنواع" },
  { id: "outliers", label: "القيم الشاذة" },
] as const;
