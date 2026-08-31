import {
  FileSpreadsheet,
  Languages,
  Gauge,
  MessageSquareText,
  Table2,
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
];
