/**
 * اقتراحات رسم بديلة بالذكاء الاصطناعي — اختيارية ومحكومة بموافقة صريحة منفصلة.
 * لا يصل إلى المزوّد إلا الحمولة المعروضة للمستخدم (أسماء الأعمدة وأنواعها، إعداد الرسم الحالي،
 * وحتى 30 نقطة مجمّعة). لا صفوف خام ولا ملف كامل.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeQuota } from "@/lib/quota.server";
import { quotaMessage, type QuotaErrorCode, type QuotaInfo } from "@/lib/quota";
import { generateRoutedJson } from "@/lib/ai-orchestrator.server";
import { isCloudAiConsentGranted, runCloudAiRequest } from "@/lib/cloud-ai-consent";
import {
  MAX_SUGGEST_COLUMNS,
  MAX_SUGGEST_POINTS,
  SuggestionsResponseZ,
  type ChartSuggestion,
} from "@/lib/chart-ai-suggest";

const RequestZ = z.object({
  actionId: z.string().uuid().optional(),
  cloudAiConsent: z.boolean().optional(),
  columns: z
    .array(z.object({ name: z.string().max(120), type: z.string().max(60) }))
    .max(MAX_SUGGEST_COLUMNS),
  current: z.object({
    kind: z.string().max(30),
    x: z.string().max(120),
    y: z.string().max(120),
    agg: z.string().max(10),
  }),
  points: z
    .array(z.object({ label: z.string().max(60), value: z.number() }))
    .max(MAX_SUGGEST_POINTS),
  totalPoints: z.number().nonnegative(),
});

export type ChartSuggestResponse =
  | { ok: true; suggestions: ChartSuggestion[] }
  | {
      ok: false;
      error: string;
      code?: QuotaErrorCode | "cloud_consent_required";
      quota?: QuotaInfo;
    };

const SYSTEM = `أنت خبير تصوير بيانات. تقترح رسوماً بديلة أو مكمّلة للرسم الحالي بالاعتماد على مخطط الأعمدة والنقاط المجمّعة المعطاة فقط.
قواعد صارمة:
1. أعد JSON فقط بالشكل {"suggestions":[{"title_ar","why_ar","kind","x","y","agg"}]} (حتى 4 اقتراحات).
2. kind من: bar, horizontalBar, stacked, line, area, pie, combo, funnel, waterfall, treemap, radar, histogram, boxplot, scatter, heatmap.
3. x و y أسماء أعمدة موجودة حرفياً في columns؛ y عمود رقمي ما لم يكن agg هو COUNT.
4. why_ar جملة واحدة تذكر سبب الاقتراح بالاعتماد على النقاط المعطاة، دون اختراع أي رقم.
5. لا تقترح الرسم الحالي نفسه.`;

export const suggestChartAlternatives = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RequestZ.parse(input))
  .handler(async ({ data: input, context }): Promise<ChartSuggestResponse> => {
    if (!isCloudAiConsentGranted(input.cloudAiConsent)) {
      return {
        ok: false,
        code: "cloud_consent_required",
        error: "فعّل خيار السماح بإرسال البيانات إلى AI سحابي أولاً.",
      };
    }
    const { actionId, cloudAiConsent: _consent, ...payload } = input;
    const quota = await consumeQuota(context.supabase, actionId, "brief");
    if (!quota.allowed) {
      const code: QuotaErrorCode =
        quota.reason === "action_limit" ? "action_limit" : "quota_exceeded";
      return { ok: false, error: quotaMessage(code, quota), code, quota };
    }
    try {
      const guarded = await runCloudAiRequest(input, () =>
        generateRoutedJson({
          task: "report",
          system: SYSTEM,
          prompt: `بيانات الرسم (JSON):\n${JSON.stringify(payload)}`,
          temperature: 0.3,
          maxTokens: 1024,
        }),
      );
      if (!guarded.ok) return { ok: false, error: "يلزم إذن AI سحابي.", code: guarded.code };
      const text = guarded.value.content
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
      const checked = SuggestionsResponseZ.safeParse(JSON.parse(text));
      return checked.success
        ? { ok: true, suggestions: checked.data.suggestions }
        : { ok: false, error: "استجابة النموذج غير مطابقة للصيغة." };
    } catch (err) {
      if (err instanceof Error && err.message === "AI_PROVIDER_NOT_CONFIGURED")
        return { ok: false, error: "لم يتم إعداد مزوّد AI بعد على الخادم." };
      return { ok: false, error: "تعذّر توليد الاقتراحات حالياً." };
    }
  });
