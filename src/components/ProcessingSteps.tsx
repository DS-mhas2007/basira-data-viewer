import { Check, Database, FileSearch, Loader2, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type Stage = "idle" | "reading" | "analyzing" | "preparing" | "done";

const STEPS: { key: Exclude<Stage, "idle" | "done">; label: string; icon: typeof Database }[] = [
  { key: "reading", label: "قراءة الملف", icon: FileSearch },
  { key: "analyzing", label: "تحليل البنية", icon: Table2 },
  { key: "preparing", label: "تجهيز البيانات", icon: Database },
];

const ORDER: Stage[] = ["idle", "reading", "analyzing", "preparing", "done"];

export function ProcessingSteps({ stage }: { stage: Stage }) {
  if (stage === "idle" || stage === "done") return null;
  const current = ORDER.indexOf(stage);

  return (
    <div className="rise-in flex flex-wrap items-center gap-x-3 gap-y-2 clay rounded-2xl border border-border/70 bg-card/80 px-4 py-3">
      {STEPS.map((step, i) => {
        const index = ORDER.indexOf(step.key);
        const active = index === current;
        const done = index < current;
        const Icon = done ? Check : active ? Loader2 : step.icon;
        return (
          <div key={step.key} className="flex items-center gap-3">
            {i > 0 && (
              <span
                className={cn(
                  "h-px w-6 transition-colors duration-500",
                  done || active ? "bg-primary/60" : "bg-border",
                )}
              />
            )}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-xl transition-colors duration-300",
                  done
                    ? "bg-primary/15 text-primary"
                    : active
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/60 text-muted-foreground/70",
                )}
              >
                <Icon className={cn("size-4", active && "animate-spin")} strokeWidth={2} />
              </span>
              <span
                className={cn(
                  "text-sm transition-colors duration-300",
                  done || active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}