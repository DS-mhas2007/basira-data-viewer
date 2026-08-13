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
import {
  ArrowUp,
  Loader2,
  Sparkles,
  Database,
  BarChart3,
  Wand2,
  Pin,
  FileText,
  ChevronDown,
  BrainCircuit,
  SearchCheck,
} from "lucide-react";
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

// أسئلة مقترحة مبنية على القدرات الحقيقية للأدوات (SQL محلي، رسم، تنظيف)
// — لا نقترح قدرات غير موجودة فعلياً (مثل التنبؤ) حتى لا نخلق توقعات غير صحيحة.
const STARTERS = [
  { text: "أعطني ملخصاً سريعاً عن هذا الملف", icon: Sparkles },
  { text: "ما أكثر 5 قيم تكراراً في البيانات؟", icon: Database },
  { text: "هل توجد صفوف مكرّرة؟ نظّفها إن وُجدت", icon: Wand2 },
  { text: "أضف رسماً بيانياً يوضح أهم اتجاه", icon: BarChart3 },
];

type ToolPart = { type: string; state?: string; output?: ToolOutput; input?: unknown };

function isToolPart(part: { type: string }): part is ToolPart {
  return part.type in TOOL_META;
}

/** يحدد تسمية "مرحلة التحليل" الحالية بالاعتماد على الحالة الفعلية للبث — بدون أي مراحل وهمية. */
function useLiveStage(status: string, lastMessage: UIMessage | undefined) {
  if (status === "submitted") return "فهم السؤال…";
  if (status !== "streaming" || !lastMessage || lastMessage.role !== "assistant") return null;

  const parts = lastMessage.parts as ToolPart[];
  const runningTool = [...parts].reverse().find((p) => isToolPart(p) && p.state !== "output-available");
  if (runningTool) {
    const meta = TOOL_META[runningTool.type];
    return meta ? `تنفيذ التحليل — ${meta.label}…` : "تنفيذ التحليل…";
  }
  const hasText = parts.some((p) => p.type === "text");
  if (hasText) return "صياغة الرؤية…";
  return "بناء خطة التحليل…";
}

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

  // تحميل البيانات وتحديثها بشكل فوري عند رفع ملف
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    let attempts = 0;

    const stopPoll = () => {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
      attempts = 0;
    };

    const loadDataset = async () => {
      try {
        const d = await currentDataset();
        if (active) setDataset(d);
        return d;
      } catch {
        if (active) setDataset(null);
        return null;
      }
    };

    const startPoll = () => {
      if (timer) return;
      timer = setInterval(async () => {
        attempts += 1;
        const d = await loadDataset();
        if (d || attempts >= 20) stopPoll();
      }, 700);
    };

    const refresh = async () => {
      const d = await loadDataset();
      if (d) stopPoll();
      else startPoll();
    };

    void refresh();

    // ✅ عند رفع ملف جديد (الحدث المرسل من FileDropzone)
    const onDatasetChanged = () => void refresh();
    // ✅ عند العودة للنافذة (مفيد إذا كان المستخدم بعيداً ثم رجع)
    const onFocus = () => void refresh();

    window.addEventListener("basira:dataset-changed", onDatasetChanged);
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      stopPoll();
      window.removeEventListener("basira:dataset-changed", onDatasetChanged);
      window.removeEventListener("focus", onFocus);
    };
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
    onError: (err) => {
      const msg = err.message || "";
      if (/unauthorized|401/i.test(msg)) {
        toast.error("انتهت جلستك — سجّل الدخول من جديد لتشغيل الوكيل الذكي.");
        return;
      }
      if (/thread not found|404/i.test(msg)) {
        toast.error("لم يتم العثور على المحادثة — ابدأ محادثة جديدة.");
        return;
      }
      if (/429/.test(msg)) {
        toast.error("تم تجاوز حد الطلبات — حاول بعد قليل.");
        return;
      }
      if (/402/.test(msg)) {
        toast.error("نفدت أرصدة الذكاء الاصطناعي — أضف رصيداً للمتابعة.");
        return;
      }
      toast.error(msg || "تعذّر الاتصال بالوكيل");
    },
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
  const liveStage = useLiveStage(status, messages[messages.length - 1]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  async function send(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      toast.error("سجّل الدخول أولاً لاستخدام الوكيل الذكي.");
      return;
    }
    if (messages.length === 0) onFirstMessage?.(value);
    setInput("");
    await sendMessage({ text: value });
  }

  return (
    <div className="flex h-full flex-col" dir="rtl">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="mx-auto max-w-2xl pt-6 sm:pt-12">
            {/* ===== Ask Basira — قلب المنتج ===== */}
            <div className="aura rise-in">
              <div className="clay rounded-3xl border border-primary/20 bg-card/60 p-6 sm:p-8">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  اسأل بصيرة — بياناتك تبقى في متصفحك
                </div>
                <h2 className="text-xl font-bold sm:text-2xl">
                  ماذا تريد أن تعرف عن <span className="text-gradient">بياناتك؟</span>
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {dataset ? (
                    <span className="glass-pill inline-flex">
                      <Database className="h-3.5 w-3.5 text-primary" />
                      {dataset.rowCount.toLocaleString("ar")} صف · {dataset.schema.length} عمود
                    </span>
                  ) : (
                    "لم يتم تحميل ملف بعد — ارفع ملفاً من مساحة العمل ليتمكّن الوكيل من تحليله."
                  )}
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send(input);
                  }}
                  className="mt-5 flex items-end gap-2 rounded-2xl border border-border/60 bg-background/60 p-2 clay-press focus-within:border-primary/50"
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
                    rows={2}
                    placeholder='مثال: "لماذا انخفضت المبيعات هذا الشهر؟"'
                    className="min-h-[52px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="glow-cta h-11 w-11 shrink-0 rounded-xl"
                    disabled={busy || !input.trim()}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </Button>
                </form>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {STARTERS.map(({ text, icon: Icon }) => (
                <button
                  key={text}
                  onClick={() => void send(text)}
                  className="card-lift flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/60 px-3.5 py-3 text-right text-sm hover:border-primary/50 hover:text-primary transition"
                >
                  <Icon className="h-4 w-4 shrink-0 text-primary/80" />
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-5">
          {messages.map((m) => {
            const textParts = m.parts.filter((p) => p.type === "text");
            const toolParts = m.parts.filter(isToolPart);

            return (
              <div key={m.id} className={m.role === "user" ? "flex justify-start" : "flex justify-end"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl bg-primary/15 border border-primary/25 px-4 py-3 text-sm"
                      : "max-w-[92%] rounded-2xl bg-card/70 border border-border/60 px-4 py-3 text-sm clay"
                  }
                >
                  {/* الإجابة أولاً */}
                  {textParts.map((part, i) => (
                    <div key={i} className="prose prose-sm prose-invert max-w-none leading-7">
                      <ReactMarkdown>{(part as { text: string }).text}</ReactMarkdown>
                    </div>
                  ))}

                  {/* ثقة/شفافية: الأدلة والأدوات المستخدَمة قابلة للطي، مو مفروضة على القارئ */}
                  {toolParts.length > 0 && (
                    <details className="group mt-3 rounded-xl border border-border/50 bg-background/40">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-primary">
                        <span className="flex items-center gap-1.5">
                          <SearchCheck className="h-3.5 w-3.5" />
                          كيف وصلت بصيرة إلى هذه النتيجة؟ ({toolParts.length})
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
                      </summary>
                      <div className="space-y-2 px-3 pb-3 pt-1">
                        {toolParts.map((rawPart, i) => {
                          const part = rawPart as {
                            type: string;
                            state?: string;
                            output?: {
                              sql?: string;
                              message_ar?: string;
                              ok?: boolean;
                              rows?: Record<string, unknown>[];
                              columns?: string[];
                            };
                          };
                          const meta = TOOL_META[part.type];
                          if (!meta) return null;
                          const Icon = meta.icon;
                          return (
                            <div key={i} className="rounded-lg border border-border/50 bg-background/60 p-3 text-xs space-y-2">
                              <div className="flex items-center gap-2 text-primary">
                                <Icon className="h-3.5 w-3.5" />
                                <span className="font-medium">{meta.label}</span>
                                {part.state !== "output-available" && <Loader2 className="h-3 w-3 animate-spin" />}
                              </div>
                              {part.output?.sql && (
                                <pre dir="ltr" className="overflow-x-auto rounded-lg bg-muted/40 p-2 font-mono text-[11px]">
                                  {part.output.sql}
                                </pre>
                              )}
                              {part.output?.message_ar && (
                                <p className={part.output.ok ? "text-muted-foreground" : "text-destructive"}>
                                  {part.output.message_ar}
                                </p>
                              )}
                              {part.output?.rows && part.output.rows.length > 0 && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-[11px]">
                                    <thead className="text-muted-foreground">
                                      <tr>
                                        {(part.output.columns ?? []).map((c: string) => (
                                          <th key={c} className="px-2 py-1 text-right font-medium">
                                            {c}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {part.output.rows.slice(0, 8).map((row: Record<string, unknown>, ri: number) => (
                                        <tr key={ri} className="clay-row border-t border-border/40">
                                          {(part.output?.columns ?? []).map((c: string) => (
                                            <td key={c} className="px-2 py-1">
                                              {String(row[c] ?? "")}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="flex justify-end">
              <div className="flex items-center gap-2 rounded-2xl border border-primary/25 bg-card/70 px-4 py-3 text-sm text-muted-foreground clay">
                <BrainCircuit className="pulse-dot h-4 w-4 text-primary" />
                {liveStage ?? "الوكيل يعمل…"}
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {messages.length > 0 && (
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
              className="clay-press min-h-[46px] max-h-40 resize-none rounded-2xl"
            />
            <Button
              type="submit"
              size="icon"
              className="glow-cta h-[46px] w-[46px] rounded-2xl"
              disabled={busy || !input.trim()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
