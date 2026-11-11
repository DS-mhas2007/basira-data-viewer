/**
 * مسار البث للوكيل المحادثاتي.
 * النموذج يعمل على الخادم، والأدوات تُنفَّذ في متصفح المستخدم (بياناته لا تُرسل).
 */
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { consumeQuota } from "@/lib/quota.server";
import { quotaMessage } from "@/lib/quota";
import {
  AddChartInput,
  CleanInput,
  PinInsightInput,
  ReportOutlineInput,
  RunSqlInput,
  buildSystemPrompt,
  type DatasetContext,
} from "@/lib/agent-chat";

/** حدود الطلب: تمنع إرسال حمولة ضخمة تُحقن في الـ prompt أو تُخزَّن في قاعدة البيانات. */
const MAX_BODY_CHARS = 1_000_000;
const MAX_MESSAGES = 200;
const MAX_STORED_PARTS_CHARS = 500_000;
const MAX_AGENT_STEPS = 12;

const DatasetZ = z
  .object({
    table: z.string().max(100),
    rowCount: z.number().finite(),
    schema: z.array(z.object({ name: z.string().max(200), type: z.string().max(500) })).max(300),
    fileName: z.string().max(300).nullable(),
  })
  .nullable();

interface Body {
  messages?: UIMessage[];
  threadId?: string;
  /** معرّف دور المستخدم: طلبات الأدوات المتتالية لنفس الدور تُحسب مرة واحدة. */
  actionId?: string;
  dataset?: DatasetContext | null;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          },
        );
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const raw = await request.text();
        if (raw.length > MAX_BODY_CHARS) return new Response("Payload too large", { status: 413 });
        let body: Body;
        try {
          body = JSON.parse(raw) as Body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const messages = body.messages;
        if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
          return new Response("Messages are required", { status: 400 });
        }
        const dataset = DatasetZ.safeParse(body.dataset ?? null);
        if (!dataset.success) return new Response("Invalid dataset", { status: 400 });

        const threadId = body.threadId;
        if (!threadId) return new Response("threadId is required", { status: 400 });
        const { data: thread } = await supabase
          .from("chat_threads")
          .select("id")
          .eq("id", threadId)
          .maybeSingle();
        if (!thread) return new Response("Thread not found", { status: 404 });

        const actionId = z.string().uuid().safeParse(body.actionId);
        const quota = await consumeQuota(supabase, actionId.success ? actionId.data : undefined, "chat");
        if (!quota.allowed) {
          const code = quota.reason === "action_limit" ? "action_limit" : "quota_exceeded";
          return new Response(JSON.stringify({ error: quotaMessage(code, quota), code, quota }), {
            status: 429,
            headers: { "content-type": "application/json" },
          });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);

        const result = streamText({
          model: gateway("google/gemini-3.6-flash"),
          system: buildSystemPrompt(dataset.data),
          messages: await convertToModelMessages(messages),
          stopWhen: stepCountIs(MAX_AGENT_STEPS),
          // أوقف استدعاء النموذج عند قطع الاتصال بدل الاستمرار في صرف الـ tokens
          abortSignal: request.signal,
          tools: {
            run_sql: tool({
              description: "ينفّذ استعلام SELECT على بيانات المستخدم محلياً ويعيد الصفوف الناتجة.",
              inputSchema: RunSqlInput,
            }),
            add_chart_widget: tool({
              description: "يضيف رسماً بيانياً جديداً إلى لوحة قيادة المستخدم.",
              inputSchema: AddChartInput,
            }),
            clean_data: tool({
              description: "ينفّذ عملية تنظيف غير تدميرية على البيانات (إزالة تكرار أو تشذيب مسافات).",
              inputSchema: CleanInput,
            }),
            pin_insight: tool({
              description: "يثبّت استنتاجاً نصياً في تقرير المستخدم.",
              inputSchema: PinInsightInput,
            }),
            report_outline: tool({
              description: "يقترح هيكلية تقرير حسب الجمهور المطلوب ويحفظها للمستخدم.",
              inputSchema: ReportOutlineInput,
            }),
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
            const last = messages[messages.length - 1];
            const rows: {
              thread_id: string;
              user_id: string;
              role: string;
              parts: unknown;
            }[] = [];
            const capParts = (parts: unknown) =>
              JSON.stringify(parts ?? []).length > MAX_STORED_PARTS_CHARS
                ? [{ type: "text", text: "(محتوى كبير لم يُحفظ)" }]
                : parts;
            if (last && last.role === "user") {
              rows.push({
                thread_id: threadId,
                user_id: userId,
                role: "user",
                parts: capParts(last.parts),
              });
            }
            rows.push({
              thread_id: threadId,
              user_id: userId,
              role: "assistant",
              parts: capParts(responseMessage.parts),
            });
            const { error } = await supabase.from("chat_messages").insert(rows);
            if (error) console.error("فشل حفظ الرسائل:", error.message);
            const { error: upErr } = await supabase
              .from("chat_threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", threadId);
            if (upErr) console.error("فشل تحديث المحادثة:", upErr.message);
          },
        });
      },
    },
  },
});
