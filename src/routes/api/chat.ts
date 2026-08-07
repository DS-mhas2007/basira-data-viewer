/**
 * مسار البث للوكيل المحادثاتي.
 * النموذج يعمل على الخادم، والأدوات تُنفَّذ في متصفح المستخدم (بياناته لا تُرسل).
 */
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import {
  AddChartInput,
  CleanInput,
  PinInsightInput,
  ReportOutlineInput,
  RunSqlInput,
  buildSystemPrompt,
  type DatasetContext,
} from "@/lib/agent-chat";

interface Body {
  messages?: UIMessage[];
  threadId?: string;
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

        const body = (await request.json()) as Body;
        const messages = body.messages;
        if (!Array.isArray(messages)) return new Response("Messages are required", { status: 400 });

        const threadId = body.threadId;
        if (!threadId) return new Response("threadId is required", { status: 400 });
        const { data: thread } = await supabase
          .from("chat_threads")
          .select("id")
          .eq("id", threadId)
          .maybeSingle();
        if (!thread) return new Response("Thread not found", { status: 404 });

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);

        const result = streamText({
          model: gateway("google/gemini-3.6-flash"),
          system: buildSystemPrompt(body.dataset ?? null),
          messages: await convertToModelMessages(messages),
          stopWhen: stepCountIs(50),
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
            if (last && last.role === "user") {
              rows.push({
                thread_id: threadId,
                user_id: userId,
                role: "user",
                parts: last.parts,
              });
            }
            rows.push({
              thread_id: threadId,
              user_id: userId,
              role: "assistant",
              parts: responseMessage.parts,
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
