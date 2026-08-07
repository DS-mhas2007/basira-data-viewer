/**
 * مكتبة القوالب: حزم تحليل جاهزة لكل قطاع — أسئلة معدّة مسبقاً + جمهور تقرير مقترح.
 * كل قالب يعمل محلياً على أعمدة ملفك بعد مطابقتها تلقائياً.
 */
import type { TableInfo } from "@/lib/duckdb-service";
import type { ReportAudience } from "@/lib/report";

export interface AnalysisTemplate {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  audience: ReportAudience;
  /** كلمات مفتاحية تُطابَق مع أسماء الأعمدة لترتيب القوالب حسب ملاءمتها. */
  keywords: RegExp[];
  /** أسئلة القالب: {measure} و{cat} و{date} تُستبدل بأعمدة ملفك. */
  questions: string[];
}

export const TEMPLATES: AnalysisTemplate[] = [
  {
    id: "sales",
    name: "أداء المبيعات",
    emoji: "🛒",
    tagline: "الإيراد، أفضل المنتجات، اتجاه الطلبات ومتوسط قيمة الطلب.",
    audience: "executive",
    keywords: [/sale|order|revenue|price|product|قيمة|مبيع|طلب|منتج|سعر/i],
    questions: [
      "ما إجمالي «{measure}» ومتوسطه لكل صف؟ اعرضهما في صف واحد.",
      "ما أعلى 10 قيم في «{cat}» من حيث إجمالي «{measure}»؟",
      "كيف تغيّر إجمالي «{measure}» عبر «{date}»؟ اعرض الاتجاه الزمني.",
      "ما نسبة مساهمة كل فئة في «{cat}» من إجمالي «{measure}»؟ اعرض أعلى 8.",
      "ما أدنى 10 قيم في «{cat}» من حيث إجمالي «{measure}»؟",
    ],
  },
  {
    id: "hr",
    name: "الموارد البشرية",
    emoji: "👥",
    tagline: "توزيع الموظفين، الرواتب، الأقسام ومؤشرات الدوران.",
    audience: "operational",
    keywords: [/employee|salary|depart|hire|staff|موظف|راتب|قسم|توظيف/i],
    questions: [
      "كم عدد الصفوف في كل فئة من «{cat}»؟ اعرض أعلى 10.",
      "ما متوسط «{measure}» لكل فئة في «{cat}»؟ اعرض أعلى 10.",
      "ما أعلى وأدنى قيم «{measure}» مع الفارق بينهما؟",
      "كيف تغيّر عدد الصفوف عبر «{date}»؟",
    ],
  },
  {
    id: "finance",
    name: "المالية والمصروفات",
    emoji: "💳",
    tagline: "المصروفات والإيرادات، التدفق الشهري وأكبر بنود الإنفاق.",
    audience: "executive",
    keywords: [/amount|cost|expense|payment|invoice|balance|مبلغ|تكلفة|مصروف|فاتورة|رصيد/i],
    questions: [
      "ما إجمالي «{measure}» ومتوسطه ووسيطه؟",
      "ما أكبر 10 بنود في «{cat}» من حيث «{measure}»؟",
      "كيف تطوّر إجمالي «{measure}» عبر «{date}»؟",
      "ما القيم التي تتجاوز ضعف متوسط «{measure}»؟ اعرض أعلى 10.",
    ],
  },
  {
    id: "operations",
    name: "التشغيل والجودة",
    emoji: "⚙️",
    tagline: "الحالات، معدلات الاكتمال، الاختناقات والتوزيع الزمني.",
    audience: "operational",
    keywords: [/status|stage|ticket|priority|duration|حالة|مرحلة|تذكرة|أولوية|مدة/i],
    questions: [
      "ما توزيع الصفوف حسب «{cat}»؟ اعرض أعلى 10 مع النسبة المئوية.",
      "ما متوسط «{measure}» لكل حالة في «{cat}»؟",
      "كيف تغيّر عدد الصفوف عبر «{date}»؟",
      "ما الفئات في «{cat}» الأقل تكراراً؟ اعرض أدنى 10.",
    ],
  },
  {
    id: "marketing",
    name: "التسويق والقنوات",
    emoji: "📣",
    tagline: "أداء القنوات والحملات ومعدلات التحويل عبر الزمن.",
    audience: "analyst",
    keywords: [/campaign|channel|click|impression|source|visit|حملة|قناة|زيار|نقر/i],
    questions: [
      "ما أداء كل قناة في «{cat}» من حيث إجمالي «{measure}»؟ اعرض أعلى 10.",
      "كيف تغيّر إجمالي «{measure}» عبر «{date}»؟",
      "ما نسبة مساهمة كل فئة في «{cat}» من الإجمالي؟",
      "ما متوسط «{measure}» لكل فئة في «{cat}»؟",
    ],
  },
  {
    id: "generic",
    name: "استكشاف عام",
    emoji: "🔎",
    tagline: "حزمة شاملة تصلح لأي ملف: توزيعات، اتجاهات وملخصات إحصائية.",
    audience: "analyst",
    keywords: [],
    questions: [
      "ما ملخص القيم الإحصائية لعمود «{measure}» (المتوسط، الوسيط، الأدنى، الأعلى)؟",
      "ما توزيع «{measure}» حسب «{cat}»؟ اعرض أعلى 10 فئات.",
      "ما أكثر 10 قيم تكراراً في عمود «{cat}»؟",
      "كيف تغيّرت البيانات عبر «{date}»؟",
    ],
  },
];

const DATE_RE = /(date|time|year|month|يوم|تاريخ|سنة|شهر)/i;
const NUM_RE = /(INT|DECIMAL|DOUBLE|FLOAT|REAL|NUMERIC|HUGEINT)/i;
const ID_RE = /(^id$|_id$|uuid|code|رقم|معرف)/i;

export interface TemplateColumns {
  measure?: string;
  cat?: string;
  date?: string;
}

/** يختار أفضل الأعمدة لتعبئة قوالب الأسئلة. */
export function pickColumns(info: TableInfo): TemplateColumns {
  const cols = info.schema;
  const dates = cols.filter((c) => /(DATE|TIMESTAMP|TIME)/i.test(c.type) || DATE_RE.test(c.name));
  const numeric = cols.filter(
    (c) => NUM_RE.test(c.type) && !DATE_RE.test(c.name) && !ID_RE.test(c.name),
  );
  const cats = cols.filter(
    (c) => !NUM_RE.test(c.type) && !DATE_RE.test(c.name) && !ID_RE.test(c.name),
  );
  const out: TemplateColumns = {};
  if (numeric[0]) out.measure = numeric[0].name;
  if (cats[0]) out.cat = cats[0].name;
  else if (cols[0]) out.cat = cols[0].name;
  if (dates[0]) out.date = dates[0].name;
  return out;
}

/** يبني أسئلة القالب الجاهزة للتنفيذ (يحذف ما لا يتوفر له عمود مناسب). */
export function buildTemplateQuestions(t: AnalysisTemplate, info: TableInfo): string[] {
  const c = pickColumns(info);
  const out: string[] = [];
  for (const q of t.questions) {
    if (q.includes("{measure}") && !c.measure) continue;
    if (q.includes("{cat}") && !c.cat) continue;
    if (q.includes("{date}") && !c.date) continue;
    out.push(
      q
        .replaceAll("{measure}", c.measure ?? "")
        .replaceAll("{cat}", c.cat ?? "")
        .replaceAll("{date}", c.date ?? ""),
    );
  }
  return out;
}

/** يرتّب القوالب حسب ملاءمتها لأسماء أعمدة الملف. */
export function rankTemplates(info: TableInfo): { template: AnalysisTemplate; score: number }[] {
  const names = info.schema.map((c) => c.name).join(" ");
  return TEMPLATES.map((template) => {
    const hits = template.keywords.filter((re) => re.test(names)).length;
    const usable = buildTemplateQuestions(template, info).length;
    return { template, score: hits * 10 + usable };
  })
    .filter((t) => buildTemplateQuestions(t.template, info).length > 0)
    .sort((a, b) => b.score - a.score);
}