import {
  FileSpreadsheet,
  Languages,
  Gauge,
  MessageSquareText,
  Table2,
  FileDiff,
  CopyX,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface GuideItem {
  to: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  category: "files" | "quality" | "analysis" | "privacy";
}

export const GUIDES: GuideItem[] = [
  {
    to: "/guide/arabic-csv-excel",
    category: "files",
    title: "دليل تحليل ملف CSV عربي وExcel داخل المتصفح",
    desc: "خطوات فتح CSV وExcel بالعربية، وإصلاح الترميز، وفحص جودة البيانات مع توضيح حدود الخصوصية.",
    icon: FileSpreadsheet,
  },
  {
    to: "/guide/fix-arabic-encoding",
    category: "files",
    title: "حل مشكلة الحروف العربية المتكسّرة في ملفات CSV",
    desc: "لماذا تظهر ãäÇÁÉ بدل النص العربي، وكيف تصلحها في Excel و Google Sheets وبأداة MIZYAi.",
    icon: Languages,
  },
  {
    to: "/guide/data-quality-score",
    category: "quality",
    title: "درجة جودة البيانات: كيف تقيس نظافة ملفك من 100",
    desc: "المكررات، الفراغات، عدم اتساق الأنواع، والقيم الشاذة — وكيف تصلحها بلا تدمير.",
    icon: Gauge,
  },
  {
    to: "/guide/ask-data-in-arabic",
    category: "analysis",
    title: "اسأل بياناتك بالعربية: من السؤال إلى استعلام SQL موثّق",
    desc: "كيف يحوّل الذكاء الاصطناعي سؤالك إلى استعلام، ولماذا بطاقة الدليل تمنع الأرقام المخترعة.",
    icon: MessageSquareText,
  },
  {
    to: "/guide/pivot-alternative",
    category: "analysis",
    title: "بديل الجداول المحورية (Pivot Tables) لتقارير عربية أسرع",
    desc: "من التجميع اليدوي في Excel إلى تقارير PDF و PPTX عربية جاهزة بنقرة.",
    icon: Table2,
  },
  {
    to: "/guide/csv-vs-excel",
    category: "files",
    title: "الفرق بين CSV و Excel: أيهما تختار لبياناتك العربية؟",
    desc: "الترميز، الأنواع، تعدد الأوراق، والأداء — ومتى تختار كل صيغة قبل التحليل.",
    icon: FileDiff,
  },
  {
    to: "/guide/remove-duplicates",
    category: "quality",
    title: "إزالة الصفوف المكررة والفراغات دون إتلاف بياناتك",
    desc: "التكرار الكامل مقابل التكرار على مفتاح، وفخاخ النصوص العربية الخفية.",
    icon: CopyX,
  },
  {
    to: "/guide/data-privacy-browser",
    category: "privacy",
    title: "تحليل البيانات الحساسة داخل المتصفح: حدود الخصوصية والإرسال",
    desc: "ما الذي يُعالج محلياً، وما الذي قد يُرسل إلى مزوّد الذكاء الاصطناعي، وكيف تحمي البيانات الحساسة.",
    icon: ShieldCheck,
  },
];


export const GUIDE_GROUPS = [
  {
    id: "files",
    title: "استيراد الملفات وصيغ البيانات",
    description: "ابدأ بقراءة CSV وExcel، وافهم الترميز والفروق بين الصيغ قبل التحليل.",
    guides: GUIDES.filter((guide) => guide.category === "files"),
  },
  {
    id: "quality",
    title: "جودة البيانات وتنظيفها",
    description: "اكتشف مشكلات البيانات، وقِس جودتها، ونظّف التكرارات دون إفساد السجلات.",
    guides: GUIDES.filter((guide) => guide.category === "quality"),
  },
  {
    id: "analysis",
    title: "التحليل وبناء التقارير",
    description: "انتقل من السؤال التحليلي إلى الاستعلام والتجميع والتقرير القابل للمراجعة.",
    guides: GUIDES.filter((guide) => guide.category === "analysis"),
  },
  {
    id: "privacy",
    title: "الخصوصية والمعالجة المحلية",
    description: "افهم حدود المعالجة داخل المتصفح وما قد ينتقل إلى مزوّد الذكاء الاصطناعي.",
    guides: GUIDES.filter((guide) => guide.category === "privacy"),
  },
] as const;
