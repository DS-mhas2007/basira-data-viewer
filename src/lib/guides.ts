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
}

export const GUIDES: GuideItem[] = [
  {
    to: "/guide/arabic-csv-excel",
    title: "كيف تحلّل ملفات Excel و CSV بالعربية دون رفعها",
    desc: "تحليل محلي كامل داخل المتصفح مع حلول الترميز وجودة البيانات.",
    icon: FileSpreadsheet,
  },
  {
    to: "/guide/fix-arabic-encoding",
    title: "حل مشكلة الحروف العربية المتكسّرة في ملفات CSV",
    desc: "لماذا تظهر ãäÇÁÉ بدل النص العربي، وكيف تصلحها في Excel و Google Sheets وبصيرة.",
    icon: Languages,
  },
  {
    to: "/guide/data-quality-score",
    title: "درجة جودة البيانات: كيف تقيس نظافة ملفك من 100",
    desc: "المكررات، الفراغات، عدم اتساق الأنواع، والقيم الشاذة — وكيف تصلحها بلا تدمير.",
    icon: Gauge,
  },
  {
    to: "/guide/ask-data-in-arabic",
    title: "اسأل بياناتك بالعربية: من السؤال إلى استعلام SQL موثّق",
    desc: "كيف يحوّل الذكاء الاصطناعي سؤالك إلى استعلام، ولماذا بطاقة الدليل تمنع الأرقام المخترعة.",
    icon: MessageSquareText,
  },
  {
    to: "/guide/pivot-alternative",
    title: "بديل الجداول المحورية (Pivot Tables) لتقارير عربية أسرع",
    desc: "من التجميع اليدوي في Excel إلى تقارير PDF و PPTX عربية جاهزة بنقرة.",
    icon: Table2,
  },
  {
    to: "/guide/csv-vs-excel",
    title: "الفرق بين CSV و Excel: أيهما تختار لبياناتك العربية؟",
    desc: "الترميز، الأنواع، تعدد الأوراق، والأداء — ومتى تختار كل صيغة قبل التحليل.",
    icon: FileDiff,
  },
  {
    to: "/guide/remove-duplicates",
    title: "إزالة الصفوف المكررة والفراغات دون إتلاف بياناتك",
    desc: "التكرار الكامل مقابل التكرار على مفتاح، وفخاخ النصوص العربية الخفية.",
    icon: CopyX,
  },
  {
    to: "/guide/data-privacy-browser",
    title: "تحليل بيانات حسّاسة دون رفعها لأي خادم",
    desc: "المعالجة داخل المتصفح، وما الذي يُرسل فعلاً عند استخدام الذكاء الاصطناعي.",
    icon: ShieldCheck,
  },
];
