/**
 * وكيل بصيرة — طبقة الخادم: يحوّل نتائج التحليل المحلي إلى تقرير تنفيذي عربي.
 * المفتاح OPENROUTER_API_KEY يُقرأ داخل الـ handler فقط ولا يصل للمتصفح أبداً.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RequestZ = z.object({
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

export type AgentBriefResponse = { ok: true; brief: AgentBrief } | { ok: false; error: string };

const MODEL = "google/gemini-2.5-flash";

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline_ar: { type: "string" },
    summary_ar: { type: "string" },
    findings_ar: { type: "array", items: { type: "string" } },
    risks_ar: { type: "array", items: { type: "string" } },
    recommendations_ar: { type: "array", items: { type: "string" } },
    next_questions_ar: { type: "array", items: { type: "string" } },
  },
  required: [
    "headline_ar",
    "summary_ar",
    "findings_ar",
    "risks_ar",
    "recommendations_ar",
    "next_questions_ar",
  ],
} as const;

const SYSTEM = `أنت كبير محللي البيانات في شركة استشارية. تكتب بالعربية الفصحى المبسطة وبنبرة تنفيذية واثقة.
ستتلقى نتائج تحليل تم تنفيذه فعلياً على بيانات المستخدم محلياً (صحة البيانات، خطوات التنظيف، مؤشرات القطاع، إشارات شاذة، استنتاجات).
قواعد صارمة:
1. لا تخترع أي رقم غير موجود في المدخلات إطلاقاً. استخدم الأرقام كما وردت.
2. لا تذكر SQL ولا تفاصيل تقنية.
3. اجعل كل عنصر في القوائم جملة واحدة قصيرة ومباشرة.
4. findings_ar: 3 إلى 5 عناصر. risks_ar: 2 إلى 4. recommendations_ar: 3 إلى 5 توصيات قابلة للتنفيذ. next_questions_ar: 3 أسئلة تحليلية مقترحة.
5. summary_ar: فقرة من 3 إلى 5 جمل. headline_ar: عنوان واحد لا يتجاوز 12 كلمة.`;

export const generateAgentBrief = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RequestZ.parse(input))
  .handler(async ({ data }): Promise<AgentBriefResponse> => {
    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      return { ok: false, error: "لم يتم إعداد مفتاح OpenRouter بعد. أضفه في إعدادات المشروع." };
    }

    const userPrompt = `نتائج التحليل (JSON):
${JSON.stringify(data)}

اكتب التقرير التنفيذي بالعربية بناءً على هذه النتائج فقط.`;

    let res: Response;
    try {
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.3,
          max_tokens: 2048,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "agent_brief", strict: true, schema: RESPONSE_SCHEMA },
          },
        }),
      });
    } catch {
      return { ok: false, error: "تعذّر الاتصال بخدمة الذكاء الاصطناعي." };
    }

    if (!res.ok) {
      const body = await res.text();
      console.error(`OpenRouter brief failed [${res.status}]: ${body}`);
      if (res.status === 429) return { ok: false, error: "تم تجاوز حد الاستخدام حالياً. حاول بعد قليل." };
      if (res.status === 401 || res.status === 403) return { ok: false, error: "مفتاح OpenRouter غير صالح." };
      if (res.status === 402) return { ok: false, error: "رصيد OpenRouter غير كافٍ." };
      return { ok: false, error: "تعذّر توليد التقرير حالياً." };
    }

    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = payload.choices?.[0]?.message?.content ?? "";
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