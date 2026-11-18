import {
  FileSpreadsheet,
  Languages,
  Gauge,
  MessageSquareText,
  Table2,
  FileDiff,
  CopyX,
  ShieldCheck,
  ClipboardList,
  Hash,
  CalendarDays,
  BookOpen,
  BarChart3,
  ChartColumn,
  Activity,
  GitBranch,
  TrendingUp,
  Database,
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
    desc: "المكررات، القيم المفقودة، وعدم اتساق أنواع الأعمدة — وكيف تقرأ حدود المؤشر وتبدأ التنظيف.",
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
  {
    to: "/guide/missing-values",
    category: "quality",
    title: "القيم المفقودة في Excel وCSV: متى تحذفها ومتى تعوّضها؟",
    desc: "اختر بين الحذف والوسيط والقيمة الأكثر تكراراً، وافهم أثر كل قرار على التحليل.",
    icon: ClipboardList,
  },
  {
    to: "/guide/data-types",
    category: "quality",
    title: "تحويل الأرقام المخزنة كنص في Excel وCSV إلى أرقام",
    desc: "اكتشف مشكلات أنواع الأعمدة والفواصل والقيم التي تفشل في التحويل قبل الحساب.",
    icon: Hash,
  },
  {
    to: "/guide/date-format",
    category: "quality",
    title: "تنسيق التاريخ في Excel وCSV: إصلاح DD/MM وMM/DD",
    desc: "وحّد صيغ التاريخ، واحسم ترتيب اليوم والشهر، وتجنب أخطاء التحليل الزمني.",
    icon: CalendarDays,
  },
  {
    to: "/guide/data-dictionary",
    category: "analysis",
    title: "قاموس البيانات: كيف تفهم أعمدة ملف Excel وCSV؟",
    desc: "وثّق أنواع الأعمدة وأدوارها واكتمالها والقيم المميزة قبل بدء التحليل.",
    icon: BookOpen,
  },
  {
    to: "/guide/descriptive-statistics",
    category: "analysis",
    title: "الإحصاء الوصفي للبيانات: المتوسط والوسيط والتوزيع",
    desc: "افهم مقاييس المركز والانتشار والتوزيع، ومتى يكون المتوسط مضللاً.",
    icon: BarChart3,
  },
  {
    to: "/guide/choose-chart",
    category: "analysis",
    title: "اختيار الرسم البياني المناسب: أعمدة أم خط أم دائري؟",
    desc: "اختر نوع الرسم وطريقة التجميع المناسبة للمقارنة والاتجاهات والنسب.",
    icon: ChartColumn,
  },
  {
    to: "/guide/outlier-detection",
    category: "quality",
    title: "القيم المتطرفة: كيف تكتشفها دون حذفها عشوائياً؟",
    desc: "استخدم IQR ودرجة Z كإشارات للفحص، وميّز بين القيمة النادرة والخطأ الحقيقي.",
    icon: Activity,
  },
  {
    to: "/guide/correlation-analysis",
    category: "analysis",
    title: "تحليل الارتباط بين المتغيرات: Pearson وSpearman",
    desc: "اقرأ اتجاه العلاقة وقوتها، وافهم لماذا لا يثبت الارتباط وجود سببية.",
    icon: GitBranch,
  },
  {
    to: "/guide/time-series-analysis",
    category: "analysis",
    title: "تحليل السلاسل الزمنية: الاتجاه والموسمية والتغير",
    desc: "وحّد التواريخ، واختر التجميع الزمني، وافصل الاتجاه عن الموسمية والتنبؤ.",
    icon: TrendingUp,
  },
  {
    to: "/guide/sql-basics",
    category: "analysis",
    title: "أساسيات SQL لتحليل البيانات: SELECT وGROUP BY",
    desc: "تعلم التصفية والتجميع والعدّ والمتوسط، وراجع الاستعلام قبل اعتماد نتائجه.",
    icon: Database,
  },
  {
    to: "/guide/arabic-text-cleaning",
    category: "quality",
    title: "تنظيف النصوص العربية في Excel وCSV",
    desc: "عالج المسافات الخفية واختلاف الحروف والأرقام مع الحفاظ على النص الأصلي.",
    icon: Languages,
  },
  {
    to: "/guide/chart-interpretation",
    category: "analysis",
    title: "كيف تقرأ الرسم البياني وتفسّر النتائج؟",
    desc: "افحص المحاور والوحدات وحجم العينة، وتجنب الاستنتاجات المضللة.",
    icon: BarChart3,
  },
  {
    to: "/guide/data-analysis-arabic",
    category: "analysis",
    title: "تحليل البيانات بالعربية: من ملف Excel إلى نتائج واضحة",
    desc: "ابدأ من ملفك، افحص الجودة، استكشف الإحصاءات والرسوم، واسأل بياناتك بالعربية.",
    icon: BarChart3,
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
    description: "اكتشف القيم المفقودة والأرقام النصية والتواريخ والقيم المتطرفة، ونظّف النصوص العربية بأمان.",
    guides: GUIDES.filter((guide) => guide.category === "quality"),
  },
  {
    id: "analysis",
    title: "التحليل وبناء التقارير",
    description: "افهم الأعمدة والإحصاءات والارتباط والسلاسل الزمنية وSQL، واختر الرسوم واقرأها قبل بناء تقرير قابل للمراجعة.",
    guides: GUIDES.filter((guide) => guide.category === "analysis"),
  },
  {
    id: "privacy",
    title: "الخصوصية والمعالجة المحلية",
    description: "افهم حدود المعالجة داخل المتصفح وما قد ينتقل إلى مزوّد الذكاء الاصطناعي.",
    guides: GUIDES.filter((guide) => guide.category === "privacy"),
  },
] as const;
