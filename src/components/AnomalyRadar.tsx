import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, Radar, ShieldCheck } from "lucide-react";
import { detectAnomalies, type AnomalySignal } from "@/lib/anomaly-radar";
import type { TableInfo } from "@/lib/duckdb-service";
import { cn } from "@/lib/utils";

const LEVEL: Record<AnomalySignal["level"], { label: string; cls: string }> = {
  high: { label: "مرتفع", cls: "border-destructive/30 bg-destructive/10 text-destructive" },
  medium: { label: "متوسط", cls: "border-accent/30 bg-accent/10 text-accent" },
  low: { label: "منخفض", cls: "border-white/10 bg-white/5 text-muted-foreground" },
};

export function AnomalyRadar({
  tableInfo,
  sourceKey,
  onSignals,
}: {
  tableInfo: TableInfo | null;
  sourceKey: string;
  onSignals?: (s: AnomalySignal[]) => void;
}) {
  const [signals, setSignals] = useState<AnomalySignal[] | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!tableInfo) {
      setSignals(null);
      return;
    }
    setSignals(null);
    void detectAnomalies(tableInfo)
      .then((s) => {
        if (!alive) return;
        setSignals(s);
        onSignals?.(s);
      })
      .catch(() => alive && setSignals([]));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableInfo?.table, sourceKey]);

  if (!tableInfo) return null;

  if (signals === null) {
    return (
      <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-muted-foreground">
        <Radar className="size-4 animate-spin text-primary" strokeWidth={2} />
        رادار بصيرة يفحص الإشارات الغريبة…
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="glass flex items-center gap-3 rounded-2xl border-primary/20 px-4 py-3 text-sm">
        <ShieldCheck className="size-4 text-primary" strokeWidth={2} />
        <span className="font-medium">رادار بصيرة: لم يُرصد أي نمط مريب في بياناتك.</span>
      </div>
    );
  }

  return (
    <div className="glass overflow-hidden rounded-2xl border-accent/25">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-right"
      >
        <span className="flex size-8 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
          <Radar className="size-4" strokeWidth={2.25} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-bold">رادار بصيرة للإشارات الغريبة</span>
          <span className="block text-[11px] text-muted-foreground">
            {signals.length} إشارة تستحق المراجعة قبل اعتماد النتائج
          </span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")}
          strokeWidth={2}
        />
      </button>
      {open && (
        <ul className="space-y-2 border-t border-white/10 px-4 py-3">
          {signals.map((s) => (
            <li
              key={s.id}
              className={cn("rounded-xl border px-3 py-2.5", LEVEL[s.level].cls)}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold">{s.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">{s.detail}</p>
                </div>
                <span className="rounded-md border border-current/20 px-1.5 py-0.5 text-[10px] font-medium">
                  {LEVEL[s.level].label}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}