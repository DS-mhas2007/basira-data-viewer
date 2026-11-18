/**
 * الوحدة 4: طبقة الخادم لتخطيط SQL عبر MIZYAi AI Orchestrator.
 * مفاتيح مزوّدي النماذج تُقرأ على الخادم فقط ولا تصل إلى المتصفح.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeQuota } from "@/lib/quota.server";
import { quotaMessage, type QuotaErrorCode, type QuotaInfo } from "@/lib/quota";
import { generateRoutedJson } from "@/lib/ai-orchestrator.server";
import { AiPlanZ, normalizeAiPlanPayload, type AiPlan } from "@/lib/ai-plan-schema";
export type { AiPlan } from "@/lib/ai-plan-schema";

const ColumnSchemaZ = z.object({ name: z.string(), type: z.string() });

const RequestZ = z.object({
  /** يجمع استدعاءات عملية واحدة (أسئلة متعددة) في طلب محسوب واحد. */
  actionId: z.string().uuid().optional(),
  question: z.string().trim().min(1).max(500),
  table: z.string().min(1).max(120),
  rowCount: z.number().int().nonnegative(),
  schema: z.array(ColumnSchemaZ).min(1).max(200),
  sample: z.array(z.record(z.unknown())).max(10).default([]),
  /** محاولة سابقة فشلت — تُستخدم لإصلاح الاستعلام ذاتياً. */
  retry: z
    .object({ sql: z.string().max(4000), error: z.string().max(600) })
    .nullable()
    .default(null),
});

export type AiQueryResponse =
  | { ok: true; plan: AiPlan }
  | { ok: false; error: string; code?: QuotaErrorCode; quota?: QuotaInfo };

// نموذج مجاني على OpenRouter (:free) — لا يحتاج رصيداً، لكن بحدود استخدام يومية.
const OPENROUTER_MODEL = "google/gemma-4-31b-it:free";

function buildSystemPrompt(table: string, rowCount: number, schema: { name: string; type: string }[]) {
  const cols = schema.map((c) => `- "${c.name}" (${c.type})`).join("\n");
  return `أنت محلل بيانات خبير يترجم أسئلة المستخدم بالعربية إلى استعلام SQL واحد لمحرك DuckDB.

اسم الجدول الوحيد المتاح: "${table}"
عدد صفوف مجموعة البيانات الكاملة: ${rowCount} صف بالضبط.
العينة التي ستظهر في رسالة المستخدم تتكون من 8 صفوف كحد أقصى وهي للمعاينة الشكلية فقط؛ لا تخلط بين عدد صفوف العينة وعدد صفوف مجموعة البيانات الكاملة.
ممنوع وصف مجموعة البيانات بأنها تحتوي 8 صفوف لمجرد أن العينة المرسلة 8 صفوف. عند طلب الملخص العام، اذكر عدد الصفوف من القيمة الموثوقة أعلاه، واجعل بقية الأرقام مستندة إلى SQL فقط.
الأعمدة المتاحة (لا يوجد غيرها إطلاقاً):
${cols}

قواعد صارمة:
1. لا تخترع أي اسم عمود أو جدول غير موجود في القائمة أعلاه. استخدم الأسماء حرفياً وبين علامات اقتباس مزدوجة.
2. أنت تقترح SQL فقط ولا تنفّذه ولا تخترع نتائج أو أرقاماً.
3. الاستعلام يجب أن يبدأ بـ SELECT أو WITH فقط، جملة واحدة بلا فاصلة منقوطة، وممنوع تماماً: INSERT, UPDATE, DELETE, DROP, ALTER, CREATE.
4. أضف LIMIT مناسب (لا يتجاوز 1000) في نهاية الاستعلام.
5. أعطِ اسماً بديلاً (alias) واضحاً لكل عمود محسوب، واستخدم نفس هذه الأسماء في حقل chart.
6. إذا كان السؤال غامضاً أو لا يمكن ربطه بالأعمدة المتاحة، أعد needs_clarification: true مع clarification_question بالعربية واترك sql فارغاً.
7. أعد JSON فقط بلا أي نص إضافي أو علامات تنسيق، وبنفس المفاتيح المطلوبة بالضبط.
8. intro_ar: سطر واحد موجز بالعربية يقدّم الإجابة مباشرة. بلا إضافات غير ضرورية.
9. analysis_ar: فقرة قصيرة (1-3 جمل) تفسّر لماذا النتيجة مهمة أو ملفتة.
10. لا تذكر أرقاماً لم تأتِ من الاستعلام.
15. دلالات المقاييس المالية ومنع العدّ المزدوج:
   - لا تفترض أن كل صف يمثل طلباً كاملاً؛ قد يمثل صفاً واحداً بنداً/منتجاً داخل الطلب.
   - إذا احتوى المخطط أو العينة على معرّف طلب (مثل OrderID/Order_ID/رقم الطلب) مع مبلغ إجمالي للطلب (مثل TotalAmount/OrderTotal/إجمالي الطلب)، فتحقّق من احتمال تكرار مبلغ الطلب نفسه في عدة صفوف.
   - عند حساب إجمالي قيمة الطلبات في هذه الحالة، لا تستخدم SUM للمبلغ المكرر مباشرة على مستوى الصفوف. استخدم CTE أو استعلاماً فرعياً يختزل إلى صف واحد لكل معرّف طلب، مثلاً MAX للمبلغ داخل كل طلب بعد التحقق من أن المبلغ ثابت أو شبه ثابت داخل الطلب، ثم SUM للمبالغ المختزلة.
   - إذا لم يتوفر معرّف طلب أو لم يمكن التحقق من دلالة العمود، لا تسمِّ SUM لأي مبلغ بأنه إجمالي المبيعات/الإيرادات؛ صِف الناتج بأنه مجموع قيم الصفوف، وأضف تحذيراً واضحاً أو اطلب توضيحاً.
   - لا تجمع UnitPrice وحده وتسميه إيراداً أو مبيعات؛ سعر الوحدة يحتاج كمية (Quantity) ومعالجة خصومات/ضرائب إن وجدت.
   - إذا كان السؤال عن عدد الطلبات، استخدم COUNT(DISTINCT order_id) عند توفر معرّف الطلب، وليس COUNT(*) على بنود الطلب.
   - لا تطبّق قواعد deduplication آلياً على أعمدة غير مالية أو دون مفتاح تجميع موثوق.
11. أعد JSON مطابقاً تماماً لهذا الهيكل، مع جميع المفاتيح حتى عندما تكون القيم فارغة:
{
  "intent": "summary",
  "title_ar": "عنوان موجز",
  "sql": "SELECT COUNT(*) AS total_rows FROM \"${table}\" LIMIT 1",
  "intro_ar": "خلاصة مباشرة",
  "analysis_ar": "تفسير موجز",
  "chart": { "type": "table", "x": null, "y": [], "series": null },
  "explanation_plan": [],
  "warnings": [],
  "needs_clarification": false,
  "clarification_question": null
}
12. قيم intent المسموحة فقط: compare, trend, distribution, ranking, anomaly, summary.
13. قيم chart.type المسموحة فقط: bar, line, scatter, histogram, table, kpi.
14. إذا لم يلزم محور x فاستخدم null، وإذا لم توجد سلسلة فاستخدم null، ويجب أن تكون y مصفوفة حتى إن كانت فارغة.
`;
}

export const planAiQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RequestZ.parse(input))
  .handler(async ({ data, context }): Promise<AiQueryResponse> => {
    const quota = await consumeQuota(context.supabase, data.actionId, "ask_data");
    if (!quota.allowed) {
      const code: QuotaErrorCode = quota.reason === "action_limit" ? "action_limit" : "quota_exceeded";
      return { ok: false, error: quotaMessage(code, quota), code, quota };
    }

    const userPrompt = `سؤال المستخدم: ${data.question}\n\nعينة من الصفوف (JSON، للاسترشاد بأشكال القيم فقط):\n${JSON.stringify(data.sample.slice(0, 10))}${data.retry ? `\n\nمحاولة سابقة فشلت. الاستعلام السابق:\n${data.retry.sql}\nسبب الفشل: ${data.retry.error}\nصحّح الاستعلام هذه المرة: التزم حرفياً بأسماء الأعمدة المتاحة، بسّط المنطق قدر الإمكان، وتجنّب أي دوال أو وظائف خاصة.` : ""}`;

    let text = "";
    try {
      const result = await generateRoutedJson({
        task: "sql_plan",
        system: buildSystemPrompt(data.table, data.rowCount, data.schema),
        prompt: userPrompt,
        temperature: 0.1,
        maxTokens: 2048,
      });
      text = result.content;
      console.info(`[MIZYAi AI] sql_plan via ${result.provider}/${result.model} in ${result.latencyMs}ms`);
    } catch (err) {
      console.error("MIZYAi SQL planning failed:", err);
      const message = err instanceof Error ? err.message : "";
      if (message === "AI_PROVIDER_NOT_CONFIGURED") {
        return { ok: false, error: "لم يتم إعداد أي مزوّد AI بعد. أضف مفتاح Gemini أو Groq أو OpenRouter أو Cloudflare في أسرار الخادم." };
      }
      if (message.includes(":401") || message.includes(":403")) {
        return { ok: false, error: "رفض مزوّد الذكاء الاصطناعي المفتاح أو صلاحياته." };
      }
      return { ok: false, error: "تعذّر الاتصال بمزوّدي الذكاء الاصطناعي حالياً. حاول بعد قليل." };
    }

    if (!text.trim()) {
      return { ok: false, error: "لم يُرجع النموذج أي نتيجة. أعد صياغة السؤال." };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
    } catch {
      return { ok: false, error: "تعذّر فهم استجابة النموذج. أعد صياغة السؤال." };
    }

    const parsed = AiPlanZ.safeParse(normalizeAiPlanPayload(parsedJson));
    if (!parsed.success) {
      console.error("AI plan failed Zod validation", parsed.error.flatten());
      return { ok: false, error: "استجابة النموذج غير مطابقة للصيغة المطلوبة. أعد المحاولة." };
    }

    if (!parsed.data.needs_clarification && !parsed.data.sql.trim()) {
      console.warn("AI plan validation passed without a SQL query.");
      return { ok: false, error: "لم يُرجع النموذج استعلاماً قابلاً للتنفيذ. أعد صياغة السؤال." };
    }

    return { ok: true, plan: parsed.data };
  });
