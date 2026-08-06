/**
 * محاكي "ماذا لو؟": شرائط نسبة مئوية تعيد حساب المؤشرات والرسوم والملخص فوراً محلياً.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RotateCcw, SlidersHorizontal, TrendingDown, TrendingUp } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import type { TableInfo } from "@/lib/duckdb-service";
import { formatNumber } from "@/lib/profile";
import {
  buildWhatIfBaseline,
  simulateWhatIf,
  type WhatIfBaseline,
} from "@/lib/what-if";

const AXIS = { fontSize: 10, fill: "var(--muted-foreground)" } as const;

function Skeleton() {
  return (
    <div className="clay space-y-3 rounded-2xl border border-border/70 bg-card px-4 py-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-10 animate-pulse rounded-xl bg-muted/40" />
      ))}
    </div>
  );
}

export function WhatIfPanel({
  tableInfo,
  sourceKey,
}: {
  tableInfo: TableInfo | null;
  sourceKey: string;
}) {
  const [baseline, setBaseline] = useState<WhatIfBaseline | null>(null);
  const [loading, setLoading] = useState(false);
  const [deltas, setDeltas] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!tableInfo) return;
    let cancelled = false;
    setLoading(true);
    setDeltas({});
    void buildWhatIfBaseline(tableInfo)
      .then((b) => {
        if (!cancelled) setBaseline(b);
      })
      .catch(() => {
        if (!cancelled) setBaseline(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tableInfo, sourceKey]);

  // الحساب فوري وخالص — لا استعلام عند تحريك الشريط.
  const result = useMemo(
    () => (baseline ? simulateWhatIf(baseline, deltas) : null),
    [baseline, deltas],
  );

  if (loading) return <Skeleton />;
  if (!tableInfo) return null;
  if (!baseline || !result)
    return (
      <div className="clay rounded-2xl border border-border/70 bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        لا توجد أعمدة رقمية كافية لبناء محاكاة في هذه البيانات.
      </div>
    );

  const dirty = Object.values(deltas).some((v) => Math.abs(v) >= 0.5);

  return (
    <div className="space-y-4">
      {/* الشرائط */}
      <div className="clay space-y-4 rounded-2xl border border-border/70 bg-card px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <SlidersHorizontal className="size-4" strokeWidth={2} />
          </span>
          <p className="flex-1 text-sm font-semibold">عوامل المحاكاة</p>
          <Button
            variant="ghost"
            size="sm"
            className="clay-press h-8 gap-1.5 text-xs"
            disabled={!dirty}
            onClick={() => setDeltas({})}
          >
            <RotateCcw className="size-3.5" strokeWidth={2} />
            إعادة الضبط
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {baseline.drivers.map((d) => {
            const v = deltas[d.column] ?? 0;
            return (
              <div key={d.column} className="clay-inset space-y-2 rounded-xl px-3 py-3">
                <div className="flex items-baseline gap-2">
                  <p dir="auto" className="min-w-0 flex-1 truncate text-xs font-medium">
                    {d.column}
                  </p>
                  <span
                    className={`font-mono text-xs font-semibold ${
                      v > 0 ? "text-primary" : v < 0 ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {v > 0 ? "+" : ""}
                    {v.toFixed(0)}%
                  </span>
                </div>
                <Slider
                  dir="rtl"
                  value={[v]}
                  min={-50}
                  max={50}
                  step={1}
                  onValueChange={([next]) =>
                    setDeltas((prev) => ({ ...prev, [d.column]: next ?? 0 }))
                  }
                />
                <p className="font-mono text-[10px] text-muted-foreground">
                  الأساس: {formatNumber(d.sum)} · المتوسط {formatNumber(d.avg)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* الملخص الفوري */}
      <p
        dir="auto"
        className="clay-inset rounded-xl px-4 py-3 text-sm leading-relaxed text-foreground/90"
      >
        {result.summary}
      </p>

      {/* المؤشرات */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {result.metrics.slice(0, 6).map((m) => {
          const up = m.deltaPct >= 0;
          return (
            <div
              key={m.label}
              className="clay clay-lift space-y-1 rounded-2xl border border-border/70 bg-card px-4 py-3"
            >
              <p dir="auto" className="truncate text-[11px] text-muted-foreground">
                {m.label}
              </p>
              <p className="font-mono text-xl font-bold tabular-nums">{formatNumber(m.next)}</p>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span
                  className={`flex items-center gap-1 font-mono font-semibold ${
                    Math.abs(m.deltaPct) < 0.05
                      ? "text-muted-foreground"
                      : up
                        ? "text-primary"
                        : "text-destructive"
                  }`}
                >
                  {up ? (
                    <TrendingUp className="size-3.5" strokeWidth={2} />
                  ) : (
                    <TrendingDown className="size-3.5" strokeWidth={2} />
                  )}
                  {up ? "+" : ""}
                  {m.deltaPct.toFixed(1)}%
                </span>
                <span className="truncate text-muted-foreground">
                  من {formatNumber(m.base)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* الرسم المقارن */}
      {result.chart.length > 1 && baseline.breakdown && (
        <div className="clay space-y-3 rounded-2xl border border-border/70 bg-card px-4 py-4">
          <p dir="auto" className="text-sm font-semibold">
            الأثر حسب «{baseline.breakdown.column}»
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              {result.temporal ? (
                <LineChart data={result.chart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    name="الحالي"
                    type="monotone"
                    dataKey="base"
                    stroke="var(--muted-foreground)"
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    name="المحاكاة"
                    type="monotone"
                    dataKey="next"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              ) : (
                <BarChart data={result.chart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar name="الحالي" dataKey="base" fill="var(--muted-foreground)" radius={[6, 6, 0, 0]} />
                  <Bar name="المحاكاة" dataKey="next" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
