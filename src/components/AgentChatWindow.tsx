import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useServerFn } from "@tanstack/react-start";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import type { HealthReport } from "@/lib/data-health";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { ensureGuestSession, metered, notifyQuota } from "@/lib/ai-action";
import { planAiQuery } from "@/lib/ai-query.functions";
import { parseQuotaError } from "@/lib/quota";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PrivateChatToggle } from "@/components/PrivateChatToggle";
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
  execQuickAnalysis,
  execReportOutline,
  execRunSql,
  type ToolOutput,
} from "@/lib/agent-chat-tools";
import { cleanApprovalMessage, type DatasetContext } from "@/lib/agent-chat";
import { friendlyError } from "@/lib/friendly-error";
import { EChartsView } from "@/components/EChartsView";
import { buildInlineAnalysisChart, type InlineChartSpec } from "@/lib/inline-analysis-chart";
import { inspectAssistantTurn, getToolResultFallback, type AssistantTurnMessage, type AssistantTurnPart } from "@/lib/agent-chat-response";

const TOOL_META: Record<string, { label: string; icon: typeof Database }> = {
  "tool-quick_analysis": { label: "تحليل سريع مع دليل", icon: SearchCheck },
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
  const runningTool = [...parts]
    .reverse()
    .find((p) => isToolPart(p) && p.state !== "output-available");
  if (runningTool) {
    const meta = TOOL_META[runningTool.type];
    return meta ? `تنفيذ التحليل — ${meta.label}…` : "تنفيذ التحليل…";
  }
  const hasCompletedTool = parts.some((p) => isToolPart(p) && p.state === "output-available");
  if (hasCompletedTool) return "التحقق من النتائج والأدلة…";
  const hasText = parts.some((p) => p.type === "text");
  if (hasText) return "صياغة الخلاصة…";
  return "اختيار طريقة التحليل…";
}

export function AgentChatWindow({
  threadId,
  projectId,
  health,
  initialMessages,
  onFirstMessage,
  initialQuestion,
}: {
  threadId: string;
  projectId: string | null;
  health: HealthReport | null;
  initialMessages: UIMessage[];
  onFirstMessage?: (text: string) => void;
  initialQuestion?: string | undefined;
}) {
  const [input, setInput] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const requestPendingRef = useRef(false);
  const [dataset, setDataset] = useState<DatasetContext | null>(null);
  const planQuickQuery = useServerFn(planAiQuery);
  const quickPlanner = useMemo(() => metered(planQuickQuery), [planQuickQuery]);
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

  // معرّف دور المستخدم الحالي: طلبات الأدوات المتتالية داخل الدور تُحسب مرة واحدة
  const turnIdRef = useRef<string>(crypto.randomUUID());
  const initialQuestionSentRef = useRef<string | null>(null);

  // خيار عدم حفظ المحادثة (يُتذكَّر في هذا المتصفح)
  const [saveChat, setSaveChat] = useState(true);
  const saveChatRef = useRef(true);
  useEffect(() => {
    try {
      const off = localStorage.getItem("basira:no-save-chat") === "1";
      setSaveChat(!off);
      saveChatRef.current = !off;
    } catch {
      /* تجاهل */
    }
  }, []);
  function changeSaveChat(v: boolean) {
    setSaveChat(v);
    saveChatRef.current = v;
    try {
      localStorage.setItem("basira:no-save-chat", v ? "0" : "1");
    } catch {
      /* تجاهل */
    }
  }

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        body: () => ({ threadId, projectId, dataset, actionId: turnIdRef.current, persist: saveChatRef.current }),
      }),
    [threadId, projectId, dataset],
  );

  const { messages, sendMessage, status, addToolResult } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (err) => {
      requestPendingRef.current = false;
      const msg = err.message || "";
      const quota = parseQuotaError(msg);
      if (quota) {
        setRequestError("وصلت إلى حد الاستخدام الحالي. يمكنك المحاولة لاحقاً.");
        notifyQuota(quota);
        return;
      }
      if (/unauthorized|401/i.test(msg)) {
        const message = "انتهت جلستك — سجّل الدخول من جديد لتشغيل المحلل.";
        setRequestError(message);
        toast.error(message);
        return;
      }
      if (/thread not found|404/i.test(msg)) {
        const message = "لم يتم العثور على المحادثة. ابدأ محادثة جديدة ثم أعد السؤال.";
        setRequestError(message);
        toast.error(message);
        return;
      }
      if (/429/.test(msg)) {
        const message = "تم تجاوز حد الطلبات مؤقتاً. حاول بعد قليل.";
        setRequestError(message);
        toast.error(message);
        return;
      }
      if (/402/.test(msg)) {
        const message = "نفدت أرصدة الذكاء الاصطناعي المتاحة حالياً.";
        setRequestError(message);
        toast.error(message);
        return;
      }
      const message = friendlyError(err, "تعذّر الاتصال بالمحلل. حاول مجدداً.");
      setRequestError(message);
      toast.error(message);
    },
    onToolCall: async ({ toolCall }) => {
      const input = toolCall.input as never;
      let output: ToolOutput;
      try {
        switch (toolCall.toolName) {
          case "quick_analysis":
            output = await execQuickAnalysis(input as { question: string }, quickPlanner, health);
            break;
          case "run_sql":
            output = await execRunSql(input);
            break;
          case "add_chart_widget":
            output = await execAddChart(input);
            break;
          case "clean_data": {
            const cleanInput = input as { operation: "dedupe" | "trim"; reason_ar: string };
            const approved = window.confirm(cleanApprovalMessage(cleanInput));
            output = approved
              ? await execClean(cleanInput)
              : { ok: false, message_ar: "ألغيت عملية التنظيف بناءً على اختيارك؛ لم يتم تعديل البيانات." };
            break;
          }
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
          message_ar: friendlyError(err, "فشل تنفيذ الأداة محلياً."),
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
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const retryQuestion = lastUserMessage?.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { text: string }).text)
    .join("\n")
    .trim();

  // لا تعتبر ready نهاية الدور إذا كان هناك tool-call بانتظار نتيجته؛
  // قد ينتقل useChat إلى ready بين استجابة النموذج وتنفيذ الأداة/إعادة الإرسال التلقائي.
  useEffect(() => {
    if (status !== "ready" || !requestPendingRef.current) return;
    const outcome = inspectAssistantTurn(messages as unknown as AssistantTurnMessage[]);
    if (outcome.kind === "pending-tool") return;

    requestPendingRef.current = false;
    if (outcome.kind === "empty") {
      setRequestError("انتهى الطلب دون نص إجابة أو نتيجة أداة. أعد المحاولة؛ وإذا تكرر ذلك فقد يكون هناك خلل في مزوّد AI أو مسار البث.");
    } else {
      // وجود نتيجة أداة مكتملة يعني أن لدينا مخرجاً قابلاً للعرض حتى إن لم يكتب النموذج خاتمة.
      setRequestError(null);
    }
  }, [status, messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  async function send(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    // الزائر يحصل على جلسة مجهولة تلقائياً (تجربة محدودة)، فإن تعذّر نطلب تسجيل الدخول
    if (!(await ensureGuestSession())) {
      notifyQuota({ code: "login_required" });
      return;
    }
    turnIdRef.current = crypto.randomUUID();
    setRequestError(null);
    requestPendingRef.current = true;
    if (messages.length === 0) onFirstMessage?.(value);
    setInput("");
    await sendMessage({ text: value });
  }

  // استقبال سؤال الصفحة الرئيسية داخل نفس المحادثة، دون تحويل المستخدم إلى واجهة ثانية.
  useEffect(() => {
    const value = initialQuestion?.trim();
    if (!value || busy || initialQuestionSentRef.current === value) return;
    initialQuestionSentRef.current = value;
    void send(value);
  }, [initialQuestion, busy, send]);

  return (
    <div className="flex h-full flex-col" dir="rtl">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="mx-auto max-w-2xl pt-6 sm:pt-12">
            {/* ===== MIZYAi Analyst — قلب التجربة ===== */}
            <div className="aura rise-in">
              <div className="mz-glass-card mz-glass-card--lavender clay rounded-3xl border border-primary/20 bg-card/60 p-6 sm:p-8">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  MIZYAi Analyst — اسأل، حلّل، واكتشف
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

                <div className="mt-4"><PrivateChatToggle saving={saveChat} onChange={changeSaveChat} /></div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send(input);
                  }}
                  className="mz-glass-inset mt-5 flex items-end gap-2 rounded-2xl border border-border/60 bg-background/60 p-2 focus-within:border-primary/50"
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
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {STARTERS.map(({ text, icon: Icon }) => (
                <button
                  key={text}
                  onClick={() => void send(text)}
                  className="mz-glass-inset card-lift flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/60 px-3.5 py-3 text-right text-sm hover:border-primary/50 hover:text-primary transition"
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
              <div
                key={m.id}
                className={m.role === "user" ? "flex justify-start" : "flex justify-end"}
              >
                <div
                  className={
                    m.role === "user"
                      ? "mz-glass-card mz-glass-card--teal max-w-[85%] rounded-2xl bg-primary/15 border border-primary/25 px-4 py-3 text-sm"
                      : "mz-glass-card mz-glass-card--lavender max-w-[92%] rounded-2xl bg-card/70 border border-border/60 px-4 py-3 text-sm clay"
                  }
                >
                  {/* الإجابة أولاً؛ استخدم رسالة الأداة كإجابة احتياطية إذا انتهى النموذج دون صياغة نصية. */}
                  {textParts.length === 0 && m.role === "assistant" && getToolResultFallback(m.parts as unknown as AssistantTurnPart[]) && (
                    <div className="prose prose-sm prose-invert max-w-none leading-7">
                      <ReactMarkdown disallowedElements={["img"]}>{getToolResultFallback(m.parts as unknown as AssistantTurnPart[]) ?? ""}</ReactMarkdown>
                    </div>
                  )}
                  {textParts.map((part, i) => (
                    <div key={i} className="prose prose-sm prose-invert max-w-none leading-7">
                      {/* منع الصور: رابط صورة يكتبه النموذج (بتأثير محتوى الملف) قد يسرّب بيانات عبر الطلب */}
                      <ReactMarkdown disallowedElements={["img"]}>{(part as { text: string }).text}</ReactMarkdown>
                    </div>
                  ))}

                  {/* Show a chart inline when the planner selected one and returned rows support it. */}
                  {toolParts.map((rawPart, i) => {
                    const part = rawPart as {
                      output?: {
                        rows?: Record<string, unknown>[];
                        extra?: { chart?: InlineChartSpec; title_ar?: string };
                      };
                    };
                    const chartOption = buildInlineAnalysisChart(part.output?.extra?.chart, part.output?.rows ?? []);
                    if (!chartOption) return null;
                    return (
                      <section key={i} className="mt-4 rounded-xl border border-primary/20 bg-background/45 p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
                          <BarChart3 className="h-4 w-4 text-primary" />
                          {part.output?.extra?.title_ar ?? "تمثيل بصري للنتيجة"}
                        </div>
                        <EChartsView option={chartOption as never} className="h-64 w-full" label={part.output?.extra?.title_ar ?? "رسم بياني لنتيجة التحليل"} />
                        <p className="mt-1 text-[11px] text-muted-foreground">استكشف القيم بتمرير المؤشر أو الضغط على عناصر الرسم.</p>
                      </section>
                    );
                  })}

                  {/* ثقة/شفافية: الأدلة والأدوات المستخدَمة قابلة للطي، مو مفروضة على القارئ */}
                  {toolParts.length > 0 && (
                    <details className="group mt-3 rounded-xl border border-border/50 bg-background/40">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-primary">
                        <span className="flex items-center gap-1.5">
                          <SearchCheck className="h-3.5 w-3.5" />
                          كيف وصل MIZYAi إلى هذه النتيجة؟ ({toolParts.length})
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
                              extra?: {
                                chart?: InlineChartSpec;
                                title_ar?: string;
                                evidence?: {
                                  filters?: string[];
                                  baseRowCount?: number | null;
                                  resultRowCount?: number;
                                  highlights?: { label: string; value: string }[];
                                  sourceColumns?: {
                                    name: string;
                                    type: string;
                                    nullCount: number;
                                    nullRatio: number;
                                    castFailureCount?: number;
                                    castCheckedCount?: number;
                                    castTarget?: string;
                                  }[];
                                };
                              };
                            };
                          };
                          const meta = TOOL_META[part.type];
                          if (!meta) return null;
                          const Icon = meta.icon;
                          return (
                            <div
                              key={i}
                              className="rounded-lg border border-border/50 bg-background/60 p-3 text-xs space-y-2"
                            >
                              <div className="flex items-center gap-2 text-primary">
                                <Icon className="h-3.5 w-3.5" />
                                <span className="font-medium">{meta.label}</span>
                                {part.state !== "output-available" && (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                )}
                              </div>
                              {part.output?.sql && (
                                <pre
                                  dir="ltr"
                                  className="overflow-x-auto rounded-lg bg-muted/40 p-2 font-mono text-[11px]"
                                >
                                  {part.output.sql}
                                </pre>
                              )}
                              {part.output?.message_ar && (
                                <p
                                  className={
                                    part.output.ok ? "text-muted-foreground" : "text-destructive"
                                  }
                                >
                                  {part.output.message_ar}
                                </p>
                              )}
                              {part.output?.extra?.evidence && (
                                <div className="space-y-1 rounded-lg border border-border/40 bg-muted/20 p-2 text-[11px] text-muted-foreground">
                                  <p>
                                    نطاق الدليل: {part.output.extra.evidence.baseRowCount == null
                                      ? "غير محدد بدقة"
                                      : `${part.output.extra.evidence.baseRowCount.toLocaleString("en-US")} صف من المصدر`}
                                    {" · "}النتيجة: {(part.output.extra.evidence.resultRowCount ?? 0).toLocaleString("en-US")} صف
                                  </p>
                                  {part.output.extra.evidence.highlights?.slice(0, 2).map((item) => (
                                    <p key={item.label}>{item.label}: <span className="font-mono text-foreground">{item.value}</span></p>
                                  ))}
                                  {part.output.extra.evidence.sourceColumns?.map((column) => (
                                    <p key={column.name}>
                                      <span dir="ltr" className="font-mono">{column.name}</span>: {column.nullCount.toLocaleString("en-US")} قيمة مفقودة
                                      {column.castFailureCount !== undefined && ` · ${column.castFailureCount.toLocaleString("en-US")} فشل تحويل ${column.castTarget ?? "التاريخ"}`}
                                    </p>
                                  ))}
                                </div>
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
                                      {part.output.rows
                                        .slice(0, 8)
                                        .map((row: Record<string, unknown>, ri: number) => (
                                          <tr
                                            key={ri}
                                            className="border-t border-border/45 transition-colors hover:bg-surface-2/60"
                                          >
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
              <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-2xl border border-primary/25 bg-card/70 px-4 py-3 text-sm text-muted-foreground clay">
                <BrainCircuit className="pulse-dot h-4 w-4 text-primary" />
                {liveStage ?? "المحلل يعالج طلبك…"}
              </div>
            </div>
          )}

          {requestError && (
            <div role="alert" className="mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <div className="flex items-start gap-2">
                <SearchCheck className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-semibold text-foreground">لم تكتمل الإجابة</p>
                  <p className="mt-1 text-muted-foreground">{requestError}</p>
                </div>
              </div>
              {retryQuestion && (
                <div>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void send(retryQuestion)}>
                    إعادة المحاولة
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {messages.length > 0 && (
        <div className="border-t border-border/70 bg-surface-1/95 p-3">
          <div className="mx-auto mb-2 max-w-3xl"><PrivateChatToggle saving={saveChat} onChange={changeSaveChat} /></div>
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
              placeholder="اسأل عن بياناتك أو اطلب تحليلاً أو رسماً أو تنظيفاً…"
              className="min-h-[46px] max-h-40 resize-none rounded-xl border-border/80 bg-surface-2/65 focus-visible:ring-primary/20"
            />
            <Button
              type="submit"
              size="icon"
              className="h-[46px] w-[46px] rounded-xl"
              disabled={busy || !input.trim()}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
