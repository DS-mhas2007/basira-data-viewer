import type { ReactNode } from "react";
import { tokens } from "@/lib/design/tokens";

interface Props {
  title: string;
  subtitle?: string | undefined;
  icon?: ReactNode;
  actions?: ReactNode;
}

/** ترويسة صفحة موحّدة داخل مساحة العمل. */
export function PageHeader({ title, subtitle, icon, actions }: Props) {
  const cssVars = {
    "--color-background": tokens.colors.bg,
    "--color-primary": tokens.colors.teal,
    "--color-accent": tokens.colors.violet,
    "--color-surface-2": tokens.colors.surface2,
    "--muted-foreground": tokens.colors.muted,
  } as React.CSSProperties;

  return (
    <header
      style={cssVars as any}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-border/40 pb-5 sm:flex sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface-2 text-primary">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold leading-tight tracking-tight sm:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
