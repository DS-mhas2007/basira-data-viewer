/**
 * MIZYAi analyst: يحوّل نتائج التحليل المحلي إلى تقرير تنفيذي عربي.
 * مفاتيح مزوّدي النماذج تُقرأ على الخادم فقط ولا تصل إلى المتصفح.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeQuota } from "@/lib/quota.server";
import { quotaMessage, type QuotaErrorCode, type QuotaInfo } from "@/lib/quota";
import { generateRoutedJson } from "@/lib/ai-orchestrator.server";

const RequestZ = z.object({
  /** نفس معرّف عملية الوكيل: الأسئلة والملخص يُحسبان عملية AI واحدة. */
  actionId: z.string().uuid().optional(),
  fileName: z.string().max(200).default(""),
  rowCount: z.number().nonnegative().default(0),
  columnCount: z.number().nonnegative().default(0),
  sector: z.string().max(120).default(""),
  healthScore: z.number().nullable().default(null),
  cleaning: z.array(z.string().max(200)).max(20).default([]),
  kpis: z.array(z.object({ label: z.string().max(120), value: z.string().max(120) })).max(12).default([]),
  signals: z.array(z.string().max(300)).max(12).default([]),
  insights: z.array(z.string().max(300)).max(12).default([]),
  columns: z.array(z.object({ name: z.string().max(120), type: z.string().max(60) })).max(120).default([]),
});

export const AgentBriefZ = z.object({
  headline_ar: z.string().min(1),
  summary_ar: z.string().min(1),
  findings_ar: z.array(z.string()).default([]),
  risks_ar: z.array(z.string()).default([]),
  recommendations_ar: z.array(z.string()).default([]),
  next_questions_ar: z.array(z.string()).default([]),
});

export type AgentBrief = z.infer<typeof AgentBriefZ>;

export type AgentBriefResponse =
  | { ok: true; brief: AgentBrief }
  | { ok: false; error: string; code?: QuotaErrorCode; quota?: QuotaInfo };

const SYSTEM = `أنت كبير محللي البيانات في شركة استشارية. تكتب بالعربية الفصحى المبسطة وبنبرة تنفيذية واثقة.
ستتلقى نتائج تحليل تم تنفيذه فعلياً على بيانات المستخدم محلياً (صحة البيانات، خطوات التنظيف، مؤشرات القطاع، إشارات شاذة، استنتاجات).
قواعد صارمة:
1. لا تخترع أي رقم غير موجود في المدخلات إطلاقاً. استخدم الأرقام كما وردت.
2. لا تذكر SQL ولا تفاصيل تقنية.
3. اجعل كل عنصر في القوائم جملة واحدة قصيرة ومباشرة.
4. findings_ar: 3 إلى 5 عناصر. risks_ar: 2 إلى 4. recommendations_ar: 3 إلى 5 توصيات قابلة للتنفيذ. next_questions_ar: 3 أسئلة تحليلية مقترحة.
5. summary_ar: فقرة من 3 إلى 5 جمل. headline_ar: عنوان واحد لا يتجاوز 12 كلمة.`;

export const generateAgentBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RequestZ.parse(input))
  .handler(async ({ data: input, context }): Promise<AgentBriefResponse> => {
    const { actionId, ...data } = input;
    const quota = await consumeQuota(context.supabase, actionId, "brief");
    if (!quota.allowed) {
      const code: QuotaErrorCode = quota.reason === "action_limit" ? "action_limit" : "quota_exceeded";
      return { ok: false, error: quotaMessage(code, quota), code, quota };
    }

    const userPrompt = `نتائج التحليل (JSON):\n${JSON.stringify(data)}\n\nاكتب التقرير التنفيذي بالعربية بناءً على هذه النتائج فقط.`;

    let text = "";
    try {
      const result = await generateRoutedJson({
        task: "report",
        system: SYSTEM,
        prompt: userPrompt,
        temperature: 0.3,
        maxTokens: 2048,
      });
      text = result.content;
      console.info(`[MIZYAi AI] report via ${result.provider}/${result.model} in ${result.latencyMs}ms`);
    } catch (err) {
      console.error("MIZYAi report generation failed:", err);
      if (err instanceof Error && err.message === "AI_PROVIDER_NOT_CONFIGURED") {
        return { ok: false, error: "لم يتم إعداد أي مزوّد AI بعد. أضف مفتاح Gemini أو Groq أو OpenRouter أو Cloudflare في أسرار الخادم." };
      }
      return { ok: false, error: "تعذّر توليد التقرير عبر مزوّدي الذكاء الاصطناعي حالياً." };
    }

    if (!text.trim()) return { ok: false, error: "لم يُرجع النموذج أي نتيجة." };

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
    } catch {
      return { ok: false, error: "تعذّر فهم استجابة النموذج." };
    }

    const parsed = AgentBriefZ.safeParse(parsedJson);
    if (!parsed.success) {
      console.error("Agent brief failed validation", parsed.error.flatten());
      return { ok: false, error: "استجابة النموذج غير مطابقة للصيغة المطلوبة." };
    }
    return { ok: true, brief: parsed.data };
  });