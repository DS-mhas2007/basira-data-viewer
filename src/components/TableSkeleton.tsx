interface Props {
  columns?: number;
  rows?: number;
}

/** هيكل عظمي للجدول أثناء التحميل مع تأثير shimmer خفيف. */
export function TableSkeleton({ columns = 6, rows = 8 }: Props) {
  return (
    <div className="space-y-4 rise-in" aria-hidden>
      <div className="flex items-center justify-between gap-4">
        <div className="shimmer h-9 w-full max-w-sm rounded-lg bg-muted/60" />
        <div className="shimmer h-4 w-40 rounded bg-muted/50" />
      </div>
      <div className="mz-glass-card mz-glass-card--neutral overflow-hidden rounded-2xl border-white/10 bg-transparent">
        <div className="flex gap-4 border-b border-white/10 bg-[#112547]/80 px-4 py-3">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="shimmer h-3.5 flex-1 rounded bg-muted-foreground/20" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 border-b border-border/40 px-4 py-3 last:border-b-0">
            {Array.from({ length: columns }).map((_, c) => (
              <div
                key={c}
                className="shimmer h-3 flex-1 rounded bg-muted/70"
                style={{ opacity: 1 - r * 0.07 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}