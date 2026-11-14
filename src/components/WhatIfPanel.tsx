/**
 * محاكي "ماذا لو؟": شرائط نسبة مئوية تعيد حساب المؤشرات والرسوم والملخص فوراً محلياً.
 */
import { useEffect, useMemo, useState } from "react";

import { RotateCcw, SlidersHorizontal, TrendingDown, TrendingUp } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { EChartsView } from "@/components/EChartsView";
import { Button } from "@/components/ui/button";
import type { TableInfo } from "@/lib/duckdb-service";
import { formatNumber } from "@/lib/profile";
import {
  buildWhatIfBaseline,
  simulateWhatIf,
  type WhatIfBaseline,
} from "@/lib/what-if";

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
            <EChartsView
              option={{
                color: ["#93A3B8", "#60F5D2"],
                grid: { left: 12, right: 16, top: 24, bottom: 12, containLabel: true },
                tooltip: { trigger: "axis", backgroundColor: "#08172B", borderColor: "#34445E", textStyle: { color: "#EEF2F7" } },
                legend: { top: 0, textStyle: { color: "#AAB7C9", fontSize: 11 } },
                xAxis: { type: "category", data: result.chart.map((point) => point.label), axisLabel: { color: "#AAB7C9", hideOverlap: true }, axisLine: { lineStyle: { color: "#34445E" } } },
                yAxis: { type: "value", axisLabel: { color: "#AAB7C9" }, splitLine: { lineStyle: { color: "#34445E" } } },
                series: result.temporal
                  ? [
                      { name: "الحالي", type: "line", data: result.chart.map((point) => point.base), symbol: "none", lineStyle: { type: "dashed", width: 2 } },
                      { name: "المحاكاة", type: "line", data: result.chart.map((point) => point.next), symbol: "none", smooth: true, lineStyle: { width: 2 } },
                    ]
                  : [
                      { name: "الحالي", type: "bar", data: result.chart.map((point) => point.base), itemStyle: { borderRadius: [6, 6, 0, 0] } },
                      { name: "المحاكاة", type: "bar", data: result.chart.map((point) => point.next), itemStyle: { borderRadius: [6, 6, 0, 0] } },
                    ],
              }}
              label={`الأثر حسب ${baseline.breakdown.column}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
