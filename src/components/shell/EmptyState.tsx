import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

/** حالة فارغة أنيقة بدل الشاشات البيضاء. */
export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface-1/60 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-border/60 bg-surface-2 text-muted-foreground">
        {icon}
      </span>
      <h3 className="mt-4 font-display text-base font-bold">{title}</h3>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground sm:text-sm">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
