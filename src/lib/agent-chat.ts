/**
 * أدوات الوكيل المحادثاتي: تُعرَّف على الخادم وتُنفَّذ في المتصفح فقط
 * حتى لا تغادر بياناتك جهازك أبداً.
 */
import { z } from "zod";

export const RunSqlInput = z.object({
  sql: z.string().describe("استعلام SELECT واحد على جدول dataset"),
  purpose_ar: z.string().describe("سبب الاستعلام بالعربية"),
});

export const AddChartInput = z.object({
  title: z.string(),
  kind: z.enum(["bar", "line", "area", "pie"]),
  x: z.string().describe("عمود التصنيف"),
  y: z.string().describe("عمود القيمة"),
  agg: z.enum(["SUM", "AVG", "COUNT", "MAX", "MIN"]),
});

export const CleanInput = z.object({
  operation: z.enum(["dedupe", "trim"]),
  reason_ar: z.string(),
});

export const PinInsightInput = z.object({
  title_ar: z.string(),
  summary_ar: z.string(),
});

export const ReportOutlineInput = z.object({
  audience: z.enum(["executive", "analyst", "operational"]),
  sections_ar: z.array(z.string()).describe("عناوين أقسام التقرير بالترتيب"),
  notes_ar: z.string(),
});

export interface DatasetContext {
  table: string;
  rowCount: number;
  schema: { name: string; type: string }[];
  fileName: string | null;
}

export function buildSystemPrompt(ctx: DatasetContext | null) {
  if (!ctx) {
    return `أنت «بصيرة»، وكيل تحليل بيانات عربي. لم يرفع المستخدم أي ملف بعد.
رحّب به بإيجاز واطلب منه رفع ملف CSV أو Excel من مساحة العمل ليبدأ التحليل.
أجب دائماً بالعربية الفصحى المبسطة.`;
  }
  const cols = ctx.schema.map((c) => `- "${c.name}" (${c.type})`).join("\n");
  return `أنت «بصيرة»، وكيل تحليل بيانات عربي خبير يتحدث بلغة طبيعية وودّية.

الملف الحالي: ${ctx.fileName ?? "بيانات المستخدم"} — الجدول الوحيد المتاح اسمه "${ctx.table}" ويحتوي ${ctx.rowCount} صف.
الأعمدة (لا يوجد غيرها):
${cols}

قواعد:
1. لا تخترع أرقاماً أبداً. أي رقم تذكره يجب أن يأتي من نتيجة أداة run_sql.
2. استخدم run_sql لأي سؤال يحتاج أرقاماً، بجملة SELECT واحدة بلا فاصلة منقوطة ومع LIMIT مناسب، وأسماء الأعمدة بين علامتي اقتباس مزدوجة.
3. بعد وصول النتيجة، اشرحها بالعربية بجُمل قصيرة واذكر الرقم الأهم أولاً.
4. استخدم add_chart_widget عندما يفيد رسم بياني، وclean_data عند وجود تكرار أو فراغات، وpin_insight لتثبيت استنتاج في التقرير، وreport_outline عندما يطلب المستخدم تقريراً بهيكلية معينة.
5. اجعل ردودك مختصرة ومنسّقة بـ Markdown، وابدأ بالخلاصة ثم التفاصيل.
6. البيانات لا تغادر متصفح المستخدم — الأدوات تُنفَّذ محلياً.`;
}
