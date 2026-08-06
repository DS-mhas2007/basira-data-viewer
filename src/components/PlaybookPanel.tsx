/**
 * لوحة قطاع الأعمال: تتعرّف تلقائياً على طبيعة البيانات وتعرض مؤشرات خاصة بالقطاع.
 */
import { useEffect, useState } from "react";
import { Building2, Sparkles, Loader2 } from "lucide-react";
import type { TableInfo } from "@/lib/duckdb-service";
import { runPlaybook, type PlaybookResult } from "@/lib/playbooks";

const ICONS: Record<string, string> = {
  ecommerce: "🛒",
  hr: "👥",
  health: "🩺",
  finance: "💳",
  generic: "📊",
};

export function PlaybookPanel({
  tableInfo,
  sourceKey,
  onResult,
}: {
  tableInfo: TableInfo | null;
  sourceKey: string;
  onResult?: (r: PlaybookResult | null) => void;
}) {
  const [result, setResult] = useState<PlaybookResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tableInfo) {
      setResult(null);
      onResult?.(null);
      return;
    }
    let alive = true;
    setLoading(true);
    void runPlaybook(tableInfo)
      .then((r) => {
        if (!alive) return;
        setResult(r);
        onResult?.(r);
      })
      .catch(() => alive && setResult(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableInfo?.table, sourceKey]);

  if (loading) {
    return (
      <div className="clay-card flex items-center gap-2 rounded-2xl border border-border/60 bg-card/60 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" strokeWidth={2} />
        نتعرّف على قطاع بياناتك…
      </div>
    );
  }
  if (!result || result.kpis.length === 0) return null;

  return (
    <div className="clay-card rounded-2xl border border-border/60 bg-card/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl border border-primary/25 bg-primary/[0.08] text-lg">
            {ICONS[result.id] ?? "📊"}
          </div>
          <div>
            <h3 className="flex items-center gap-2 font-display text-sm font-bold">
              <Building2 className="size-4 text-primary" strokeWidth={2.25} />
              {result.name}
            </h3>
            <p className="text-xs text-muted-foreground">{result.tagline}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/[0.08] px-3 py-1 text-[11px] text-accent">
          <Sparkles className="size-3" strokeWidth={2.25} />
          ثقة التعرّف {Math.round(result.confidence * 100)}%
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {result.kpis.map((k) => (
          <div key={k.label} className="clay-inset rounded-xl border border-border/60 bg-background/50 p-3.5">
            <p className="text-[11px] text-muted-foreground">{k.label}</p>
            <p className="mt-1 truncate font-display text-lg font-bold text-primary" title={k.value}>
              {k.value}
            </p>
            <p className="truncate text-[11px] text-muted-foreground/80">{k.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
