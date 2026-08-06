import { Binary, CalendarClock, Hash, ToggleLeft, Type } from "lucide-react";

/** تصنيف نوع عمود DuckDB إلى لون وأيقونة. */
function styleFor(type: string) {
  const t = type.toUpperCase();
  if (/INT|DECIMAL|DOUBLE|FLOAT|NUMERIC|HUGEINT/.test(t))
    return { icon: Hash, cls: "border-primary/30 bg-primary/10 text-primary" };
  if (/BOOL/.test(t))
    return { icon: ToggleLeft, cls: "border-accent/30 bg-accent/10 text-accent" };
  if (/DATE|TIME/.test(t))
    return { icon: CalendarClock, cls: "border-chart-4/30 bg-chart-4/10 text-chart-4" };
  if (/VARCHAR|TEXT|STRING/.test(t))
    return { icon: Type, cls: "border-chart-3/30 bg-chart-3/10 text-chart-3" };
  return { icon: Binary, cls: "border-border bg-muted/60 text-muted-foreground" };
}

export function TypeBadge({ name, type }: { name: string; type: string }) {
  const { icon: Icon, cls } = styleFor(type);
  return (
    <span
      dir="ltr"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs transition-colors duration-200 ${cls}`}
    >
      <Icon className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
      <span className="max-w-[10rem] truncate text-foreground/90">{name}</span>
      <span className="opacity-90">{type}</span>
    </span>
  );
}