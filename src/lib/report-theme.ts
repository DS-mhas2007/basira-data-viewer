/**
 * ثيمات التقرير (PDF / PPTX / HTML): مصدر واحد للألوان يطابق ثيمَي المنصة.
 *  - light: الورقي، مطابق للثيم الفاتح للمنصة (#FAF8F1 / #287F74)، يطبع نظيفاً.
 *  - dark: هوية MIZYAi الداكنة (#010A19 / #60F5D2 / #D6B2FC)، للشاشة والعروض.
 */
export type ReportThemeId = "light" | "dark";

export interface ReportTheme {
  id: ReportThemeId;
  label: string;
  description: string;
  /** سطح ثانوي (كتل الكود، خلفية الغلاف). */
  surface: string;
  page: string;
  card: string;
  text: string;
  muted: string;
  line: string;
  /** لون التمييز الأساسي (عناوين، أشرطة، مؤشرات جيدة). */
  accent: string;
  accent2: string;
  /** لونا الغلاف (تباين أعلى على خلفية الغلاف). */
  coverAccent: string;
  coverAccent2: string;
  good: string;
  warn: string;
  bad: string;
  chart: [string, string, string, string];
  sql: { kw: string; str: string; num: string; plain: string };
  /** شعار الـlockup المناسب لخلفية الصفحة. */
  lockup: "light" | "dark";
  /** نسخة بلا ألوان نيون/خلفية داكنة للطباعة؟ */
  dark: boolean;
}

export const REPORT_THEMES: Record<ReportThemeId, ReportTheme> = {
  light: {
    id: "light",
    label: "ورقي فاتح",
    description: "مطابق للثيم الفاتح للمنصة؛ مثالي للطباعة والتسليم الرسمي.",
    surface: "#F3F0E8",
    page: "#FAF8F1",
    card: "#FFFFFF",
    text: "#263344",
    muted: "#6B747E",
    line: "rgba(38,51,68,0.12)",
    accent: "#287F74",
    accent2: "#735C9A",
    coverAccent: "#287F74",
    coverAccent2: "#735C9A",
    good: "#287F74",
    warn: "#A36A22",
    bad: "#B94E4E",
    chart: ["#287F74", "#735C9A", "#486F9A", "#A36A22"],
    sql: { kw: "#735C9A", str: "#A36A22", num: "#287F74", plain: "#263344" },
    lockup: "light",
    dark: false,
  },
  dark: {
    id: "dark",
    label: "MIZYAi داكن",
    description: "هوية MIZYAi الكاملة؛ للشاشة والعروض والمشاركة الرقمية.",
    surface: "#07152D",
    page: "#010A19",
    card: "#07152D",
    text: "#EEF2F7",
    muted: "#93A4BA",
    line: "rgba(238,242,247,0.12)",
    accent: "#60F5D2",
    accent2: "#D6B2FC",
    coverAccent: "#60F5D2",
    coverAccent2: "#D6B2FC",
    good: "#60F5D2",
    warn: "#F0C77A",
    bad: "#F29A9A",
    chart: ["#60F5D2", "#D6B2FC", "#7FB2FF", "#F0C77A"],
    sql: { kw: "#D6B2FC", str: "#F0C77A", num: "#60F5D2", plain: "#EEF2F7" },
    lockup: "dark",
    dark: true,
  },
};

export const DEFAULT_REPORT_THEME: ReportThemeId = "light";
const STORAGE_KEY = "mizya.report.theme";

export function readStoredReportTheme(): ReportThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* التخزين غير متاح */
  }
  return DEFAULT_REPORT_THEME;
}

export function storeReportTheme(id: ReportThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* تجاهل */
  }
}

/** يزيل "#" ويعيد hex بدون رمز (لـ pptxgenjs). */
export const pptxColor = (hex: string): string => hex.replace("#", "").slice(0, 6).toUpperCase();

const logoCache = new Map<string, string>();

/** يحمّل شعار MIZYAi (lockup أفقي) كـdata URI ليُضمَّن في ملفات مستقلة (HTML/PPTX). null إن تعذّر. */
export async function loadBrandLogo(variant: "light" | "dark"): Promise<string | null> {
  const cached = logoCache.get(variant);
  if (cached) return cached;
  try {
    const res = await fetch(`/brand/mizya-lockup-horizontal-${variant}-640.png`);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const uri = `data:image/png;base64,${btoa(bin)}`;
    logoCache.set(variant, uri);
    return uri;
  } catch {
    return null;
  }
}

/** نسبة أبعاد الشعار (عرض/ارتفاع). */
export const LOGO_ASPECT = 640 / 243;
