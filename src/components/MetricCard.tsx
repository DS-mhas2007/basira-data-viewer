import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: "default" | "primary" | "accent";
}

const TONES: Record<NonNullable<Props["tone"]>, string> = {
  default: "border-border/70 bg-surface-2/55 text-muted-foreground",
  primary: "border-primary/25 bg-primary/10 text-primary",
  accent: "border-accent/25 bg-accent/10 text-accent",
};

/** مؤشر تحريري واضح؛ يبرز القيمة دون زخرفة أو توهّج. */
export function MetricCard({ icon, label, value, hint, tone = "default" }: Props) {
  return (
    <article className="group min-w-0 rounded-[18px_8px_18px_8px] border border-border/70 bg-surface-1 px-4 py-4 transition-colors duration-200 hover:border-primary/25 hover:bg-surface-2/70 sm:px-5">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">{label}</p>
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-[12px_6px_12px_6px] border ${TONES[tone]}`}>
          {icon}
        </span>
      </div>
      <p
        dir="auto"
        className="mt-4 truncate font-display text-[1.65rem] font-bold leading-none tracking-tight text-foreground sm:text-3xl"
      >
        {value}
      </p>
      {hint && (
        <p className="mt-2 truncate border-t border-border/50 pt-2 text-[11px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </article>
  );
}
