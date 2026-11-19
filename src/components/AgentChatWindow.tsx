import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useServerFn } from "@tanstack/react-start";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import type { HealthReport } from "@/lib/data-health";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { supabase } from "@/integrations/supabase/client";
import { ensureGuestSession, metered, notifyQuota } from "@/lib/ai-action";
import { planAiQuery } from "@/lib/ai-query.functions";
import { parseQuotaError } from "@/lib/quota";
import { Button } from "@/components/ui/button";
import { ChatComposer } from "@/components/ChatComposer";
import { PrivateChatToggle } from "@/components/PrivateChatToggle";
import { toast } from "sonner";
import {
  ArrowDown,
  Copy,
  Check,
  RotateCcw,
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
  LayoutDashboard,
} from "@/components/icons";
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
import {
  inspectAssistantTurn,
  getToolResultFallback,
  splitAssistantFollowUp,
  type AssistantTurnMessage,
  type AssistantTurnPart,
} from "@/lib/agent-chat-response";

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
  onInitialQuestionSent,
  initialQuestion,
  onOpenDashboard,
}: {
  threadId: string;
  projectId: string | null;
  health: HealthReport | null;
  initialMessages: UIMessage[];
  onFirstMessage?: (text: string) => void;
  onInitialQuestionSent?: ((question: string) => void) | undefined;
  initialQuestion?: string | undefined;
  onOpenDashboard?: (() => void) | undefined;
}) {
  const [input, setInput] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const requestPendingRef = useRef(false);
  // Acquire synchronously before awaiting session setup to prevent duplicate concurrent sends.
  const sendLockRef = useRef(false);
  const retryRef = useRef(false);
  const [dataset, setDataset] = useState<DatasetContext | null>(null);
  const planQuickQuery = useServerFn(planAiQuery);
  const quickPlanner = useMemo(() => metered(planQuickQuery), [planQuickQuery]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
        body: () => ({
          threadId,
          projectId,
          dataset,
          actionId: turnIdRef.current,
          persist: saveChatRef.current,
          retry: retryRef.current,
        }),
      }),
    [threadId, projectId, dataset],
  );

  const { messages, sendMessage, regenerate, stop, status, addToolResult } = useChat({
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
              : {
                  ok: false,
                  message_ar: "ألغيت عملية التنظيف بناءً على اختيارك؛ لم يتم تعديل البيانات.",
                };
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
  const latestAssistantMessageId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;
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
      setRequestError(
        "انتهى الطلب دون نص إجابة أو نتيجة أداة. أعد المحاولة؛ وإذا تكرر ذلك فقد يكون هناك خلل في مزوّد AI أو مسار البث.",
      );
    } else {
      // وجود نتيجة أداة مكتملة يعني أن لدينا مخرجاً قابلاً للعرض حتى إن لم يكتب النموذج خاتمة.
      setRequestError(null);
    }
  }, [status, messages]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || !followingRef.current) return;
    scroll.scrollTop = scroll.scrollHeight;
  }, [messages, status]);

  useEffect(() => {
    if (!copiedId) return;
    const timer = setTimeout(() => setCopiedId(null), 2000);
    return () => clearTimeout(timer);
  }, [copiedId]);

  function scrollToLatest() {
    followingRef.current = true;
    setShowLatest(false);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({
      behavior: reducedMotion ? "instant" : "smooth",
      block: "end",
    });
  }

  function stopResponse() {
    requestPendingRef.current = false;
    setRequestError(null);
    void stop();
  }

  async function copyAnswer(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
    } catch {
      toast.error("تعذّر نسخ الإجابة.");
    }
  }

  // إعادة المحاولة تعيد تشغيل الدور نفسه، دون إضافة رسالة مستخدم مكررة (لا في الواجهة ولا في القاعدة)
  async function retryLastTurn() {
    if (busy || sendLockRef.current) return;
    sendLockRef.current = true;
    try {
      turnIdRef.current = crypto.randomUUID();
      setRequestError(null);
      requestPendingRef.current = true;
      retryRef.current = true;
      await regenerate();
    } catch (err) {
      requestPendingRef.current = false;
      setRequestError(friendlyError(err, "تعذّرت إعادة المحاولة."));
    } finally {
      retryRef.current = false;
      sendLockRef.current = false;
    }
  }

  async function send(text: string, isInitialQuestion = false): Promise<boolean> {
    const value = text.trim();
    if (!value || busy || sendLockRef.current) return false;

    // Lock before the first await: rapid clicks/submits must not enqueue duplicate turns.
    sendLockRef.current = true;
    try {
      // الزائر يحصل على جلسة مجهولة تلقائياً (تجربة محدودة)، فإن تعذّر نطلب تسجيل الدخول
      if (!(await ensureGuestSession())) {
        notifyQuota({ code: "login_required" });
        return false;
      }

      if (isInitialQuestion) onInitialQuestionSent?.(value);
      turnIdRef.current = crypto.randomUUID();
      setRequestError(null);
      requestPendingRef.current = true;
      if (messages.length === 0) onFirstMessage?.(value);
      followingRef.current = true;
      setShowLatest(false);
      setInput("");
      await sendMessage({ text: value });
      return true;
    } catch (err) {
      // onError normally handles transport failures; this covers unexpected send rejections.
      if (requestPendingRef.current) {
        requestPendingRef.current = false;
        setRequestError(friendlyError(err, "تعذّر إرسال السؤال. حاول مجدداً."));
      }
      return false;
    } finally {
      sendLockRef.current = false;
    }
  }

  // استقبال سؤال الصفحة الرئيسية داخل نفس المحادثة، دون تحويل المستخدم إلى واجهة ثانية.
  useEffect(() => {
    const value = initialQuestion?.trim();
    if (!value || busy || sendLockRef.current || initialQuestionSentRef.current === value) return;
    initialQuestionSentRef.current = value;
    void send(value, true).then((sent) => {
      // If session setup failed or the send was blocked, allow the effect to retry.
      if (!sent && initialQuestionSentRef.current === value) {
        initialQuestionSentRef.current = null;
      }
    });
  }, [initialQuestion, busy, send]);

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col" dir="rtl">
      <div
        ref={scrollRef}
        onScroll={(event) => {
          const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
          const nearBottom = scrollHeight - scrollTop - clientHeight < 80;
          followingRef.current = nearBottom;
          setShowLatest(!nearBottom);
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5 sm:px-5"
      >
        {messages.length === 0 && (
          <div className="mx-auto max-w-2xl py-6 sm:py-10">
            <div className="mb-6 text-center">
              <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Sparkles className="size-6" />
              </span>
              <h2 className="text-xl font-bold sm:text-2xl">ماذا تريد أن تعرف عن بياناتك؟</h2>
              <p className="mt-3 break-words text-sm text-muted-foreground">
                {dataset ? (
                  <span className="inline-flex flex-wrap items-center justify-center gap-2">
                    <Database className="size-3.5 text-primary" />
                    {dataset.rowCount.toLocaleString("ar")} صف · {dataset.schema.length} عمود
                  </span>
                ) : (
                  "لم يتم تحميل ملف بعد — ارفع ملفاً من مساحة العمل ليتمكّن الوكيل من تحليله."
                )}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {STARTERS.map(({ text, icon: Icon }) => (
                <Button
                  key={text}
                  variant="outline"
                  disabled={busy}
                  onClick={() => void send(text)}
                  className="mz-glass-inset h-auto min-h-14 justify-start whitespace-normal rounded-lg border-border/60 bg-card/60 px-3 py-3 text-start text-sm leading-6"
                >
                  <Icon className="size-4 shrink-0 text-primary/80" />
                  <span className="min-w-0 break-words">{text}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
          {messages.map((m) => {
            const textParts = m.parts.filter((p) => p.type === "text");
            const toolParts = m.parts.filter(isToolPart);
            const rawAnswerText = textParts
              .map((part) => part.text)
              .join("\n")
              .trim();
            const fallbackText =
              rawAnswerText.length === 0
                ? (getToolResultFallback(m.parts as unknown as AssistantTurnPart[]) ?? "")
                : "";
            const parsedAnswer =
              m.role === "assistant"
                ? splitAssistantFollowUp(rawAnswerText || fallbackText)
                : { text: rawAnswerText || fallbackText, followUp: null };
            const answerText = parsedAnswer.text || fallbackText;
            const followUp = parsedAnswer.followUp;

            return (
              <div
                key={m.id}
                className={
                  m.role === "user" ? "flex min-w-0 justify-start" : "flex min-w-0 justify-end"
                }
              >
                <div
                  className={
                    m.role === "user"
                      ? "mz-glass-card mz-glass-card--teal min-w-0 max-w-[88%] rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm"
                      : "min-w-0 w-full px-1 py-2 text-sm"
                  }
                >
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    {m.role === "assistant" && <Sparkles className="size-3.5 text-accent" />}
                    {m.role === "user" ? "أنت" : "MIZYAi"}
                  </div>
                  {/* الإجابة أولاً؛ استخدم رسالة الأداة كإجابة احتياطية إذا انتهى النموذج دون صياغة نصية. */}
                  {m.role === "assistant" && answerText ? (
                    <div className="prose prose-sm max-w-none break-words leading-7 text-foreground [&_p]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted/40 [&_pre]:p-3 [&_code]:break-all [&_a]:text-primary [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_strong]:text-foreground">
                      {/* منع الصور: رابط صورة يكتبه النموذج (بتأثير محتوى الملف) قد يسرّب بيانات عبر الطلب */}
                      <ChatMarkdown>{answerText}</ChatMarkdown>
                    </div>
                  ) : (
                    textParts.map((part, i) => (
                      <div
                        key={i}
                        className="prose prose-sm max-w-none break-words leading-7 text-foreground [&_p]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted/40 [&_pre]:p-3 [&_code]:break-all [&_a]:text-primary [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_strong]:text-foreground"
                      >
                        <ChatMarkdown>{(part as { text: string }).text}</ChatMarkdown>
                      </div>
                    ))
                  )}

                  {/* Show a chart inline when the planner selected one and returned rows support it. */}
                  {toolParts.map((rawPart, i) => {
                    const part = rawPart as {
                      output?: {
                        rows?: Record<string, unknown>[];
                        extra?: { chart?: InlineChartSpec; title_ar?: string };
                      };
                    };
                    const chartOption = buildInlineAnalysisChart(
                      part.output?.extra?.chart,
                      part.output?.rows ?? [],
                    );
                    if (!chartOption) return null;
                    return (
                      <section
                        key={i}
                        className="mt-4 rounded-xl border border-primary/20 bg-background/45 p-3"
                      >
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
                          <BarChart3 className="h-4 w-4 text-primary" />
                          {part.output?.extra?.title_ar ?? "تمثيل بصري للنتيجة"}
                        </div>
                        <EChartsView
                          option={chartOption as never}
                          className="h-64 w-full"
                          label={part.output?.extra?.title_ar ?? "رسم بياني لنتيجة التحليل"}
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          استكشف القيم بتمرير المؤشر أو الضغط على عناصر الرسم.
                        </p>
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
                              {part.type === "tool-add_chart_widget" &&
                                part.output?.ok &&
                                onOpenDashboard && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1.5 text-xs"
                                    onClick={onOpenDashboard}
                                  >
                                    <LayoutDashboard className="h-3.5 w-3.5" />
                                    فتح لوحة القيادة
                                  </Button>
                                )}
                              {part.output?.extra?.evidence && (
                                <div className="space-y-1 rounded-lg border border-border/40 bg-muted/20 p-2 text-[11px] text-muted-foreground">
                                  <p>
                                    نطاق الدليل:{" "}
                                    {part.output.extra.evidence.baseRowCount == null
                                      ? "غير محدد بدقة"
                                      : `${part.output.extra.evidence.baseRowCount.toLocaleString("en-US")} صف من المصدر`}
                                    {" · "}النتيجة:{" "}
                                    {(
                                      part.output.extra.evidence.resultRowCount ?? 0
                                    ).toLocaleString("en-US")}{" "}
                                    صف
                                  </p>
                                  {part.output.extra.evidence.highlights
                                    ?.slice(0, 2)
                                    .map((item) => (
                                      <p key={item.label}>
                                        {item.label}:{" "}
                                        <span className="font-mono text-foreground">
                                          {item.value}
                                        </span>
                                      </p>
                                    ))}
                                  {part.output.extra.evidence.sourceColumns?.map((column) => (
                                    <p key={column.name}>
                                      <span dir="ltr" className="font-mono">
                                        {column.name}
                                      </span>
                                      : {column.nullCount.toLocaleString("en-US")} قيمة مفقودة
                                      {column.castFailureCount !== undefined &&
                                        ` · ${column.castFailureCount.toLocaleString("en-US")} فشل تحويل ${column.castTarget ?? "التاريخ"}`}
                                    </p>
                                  ))}
                                </div>
                              )}
                              {part.output?.rows && part.output.rows.length > 0 && (
                                <div className="overflow-x-auto">
                                  <table className="w-full table-auto text-[11px]">
                                    <thead className="text-muted-foreground">
                                      <tr>
                                        {(part.output.columns ?? []).map((c: string) => (
                                          <th key={c} className="break-words px-2 py-1 text-right font-medium">
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
                                              <td key={c} className="break-words px-2 py-1">
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
                  {m.role === "assistant" &&
                    m.id === latestAssistantMessageId &&
                    followUp &&
                    answerText &&
                    !busy &&
                    !requestError && (
                      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-3">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                          <Sparkles className="size-3.5" /> سؤال متابعة مقترح
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void send(followUp)}
                          className="mt-2 h-auto min-h-10 w-full justify-start whitespace-normal rounded-lg px-3 py-2 text-start text-xs leading-6"
                        >
                          {followUp}
                        </Button>
                      </div>
                    )}
                  {m.role === "assistant" &&
                    answerText &&
                    !(busy && m.id === messages[messages.length - 1]?.id) && (
                      <div className="mt-3 flex items-center gap-1 border-t border-border/40 pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9 text-muted-foreground"
                          onClick={() => void copyAnswer(m.id, answerText)}
                          aria-label={copiedId === m.id ? "تم نسخ الإجابة" : "نسخ الإجابة"}
                          title={copiedId === m.id ? "تم النسخ" : "نسخ الإجابة"}
                        >
                          {copiedId === m.id ? <Check /> : <Copy />}
                        </Button>
                        {m.id === messages[messages.length - 1]?.id && !requestError && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-9 text-muted-foreground"
                            disabled={busy}
                            onClick={() => void retryLastTurn()}
                            aria-label="إعادة توليد الإجابة"
                            title="إعادة توليد الإجابة"
                          >
                            <RotateCcw />
                          </Button>
                        )}
                      </div>
                    )}
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="flex justify-start">
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 rounded-2xl border border-primary/25 bg-card/70 px-4 py-3 text-sm text-muted-foreground clay"
              >
                <BrainCircuit className="h-4 w-4 text-primary motion-safe:animate-pulse" />
                {liveStage ?? "المحلل يعالج طلبك…"}
              </div>
            </div>
          )}

          {requestError && (
            <div
              role="alert"
              className="mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              <div className="flex items-start gap-2">
                <SearchCheck className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-semibold text-foreground">لم تكتمل الإجابة</p>
                  <p className="mt-1 text-muted-foreground">{requestError}</p>
                </div>
              </div>
              {retryQuestion && (
                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void retryLastTurn()}
                  >
                    إعادة المحاولة
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border/60 bg-surface-1/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
        {showLatest && (
          <div className="mb-2 flex justify-center">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={scrollToLatest}
              className="rounded-lg"
            >
              <ArrowDown className="size-3.5" /> أحدث الرسائل
            </Button>
          </div>
        )}
        <div className="mx-auto w-full max-w-3xl">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={() => void send(input)}
            busy={busy}
            onStop={stopResponse}
          />
          <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
            <PrivateChatToggle saving={saveChat} onChange={changeSaveChat} />
            {dataset && (
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {dataset.rowCount.toLocaleString("ar")} صف
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
