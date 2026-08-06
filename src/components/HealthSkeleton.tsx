/** هيكل عظمي لبطاقة درجة الجودة أثناء تنفيذ استعلامات الفحص. */
export function HealthSkeleton() {
  return (
    <section className="rise-in space-y-5" aria-hidden>
      <div className="clay rounded-2xl border border-border/70 bg-card p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div className="shimmer size-[136px] shrink-0 rounded-full bg-muted/40" />
          <div className="w-full flex-1 space-y-3">
            <div className="shimmer h-5 w-56 rounded bg-muted-foreground/20" />
            <div className="shimmer h-3 w-full max-w-md rounded bg-muted/60" />
            <div className="grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="shimmer h-9 rounded-xl border border-border/50 bg-muted/30" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="clay flex items-start gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5"
          >
            <div className="shimmer size-9 shrink-0 rounded-xl bg-muted/50" />
            <div className="flex-1 space-y-2">
              <div className="shimmer h-3.5 rounded bg-muted/60" style={{ width: `${[80, 65, 72, 58][i]}%` }} />
              <div className="shimmer h-2.5 w-32 rounded bg-muted-foreground/15" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
