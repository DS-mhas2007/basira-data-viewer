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
import { buildSystemPrompt } from "@/lib/ai-query-prompt";
import { isCloudAiConsentGranted, runCloudAiRequest } from "@/lib/cloud-ai-consent";
export type { AiPlan } from "@/lib/ai-plan-schema";

const ColumnSchemaZ = z.object({ name: z.string(), type: z.string(), hint: z.string().max(200).optional() });

const RequestZ = z.object({
  /** يجمع استدعاءات عملية واحدة (أسئلة متعددة) في طلب محسوب واحد. */
  actionId: z.string().uuid().optional(),
  /** موافقة مستقلة وصريحة على إرسال البيانات إلى مزوّد AI سحابي. */
  cloudAiConsent: z.boolean().optional(),
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
  | { ok: false; error: string; code?: QuotaErrorCode | "cloud_consent_required"; quota?: QuotaInfo };

// نموذج مجاني على OpenRouter (:free) — لا يحتاج رصيداً، لكن بحدود استخدام يومية.
const OPENROUTER_MODEL = "google/gemma-4-31b-it:free";


export const planAiQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RequestZ.parse(input))
  .handler(async ({ data, context }): Promise<AiQueryResponse> => {
    if (!isCloudAiConsentGranted(data.cloudAiConsent)) {
      return {
        ok: false,
        code: "cloud_consent_required",
        error: "لم يُرسل الطلب: فعّل خيار السماح بإرسال البيانات إلى AI سحابي أولاً. يمكنك متابعة التحليل المحلي دون هذا الإذن.",
      };
    }

    const quota = await consumeQuota(context.supabase, data.actionId, "ask_data");
    if (!quota.allowed) {
      const code: QuotaErrorCode = quota.reason === "action_limit" ? "action_limit" : "quota_exceeded";
      return { ok: false, error: quotaMessage(code, quota), code, quota };
    }

    const userPrompt = `سؤال المستخدم: ${data.question}\n\nعينة من الصفوف (JSON، للاسترشاد بأشكال القيم فقط):\n${JSON.stringify(data.sample.slice(0, 10))}${data.retry ? `\n\nمحاولة سابقة فشلت. الاستعلام السابق:\n${data.retry.sql}\nسبب الفشل: ${data.retry.error}\nصحّح الاستعلام هذه المرة: التزم حرفياً بأسماء الأعمدة المتاحة، بسّط المنطق قدر الإمكان، وتجنّب أي دوال أو وظائف خاصة.` : ""}`;

    let text = "";
    try {
      const guarded = await runCloudAiRequest(data, () => generateRoutedJson({
          task: "sql_plan",
          system: buildSystemPrompt(data.table, data.rowCount, data.schema),
          prompt: userPrompt,
          temperature: 0.1,
          maxTokens: 2048,
        }));
      if (!guarded.ok) return { ok: false, error: "لم يُرسل الطلب: يلزم إذن AI سحابي.", code: guarded.code };
      const result = guarded.value;
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
