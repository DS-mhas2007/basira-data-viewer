/**
 * صياغة سردية اختيارية لاستنتاجات التقرير. الخادم يُرجع نصاً فقط؛ التحقق من الأرقام يتم في العميل
 * مقابل الحقائق نفسها، فلا يُقبل أي نص فيه رقم غير مسنود.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeQuota } from "@/lib/quota.server";
import { quotaMessage, type QuotaErrorCode, type QuotaInfo } from "@/lib/quota";
import { generateRoutedJson } from "@/lib/ai-orchestrator.server";
import { isCloudAiConsentGranted, runCloudAiRequest } from "@/lib/cloud-ai-consent";

const RequestZ = z.object({
  actionId: z.string().uuid().optional(),
  cloudAiConsent: z.boolean().optional(),
  items: z
    .array(
      z.object({
        id: z.string().max(80),
        title: z.string().max(200),
        facts: z.array(z.string().max(400)).max(30),
      }),
    )
    .min(1)
    .max(12),
});

const OutZ = z.object({
  narrations: z.array(z.object({ id: z.string(), text: z.string() })),
});

export type NarrativeResponse =
  | { ok: true; narrations: { id: string; text: string }[] }
  | { ok: false; error: string; code?: QuotaErrorCode | "cloud_consent_required"; quota?: QuotaInfo };

const SYSTEM = `أنت محلل بيانات تكتب فقرات تفسيرية قصيرة لتقرير رسمي بالعربية الفصحى المبسطة.
لكل عنصر ستتلقى عنواناً وقائمة حقائق مستخرجة من نتيجة استعلام نُفّذ فعلياً.
قواعد صارمة:
1. اكتب جملتين إلى ثلاث لكل عنصر، بنبرة تحليلية محايدة.
2. استخدم فقط الأرقام الواردة حرفياً في الحقائق. لا تحسب نسباً ولا فروقاً ولا مجاميع جديدة، ولا تقرّب الأرقام.
3. لا تذكر SQL ولا تفاصيل تقنية، ولا تقدّم أسباباً سببية لم تُذكر في الحقائق.
4. أعد JSON فقط بالشكل: {"narrations":[{"id":"...","text":"..."}]} وبنفس معرّفات العناصر.`;

export const generateReportNarratives = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RequestZ.parse(input))
  .handler(async ({ data: input, context }): Promise<NarrativeResponse> => {
    if (!isCloudAiConsentGranted(input.cloudAiConsent)) {
      return { ok: false, code: "cloud_consent_required", error: "فعّل خيار السماح بإرسال البيانات إلى AI سحابي لاستخدام الصياغة الذكية." };
    }
    const quota = await consumeQuota(context.supabase, input.actionId, "brief");
    if (!quota.allowed) {
      const code: QuotaErrorCode = quota.reason === "action_limit" ? "action_limit" : "quota_exceeded";
      return { ok: false, error: quotaMessage(code, quota), code, quota };
    }
    let text = "";
    try {
      const guarded = await runCloudAiRequest(input, () =>
        generateRoutedJson({
          task: "report",
          system: SYSTEM,
          prompt: `العناصر (JSON):\n${JSON.stringify(input.items)}`,
          temperature: 0.2,
          maxTokens: 2048,
        }),
      );
      if (!guarded.ok) return { ok: false, error: "يلزم إذن AI سحابي.", code: guarded.code };
      text = guarded.value.content;
    } catch (err) {
      console.error("MIZYAi narrative failed:", err);
      return { ok: false, error: "تعذّرت الصياغة الذكية حالياً؛ سيُستخدم النص المحلي." };
    }
    try {
      const parsed = OutZ.safeParse(JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()));
      if (!parsed.success) return { ok: false, error: "استجابة غير مطابقة للصيغة؛ سيُستخدم النص المحلي." };
      return { ok: true, narrations: parsed.data.narrations };
    } catch {
      return { ok: false, error: "تعذّر فهم استجابة النموذج؛ سيُستخدم النص المحلي." };
    }
  });
