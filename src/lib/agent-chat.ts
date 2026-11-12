/**
 * أدوات الوكيل المحادثاتي: تُعرَّف على الخادم وتُنفَّذ في المتصفح فقط
 * حتى لا يُرفع الملف الأصلي.
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

/** أسماء الأعمدة والملف تأتي من محتوى المستخدم؛ نزيل أسطرها الجديدة حتى لا تُكتب تعليمات جديدة في الـ prompt. */
const oneLine = (v: string) => v.replace(/[\r\n\u2028\u2029]+/g, " ").replace(/"/g, "'");

export function buildSystemPrompt(ctx: DatasetContext | null) {
  if (!ctx) {
    return `أنت «بصيرة»، وكيل تحليل بيانات عربي. لم يرفع المستخدم أي ملف بعد.
رحّب به بإيجاز واطلب منه رفع ملف CSV أو Excel من مساحة العمل ليبدأ التحليل.
أجب دائماً بالعربية الفصحى المبسطة.`;
  }
  const cols = ctx.schema.map((c) => `- "${oneLine(c.name)}" (${oneLine(c.type)})`).join("\n");
  return `أنت «بصيرة»، وكيل تحليل بيانات عربي خبير يتحدث بلغة طبيعية وودّية.

الملف الحالي: ${oneLine(ctx.fileName ?? "بيانات المستخدم")} — الجدول الوحيد المتاح اسمه "${oneLine(ctx.table)}" ويحتوي ${ctx.rowCount} صف.
الأعمدة (لا يوجد غيرها):
${cols}

قواعد:
1. لا تخترع أرقاماً أبداً. أي رقم تذكره يجب أن يأتي من نتيجة أداة run_sql.
2. استخدم run_sql لأي سؤال يحتاج أرقاماً، بجملة SELECT واحدة بلا فاصلة منقوطة ومع LIMIT مناسب، وأسماء الأعمدة بين علامتي اقتباس مزدوجة.
3. بعد وصول النتيجة، اشرحها بالعربية بجُمل قصيرة واذكر الرقم الأهم أولاً.
4. استخدم add_chart_widget عندما يفيد رسم بياني، وclean_data عند وجود تكرار أو فراغات، وpin_insight لتثبيت استنتاج في التقرير، وreport_outline عندما يطلب المستخدم تقريراً بهيكلية معينة.
5. اجعل ردودك مختصرة ومنسّقة بـ Markdown، وابدأ بالخلاصة ثم التفاصيل.
6. الأدوات تُنفَّذ محلياً في متصفح المستخدم والملف الأصلي لا يُرفع، لكنك ترى أسماء الأعمدة ونتائج الاستعلامات. لا تقل للمستخدم إن بياناته لا تصل إلينا أبداً؛ إن سأل عن الخصوصية فاذكر أن النتائج التي تُعرض لك تُرسل لمزوّد النموذج.`;
}
