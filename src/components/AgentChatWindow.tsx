import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowUp, Loader2, Sparkles, Database, BarChart3, Wand2, Pin, FileText } from "lucide-react";
import {
  currentDataset,
  execAddChart,
  execClean,
  execPinInsight,
  execReportOutline,
  execRunSql,
  type ToolOutput,
} from "@/lib/agent-chat-tools";
import type { DatasetContext } from "@/lib/agent-chat";

const TOOL_META: Record<string, { label: string; icon: typeof Database }> = {
  "tool-run_sql": { label: "تنفيذ استعلام محلي", icon: Database },
  "tool-add_chart_widget": { label: "إضافة رسم للوحة", icon: BarChart3 },
  "tool-clean_data": { label: "تنظيف البيانات", icon: Wand2 },
  "tool-pin_insight": { label: "تثبيت استنتاج", icon: Pin },
  "tool-report_outline": { label: "هيكلية التقرير", icon: FileText },
};

const STARTERS = [
  "أعطني ملخصاً سريعاً عن هذا الملف",
  "ما أهم 5 قيم في البيانات؟",
  "هل توجد صفوف مكرّرة؟ نظّفها إن وُجدت",
  "أضف رسماً بيانياً يوضح أهم اتجاه",
];

export function AgentChatWindow({
  threadId,
  initialMessages,
  onFirstMessage,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  onFirstMessage?: (text: string) => void;
}) {
  const [input, setInput] = useState("");
  const [dataset, setDataset] = useState<DatasetContext | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void currentDataset().then(setDataset);
  }, [threadId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        body: () => ({ threadId, dataset }),
      }),
    [threadId, dataset],
  );

  const { messages, sendMessage, status, addToolResult } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (err) => toast.error(err.message || "تعذّر الاتصال بالوكيل"),
    onToolCall: async ({ toolCall }) => {
      const input = toolCall.input as never;
      let output: ToolOutput;
      try {
        switch (toolCall.toolName) {
          case "run_sql":
            output = await execRunSql(input);
            break;
          case "add_chart_widget":
            output = await execAddChart(input);
            break;
          case "clean_data":
            output = await execClean(input);
            break;
          case "pin_insight":
            output = execPinInsight(input);
            break;
          case "report_outline":
            output = execReportOutline(input);
            break;
          default:
            output = { ok: false, message_ar: "أداة غير معروفة." };
        }
      } catch (err) {
        output = {
          ok: false,
          message_ar: err instanceof Error ? err.message : "فشل تنفيذ الأداة محلياً.",
        };
      }
      addToolResult({
        tool: toolCall.toolName as never,
        toolCallId: toolCall.toolCallId,
        output: output as never,
      });
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  async function send(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    if (messages.length === 0) onFirstMessage?.(value);
    setInput("");
    await sendMessage({ text: value });
  }

  return (
    <div className="flex h-full flex-col" dir="rtl">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl text-center space-y-5 pt-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
              <Sparkles className="h-3.5 w-3.5" /> الوكيل الذكي — بياناتك تبقى في متصفحك
            </div>
            <h2 className="text-lg font-bold">تحدّث مع بياناتك بلغة طبيعية</h2>
            <p className="text-sm text-muted-foreground">
              {dataset
                ? `الملف الحالي يحتوي ${dataset.rowCount} صفاً و${dataset.schema.length} عموداً.`
                : "لم يتم تحميل ملف بعد — ارفع ملفاً من مساحة العمل ليتمكّن الوكيل من تحليله."}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="rounded-xl border border-border/60 bg-card/60 px-3 py-2.5 text-right text-sm hover:border-primary/50 hover:text-primary transition clay-press"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-start" : "flex justify-end"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl bg-primary/15 border border-primary/25 px-4 py-3 text-sm"
                  : "max-w-[92%] rounded-2xl bg-card/70 border border-border/60 px-4 py-3 text-sm clay-shadow"
              }
            >
              {m.parts.map((part, i) => {
                if (part.type === "text") {
                  return (
                    <div key={i} className="prose prose-sm prose-invert max-w-none leading-7">
                      <ReactMarkdown>{part.text}</ReactMarkdown>
                    </div>
                  );
                }
                const meta = TOOL_META[part.type];
                if (meta) {
                  const p = part as unknown as { state: string; output?: ToolOutput; input?: unknown };
                  const Icon = meta.icon;
                  return (
                    <div key={i} className="my-2 rounded-xl border border-border/50 bg-background/50 p-3 text-xs space-y-2">
                      <div className="flex items-center gap-2 text-primary">
                        <Icon className="h-3.5 w-3.5" />
                        <span className="font-medium">{meta.label}</span>
                        {p.state !== "output-available" && <Loader2 className="h-3 w-3 animate-spin" />}
                      </div>
                      {p.output?.sql && (
                        <pre dir="ltr" className="overflow-x-auto rounded-lg bg-muted/40 p-2 font-mono text-[11px]">
                          {p.output.sql}
                        </pre>
                      )}
                      {p.output?.message_ar && (
                        <p className={p.output.ok ? "text-muted-foreground" : "text-destructive"}>
                          {p.output.message_ar}
                        </p>
                      )}
                      {p.output?.rows && p.output.rows.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px]">
                            <thead className="text-muted-foreground">
                              <tr>
                                {(p.output.columns ?? []).map((c) => (
                                  <th key={c} className="px-2 py-1 text-right font-medium">{c}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {p.output.rows.slice(0, 8).map((row, ri) => (
                                <tr key={ri} className="border-t border-border/40">
                                  {(p.output?.columns ?? []).map((c) => (
                                    <td key={c} className="px-2 py-1">{String(row[c] ?? "")}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {status === "submitted" && (
          <div className="flex justify-end">
            <div className="rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> الوكيل يفكّر…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border/60 bg-background/70 backdrop-blur p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="mx-auto flex max-w-3xl items-end gap-2"
        >
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder="اسأل الوكيل عن بياناتك…"
            className="min-h-[46px] max-h-40 resize-none rounded-2xl"
          />
          <Button type="submit" size="icon" className="h-[46px] w-[46px] rounded-2xl" disabled={busy || !input.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
