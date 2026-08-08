/**
 * الوحدة 4: طبقة الخادم للاتصال بنموذج لغوي عبر OpenRouter.
 * المفتاح OPENROUTER_API_KEY يُقرأ داخل الـ handler فقط ولا يصل للمتصفح أبداً.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ColumnSchemaZ = z.object({ name: z.string(), type: z.string() });

const RequestZ = z.object({
  question: z.string().trim().min(1).max(500),
  table: z.string().min(1).max(120),
  schema: z.array(ColumnSchemaZ).min(1).max(200),
  sample: z.array(z.record(z.unknown())).max(10).default([]),
  /** محاولة سابقة فشلت — تُستخدم لإصلاح الاستعلام ذاتياً. */
  retry: z
    .object({ sql: z.string().max(4000), error: z.string().max(600) })
    .nullable()
    .default(null),
});

export const AiPlanZ = z.object({
  intent: z.enum(["compare", "trend", "distribution", "ranking", "anomaly", "summary"]),
  title_ar: z.string().min(1),
  sql: z.string(),
  intro_ar: z.string().default(""),
  analysis_ar: z.string().default(""),
  chart: z.object({
    type: z.enum(["bar", "line", "scatter", "histogram", "table", "kpi"]),
    x: z.string().nullable(),
    y: z.array(z.string()).default([]),
    series: z.string().nullable().default(null),
  }),
  explanation_plan: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  needs_clarification: z.boolean(),
  clarification_question: z.string().nullable().default(null),
});

export type AiPlan = z.infer<typeof AiPlanZ>;

export type AiQueryResponse =
  | { ok: true; plan: AiPlan }
  | { ok: false; error: string };

const OPENROUTER_MODEL = "google/gemini-2.5-flash";

function buildSystemPrompt(table: string, schema: { name: string; type: string }[]) {
  const cols = schema.map((c) => `- "${c.name}" (${c.type})`).join("\n");
  return `أنت محلل بيانات خبير يترجم أسئلة المستخدم بالعربية إلى استعلام SQL واحد لمحرك DuckDB.

اسم الجدول الوحيد المتاح: "${table}"
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
10. لا تذكر أرق��ماً لم تأتي من الاستعلام.
`;
}

const RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: {
      type: "string",
      enum: ["compare", "trend", "distribution", "ranking", "anomaly", "summary"],
    },
    title_ar: { type: "string" },
    sql: { type: "string" },
    intro_ar: { type: "string" },
    analysis_ar: { type: "string" },
    chart: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          type: "string",
          enum: ["bar", "line", "scatter", "histogram", "table", "kpi"],
        },
        x: { type: ["string", "null"] },
        y: { type: "array", items: { type: "string" } },
        series: { type: ["string", "null"] },
      },
      required: ["type", "x", "y", "series"],
    },
    explanation_plan: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    needs_clarification: { type: "boolean" },
    clarification_question: { type: ["string", "null"] },
  },
  required: [
    "intent",
    "title_ar",
    "sql",
    "intro_ar",
    "analysis_ar",
    "chart",
    "explanation_plan",
    "warnings",
    "needs_clarification",
    "clarification_question",
  ],
};

// اقرأ الإعدادات من متغيرات البيئة (Server-only)
const OPENROUTER_API_KEY = process.env["OPENROUTER_API_KEY"];
const OPENROUTER_API_BASE = process.env["OPENROUTER_API_BASE"] ?? "https://openrouter.ai/api/v1/chat/completions";

export const planAiQuery = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RequestZ.parse(input))
  .handler(async ({ data }): Promise<AiQueryResponse> => {
    if (!OPENROUTER_API_KEY) {
      return {
        ok: false,
        error:
          "لم يتم إعداد مفتاح OpenRouter بعد. أضفه في إعدادات المشروع (OPENROUTER_API_KEY) ثم أعد المحاولة.",
      };
    }

    const userPrompt = `سؤال المستخدم: ${data.question}\n\nعينة من الصفوف (JSON، للاسترشاد بأشكال القيم فقط):\n${JSON.stringify(data.sample.slice(0, 10))}${data.retry ? `\n\nمحاولة سابقة فشلت. الاستعلام السابق:\n${data.retry.sql}\nسبب الفشل: ${data.retry.error}\nصحّح الاستعلام هذه المرة: التزم حرفياً بأسماء الأعمدة المتاحة، بسّط المنطق قدر الإمكان، وتجنّب أي دوال أو وظائف خاصة.` : ""}`;

    let res: Response;
    try {
      res = await fetch(OPENROUTER_API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          temperature: 0.1,
          max_tokens: 2048,
          messages: [
            { role: "system", content: buildSystemPrompt(data.table, data.schema) },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "ai_query_plan", strict: true, schema: RESPONSE_SCHEMA },
          },
        }),
      });
    } catch (err) {
      console.error("OpenRouter network error:", err);
      return { ok: false, error: "تعذّر الاتصال بخدمة الذكاء الاصطناعي. حاول مرة أخرى." };
    }

    if (!res.ok) {
      const body = await res.text();
      console.error(`OpenRouter request failed [${res.status}]: ${body}`);
      if (res.status === 429) {
        return { ok: false, error: "تم تجاوز حد الاستخدام المسموح حالياً. حاول بعد قليل." };
      }
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "مفتاح OpenRouter غير صالح أو لا يملك صلاحية كافية." };
      }
      if (res.status === 402) {
        return { ok: false, error: "رصيد OpenRouter غير كافٍ. أضف رصيداً ثم أعد المحاولة." };
      }
      return { ok: false, error: "تعذّر تحليل السؤال حالياً. حاول مرة أخرى." };
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = payload.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) {
      return { ok: false, error: "لم يُرجع النموذج أي نتيجة. أعد صياغة السؤال." };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
    } catch {
      return { ok: false, error: "تعذّر فهم استجابة النموذج. أعد صياغة السؤال." };
    }

    const parsed = AiPlanZ.safeParse(parsedJson);
    if (!parsed.success) {
      console.error("AI plan failed Zod validation", parsed.error.flatten());
      return { ok: false, error: "استجابة النموذج غير مطابقة للصيغة المطلوبة. أعد المحاولة." };
    }

    return { ok: true, plan: parsed.data };
  });
