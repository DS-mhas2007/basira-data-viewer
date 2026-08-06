import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ChevronDown,
  HelpCircle,
  Lightbulb,
  Loader2,
  Pin,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { planAiQuery, type AiPlan } from "@/lib/ai-query.functions";
import { duckdb, type TableInfo } from "@/lib/duckdb-service";
import { runValidatedQuery, schemaFromTableInfo } from "@/lib/sql-validator";
import type { Row } from "@/lib/parse-file";
import type { HealthReport } from "@/lib/data-health";
import { EvidenceCard, type EvidenceData } from "@/components/EvidenceCard";
import { buildWarnings, countBaseRows, extractFilters, pickHighlights } from "@/lib/evidence";
import type { PinnedInsight } from "@/lib/report";
import { buildSuggestionGroups } from "@/lib/question-suggestions";

const CHART_COLORS = ["#60F5D2", "#D6B2FC", "#7FB2FF", "#F5C978"];

interface Props {
  tableInfo: TableInfo;
  sample: Row[];
  health?: HealthReport | null;
  pinned: PinnedInsight[];
  onPinnedChange: (next: PinnedInsight[]) => void;
  /** داخل اللوحة الجانبية: بدون إطار بطاقة ولا عنوان مكرر. */
  bare?: boolean;
}

interface Turn {
  id: string;
  question: string;
  plan: AiPlan;
  rows: Row[];
  evidence: EvidenceData;
  autoFixed: boolean;
}

export function AskData({
  tableInfo,
  sample,
  health = null,
  pinned,
  onPinnedChange,
  bare = false,
}: Props) {
  const askAi = useServerFn(planAiQuery);
  const [question, setQuestion] = useState("");
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarify, setClarify] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [retrying, setRetrying] = useState(false);
  const pinnedList = pinned;
  const groups = useMemo(() => buildSuggestionGroups(tableInfo), [tableInfo]);
  const [activeGroup, setActiveGroup] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const current = groups[activeGroup] ?? groups[0];
  const visible = current
    ? showAll
      ? current.questions
      : current.questions.slice(0, 6)
    : [];

  const reset = () => {
    setError(null);
    setClarify(null);
    setRetrying(false);
  };

  async function runQuestion(raw: string) {
    const q = raw.trim();
    if (!q || loading) return;
    setQuestion(q);
    reset();
    setLoading(true);
    const registry = schemaFromTableInfo(tableInfo);
    let retry: { sql: string; error: string } | null = null;
    let lastError = "تعذّر تنفيذ الاستعلام.";
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) setRetrying(true);
        const res = await askAi({
          data: {
            question: q,
            table: tableInfo.table,
            schema: tableInfo.schema.map((c) => ({ name: c.name, type: c.type })),
            sample: sample.slice(0, 8),
            retry,
          },
        });

        if (!res.ok) {
          setError(res.error);
          return;
        }

        const p = res.plan;
        if (p.needs_clarification) {
          setClarify(p.clarification_question ?? "هل يمكنك توضيح سؤالك أكثر؟");
          return;
        }

        let data: Row[] | undefined;
        let reason: string | undefined;
        let executedSql = p.sql;
        try {
          const out = await runValidatedQuery(p.sql, registry);
          data = out.rows;
          reason = out.result.rejectionReason;
          executedSql = out.result.sanitizedQuery ?? p.sql;
          if (!out.result.isValid) data = undefined;
        } catch (e) {
          reason = e instanceof Error ? e.message : "فشل تنفيذ الاستعلام في المحرك.";
        }

        if (!data) {
          lastError = reason ?? lastError;
          retry = { sql: p.sql.slice(0, 4000), error: lastError.slice(0, 600) };
          continue;
        }

        const baseRowCount = await countBaseRows(executedSql, registry);
        const turn: Turn = {
          id: `${Date.now()}`,
          question: q,
          plan: p,
          rows: data,
          autoFixed: attempt > 0,
          evidence: {
            id: `${Date.now()}`,
            title: p.title_ar,
            sql: executedSql,
            filters: extractFilters(executedSql),
            baseRowCount,
            resultRowCount: data.length,
            highlights: pickHighlights(p, data),
            warnings: buildWarnings(p, health, data[0] ? Object.keys(data[0]) : []),
          },
        };
        setTurns((prev) => [...prev, turn]);
        setQuestion("");
        return;
      }
      setError(
        `تعذّر تنفيذ هذا السؤال بأمان حتى بعد محاولة تصحيح تلقائية. (${lastError}) جرّب صياغة أوضح.`,
      );
    } catch {
      setError("حدث خطأ غير متوقع أثناء تحليل سؤالك. حاول مرة أخرى.");
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }

  /** اقتراحات فورية مطابقة لما يكتبه المستخدم. */
  const query = question.trim();
  const matches =
    query.length === 0
      ? []
      : groups
          .flatMap((g) => g.questions)
          .filter((q) => q.includes(query) || q.replace(/[أإآ]/g, "ا").includes(query))
          .slice(0, 6);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void runQuestion(question);
  }

  return (
    <section
      className={
        bare
          ? "space-y-5"
          : "clay space-y-5 rounded-2xl border border-border/70 bg-card px-5 py-5"
      }
    >
      {!bare && (
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Sparkles className="size-4" strokeWidth={2} />
          </span>
          <h2 className="font-display text-lg font-bold">اسأل عن بياناتك</h2>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={bare ? "flex flex-col gap-3" : "flex flex-col gap-3 sm:flex-row"}
      >
        <div className="relative flex-1">
          <input
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setTyping(true);
            }}
            onFocus={() => setTyping(true)}
            onBlur={() => setTimeout(() => setTyping(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setTyping(false);
            }}
            placeholder="مثال: ما أعلى ٥ مدن من حيث إجمالي المبيعات؟"
            maxLength={500}
            autoComplete="off"
            className="clay-inset h-11 w-full rounded-xl border border-border/70 bg-background/60 px-4 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/25"
          />
          {/* اقتراحات فورية أثناء الكتابة */}
          {typing && matches.length > 0 && (
            <ul className="glass absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-auto rounded-xl p-1.5 shadow-xl">
              {matches.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setTyping(false);
                      setQuestion(q);
                      void runQuestion(q);
                    }}
                    className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-start text-xs leading-relaxed transition hover:bg-primary/10 hover:text-primary"
                  >
                    <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-accent" strokeWidth={2} />
                    <span>{q}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button type="submit" disabled={loading || !question.trim()} className="h-11 gap-2 px-5">
          {loading ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          ) : (
            <Send className="size-4" strokeWidth={2} />
          )}
          إرسال
        </Button>
      </form>

      {current && (
        <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Lightbulb className="size-4 text-accent" strokeWidth={2} />
            أسئلة مقترحة حسب بياناتك
          </div>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g, i) => (
              <button
                key={g.key}
                type="button"
                onClick={() => {
                  setActiveGroup(i);
                  setShowAll(false);
                }}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                  i === activeGroup
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:bg-muted/40"
                }`}
              >
                {g.label}
                <span className="ms-1 font-mono opacity-60">{g.questions.length}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {visible.map((q) => (
              <button
                key={q}
                type="button"
                disabled={loading}
                onClick={() => void runQuestion(q)}
                className="clay-press rounded-xl border border-border/70 bg-card/70 px-3 py-1.5 text-start text-xs leading-relaxed text-foreground/90 transition hover:border-primary/50 hover:text-primary disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
          {current.questions.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-medium text-accent transition hover:opacity-80"
            >
              <ChevronDown
                className={`size-3.5 transition-transform ${showAll ? "rotate-180" : ""}`}
                strokeWidth={2}
              />
              {showAll ? "عرض أقل" : `عرض كل الأسئلة (${current.questions.length})`}
            </button>
          )}
        </div>
      )}

      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          {retrying ? "الاستعلام الأول لم ينجح — جاري تصحيحه تلقائياً..." : "جاري تحليل سؤالك..."}
        </p>
      )}

      {error && !loading && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          <span>{error}</span>
        </div>
      )}

      {clarify && !loading && (
        <div className="space-y-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <p className="flex items-start gap-2 text-accent">
            <HelpCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            <span>{clarify}</span>
          </p>
          <p className="text-xs text-muted-foreground">أعد صياغة سؤالك بتفاصيل أوضح ثم أرسله مجدداً.</p>
        </div>
      )}

      {turns.length > 0 && (
        <div className="space-y-4 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              سجل المحادثة ({turns.length})
            </span>
            <button
              type="button"
              onClick={() => setTurns([])}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" strokeWidth={2} />
              مسح المحادثة
            </button>
          </div>

          {turns.map((t) => (
            <div key={t.id} className="space-y-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <User className="size-3.5" strokeWidth={2} />
                </span>
                <p className="text-sm font-semibold leading-relaxed text-foreground/90">
                  {t.question}
                </p>
              </div>

              {t.autoFixed && (
                <p className="flex items-center gap-1.5 text-[11px] text-accent">
                  <RotateCcw className="size-3.5" strokeWidth={2} />
                  تم تصحيح الاستعلام تلقائياً بعد محاولة فاشلة.
                </p>
              )}

              {t.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد نتائج مطابقة لهذا السؤال.</p>
              ) : (
                <EvidenceCard
                  evidence={t.evidence}
                  plan={t.plan}
                  rows={t.rows}
                  pinned={pinnedList.some((p) => p.evidence.id === t.evidence.id)}
                  onPin={() =>
                    onPinnedChange([
                      ...pinnedList,
                      { evidence: t.evidence, plan: t.plan, rows: t.rows },
                    ])
                  }
                  chart={<ChartView plan={t.plan} rows={t.rows} />}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {pinnedList.length > 0 && (
        <div className="space-y-3 border-t border-border/60 pt-5">
          <h3 className="flex items-center gap-2 font-display text-base font-bold">
            <Pin className="size-4 text-primary" strokeWidth={2} />
            الاستنتاجات المثبتة
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {pinnedList.map(({ evidence: p }) => (
              <div
                key={p.id}
                className="clay clay-lift relative rounded-xl border border-border/70 bg-card/70 px-4 py-3"
              >
                <button
                  type="button"
                  aria-label="إزالة الاستنتاج المثبت"
                  onClick={() => onPinnedChange(pinnedList.filter((x) => x.evidence.id !== p.id))}
                  className="absolute left-3 top-3 rounded-lg p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-4" strokeWidth={2} />
                </button>
                <p className="pe-6 ps-6 text-sm font-semibold leading-relaxed">{p.title}</p>
                {p.highlights[0] && (
                  <p className="mt-2 font-mono text-xl font-bold text-primary">
                    {p.highlights[0].value}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  الصفوف الداخلة في الحساب:{" "}
                  <span className="font-mono">
                    {p.baseRowCount === null ? "—" : p.baseRowCount.toLocaleString("en-US")}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ChartView({ plan, rows }: { plan: AiPlan; rows: Row[] }) {
  const keys = Object.keys(rows[0] ?? {});
  const x = plan.chart.x && keys.includes(plan.chart.x) ? plan.chart.x : keys[0]!;
  const ys = plan.chart.y.filter((k) => keys.includes(k) && k !== x);
  const metrics =
    ys.length > 0
      ? ys
      : keys.filter((k) => k !== x && rows.some((r) => typeof r[k] === "number")).slice(0, 2);

  if (plan.chart.type === "kpi") {
    const key = metrics[0] ?? keys[0]!;
    return (
      <div className="clay-inset rounded-xl border border-border/70 px-6 py-8 text-center">
        <p className="font-mono text-3xl font-bold text-primary">{String(rows[0]?.[key] ?? "—")}</p>
        <p dir="ltr" className="mt-2 font-mono text-xs text-muted-foreground">
          {key}
        </p>
      </div>
    );
  }

  if (plan.chart.type === "table" || metrics.length === 0) return null;

  const data = rows.slice(0, 60).map((r) => {
    const o: Record<string, unknown> = { [x]: String(r[x] ?? "") };
    for (const m of metrics) o[m] = typeof r[m] === "number" ? r[m] : Number(r[m] ?? 0);
    return o;
  });

  const axis = { stroke: "#7b8794", fontSize: 11, fontFamily: "Fira Code, monospace" } as const;
  const tooltip = (
    <Tooltip
      contentStyle={{
        background: "#0a1526",
        border: "1px solid rgba(96,245,210,0.25)",
        borderRadius: 12,
        fontFamily: "Fira Code, monospace",
        fontSize: 12,
      }}
    />
  );

  return (
    <div className="clay-inset h-72 rounded-xl border border-border/70 p-3">
      <ResponsiveContainer width="100%" height="100%">
        {plan.chart.type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey={x} tick={axis} />
            <YAxis tick={axis} />
            {tooltip}
            {metrics.map((m, i) => (
              <Line
                key={m}
                type="monotone"
                dataKey={m}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : plan.chart.type === "scatter" ? (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey={x} tick={axis} />
            <YAxis dataKey={metrics[0] ?? x} tick={axis} />
            {tooltip}
            <Scatter data={data} fill={CHART_COLORS[0]} />
          </ScatterChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey={x} tick={axis} />
            <YAxis tick={axis} />
            {tooltip}
            {metrics.map((m, i) => (
              <Bar key={m} dataKey={m} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[6, 6, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
