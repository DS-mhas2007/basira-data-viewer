/** هيكل عظمي لبطاقات المعلومات وشارات الأنواع أثناء قراءة الملف. */
export function StatsSkeleton() {
  return (
    <div className="rise-in space-y-6" aria-hidden>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="clay flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-4"
          >
            <div className="shimmer size-10 shrink-0 rounded-xl bg-primary/10" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="shimmer h-2.5 w-16 rounded bg-muted-foreground/20" />
              <div
                className="shimmer h-3.5 rounded bg-muted/70"
                style={{ width: `${[70, 45, 55, 35][i]}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="clay space-y-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="shimmer size-7 rounded-lg bg-accent/15" />
          <div className="shimmer h-3 w-40 rounded bg-muted-foreground/20" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[92, 74, 110, 68, 96, 82, 120].map((w, i) => (
            <div
              key={i}
              className="shimmer h-7 rounded-full border border-border/60 bg-muted/50"
              style={{ width: w }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
