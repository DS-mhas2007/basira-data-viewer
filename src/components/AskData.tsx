import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, HelpCircle, Loader2, Send, Sparkles } from "lucide-react";
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

const CHART_COLORS = ["#60F5D2", "#D6B2FC", "#7FB2FF", "#F5C978"];

interface Props {
  tableInfo: TableInfo;
  sample: Row[];
}

export function AskData({ tableInfo, sample }: Props) {
  const askAi = useServerFn(planAiQuery);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarify, setClarify] = useState<string | null>(null);
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);

  const reset = () => {
    setError(null);
    setClarify(null);
    setPlan(null);
    setRows(null);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    reset();
    setLoading(true);
    try {
      const res = await askAi({
        data: {
          question: q,
          table: tableInfo.table,
          schema: tableInfo.schema.map((c) => ({ name: c.name, type: c.type })),
          sample: sample.slice(0, 8),
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

      const { result, rows: data } = await runValidatedQuery(p.sql, schemaFromTableInfo(tableInfo));
      if (!result.isValid || !data) {
        setError("عذراً، لا يمكن تنفيذ هذا السؤال بأمان على بياناتك. جرّب صياغة أخرى أوضح.");
        return;
      }
      setPlan(p);
      setRows(data);
    } catch {
      setError("حدث خطأ غير متوقع أثناء تحليل سؤالك. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  const columns = rows && rows.length > 0 ? Object.keys(rows[0]!) : [];

  return (
    <section className="clay space-y-5 rounded-2xl border border-border/70 bg-card px-5 py-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Sparkles className="size-4" strokeWidth={2} />
        </span>
        <h2 className="font-display text-lg font-bold">اسأل عن بياناتك</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="مثال: ما أعلى ٥ مدن من حيث إجمالي المبيعات؟"
          maxLength={500}
          className="clay-inset h-11 flex-1 rounded-xl border border-border/70 bg-background/60 px-4 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/25"
        />
        <Button type="submit" disabled={loading || !question.trim()} className="h-11 gap-2 px-5">
          {loading ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          ) : (
            <Send className="size-4" strokeWidth={2} />
          )}
          إرسال
        </Button>
      </form>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          جاري تحليل سؤالك...
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

      {plan && rows && !loading && (
        <div className="space-y-4">
          <h3 className="font-display text-base font-bold">{plan.title_ar}</h3>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد نتائج مطابقة لهذا السؤال.</p>
          ) : (
            <>
              <ChartView plan={plan} rows={rows} />
              <div className="clay-inset max-h-80 overflow-auto rounded-xl border border-border/70">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card/95 backdrop-blur">
                    <tr>
                      {columns.map((c) => (
                        <th
                          key={c}
                          dir="ltr"
                          className="px-3 py-2 text-right font-mono text-xs font-semibold text-muted-foreground"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-border/50">
                        {columns.map((c) => (
                          <td key={c} dir="auto" className="px-3 py-2 font-mono text-xs">
                            {r[c] === null ? "—" : String(r[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {plan.warnings.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {plan.warnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          )}
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
            <YAxis dataKey={metrics[0]} tick={axis} />
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
