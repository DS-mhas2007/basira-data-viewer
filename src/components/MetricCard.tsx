import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: "default" | "primary" | "accent";
}

const TONES: Record<string, string> = {
  default: "border-border/60 bg-surface-1 text-muted-foreground",
  primary: "border-primary/25 bg-primary/10 text-primary",
  accent: "border-accent/25 bg-accent/10 text-accent",
};

/** بطاقة مؤشر مدمجة — هادئة، بلا توهّج. */
export function MetricCard({ icon, label, value, hint, tone = "default" }: Props) {
  return (
    <div className="group rounded-xl border border-border/50 bg-surface-1 px-4 py-3.5 transition-colors duration-200 hover:border-border">
      <div className="flex items-center gap-2.5">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${TONES[tone]}`}
        >
          {icon}
        </span>
        <p className="min-w-0 truncate text-xs text-muted-foreground">{label}</p>
      </div>
      <p dir="auto" className="mt-3 truncate font-display text-xl font-bold leading-none tracking-tight">
        {value}
      </p>
      {hint && <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}