/**
 * وكيل بصيرة: زر واحد يشغّل التحليل الكامل تلقائياً ويعرض تقدّم كل خطوة ثم التقرير.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  Check,
  CircleDashed,
  HelpCircle,
  Lightbulb,
  Loader2,
  MinusCircle,
  Play,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  initialAgentSteps,
  runAgent,
  type AgentOutcome,
  type AgentStepState,
} from "@/lib/agent";
import { planAiQuery } from "@/lib/ai-query.functions";
import { generateAgentBrief } from "@/lib/agent-brief.functions";
import { playSfx } from "@/lib/sfx";
import type { TableInfo } from "@/lib/duckdb-service";
import type { CleanStep } from "@/lib/cleaning";
import type { Row } from "@/lib/parse-file";
import { cn } from "@/lib/utils";

interface Props {
  tableInfo: TableInfo;
  fileName: string;
  sample: Row[];
  cleanSteps: CleanStep[];
  onOutcome: (outcome: AgentOutcome) => void;
}

function StepIcon({ status }: { status: AgentStepState["status"] }) {
  if (status === "running") return <Loader2 className="size-4 animate-spin text-primary" strokeWidth={2.25} />;
  if (status === "done") return <Check className="size-4 text-primary" strokeWidth={2.5} />;
  if (status === "skipped") return <MinusCircle className="size-4 text-muted-foreground" strokeWidth={2} />;
  if (status === "error") return <AlertTriangle className="size-4 text-destructive" strokeWidth={2} />;
  return <CircleDashed className="size-4 text-muted-foreground/60" strokeWidth={2} />;
}

function BriefList({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: "primary" | "accent" | "destructive";
}) {
  if (items.length === 0) return null;
  const toneClass =
    tone === "destructive"
      ? "border-destructive/25 bg-destructive/[0.06] text-destructive"
      : tone === "accent"
        ? "border-accent/25 bg-accent/[0.07] text-accent"
        : "border-primary/25 bg-primary/[0.07] text-primary";
  return (
    <div className="clay-inset rounded-2xl border border-border/60 bg-background/50 p-4">
      <p className="flex items-center gap-2 font-display text-xs font-bold">
        <span className={cn("grid size-7 place-items-center rounded-lg border", toneClass)}>{icon}</span>
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70" />
            <span dir="auto">{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AgentPanel({ tableInfo, fileName, sample, cleanSteps, onOutcome }: Props) {
  const askAi = useServerFn(planAiQuery);
  const writeBrief = useServerFn(generateAgentBrief);
  const [steps, setSteps] = useState<AgentStepState[]>(initialAgentSteps);
  const [running, setRunning] = useState(false);
  const [autoClean, setAutoClean] = useState(true);
  const [outcome, setOutcome] = useState<AgentOutcome | null>(null);

  async function start() {
    if (running) return;
    setRunning(true);
    setOutcome(null);
    setSteps(initialAgentSteps());
    try {
      const result = await runAgent({
        tableInfo,
        fileName,
        sample,
        cleanSteps,
        askAi,
        writeBrief,
        autoClean,
        onStep: (id, status, detail) =>
          setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status, detail } : s))),
      });
      setOutcome(result);
      onOutcome(result);
      playSfx("success");
      toast.success("أنهى الوكيل التحليل", {
        description: `${Math.round(result.durationMs / 1000)} ثانية · ${result.insights.length} استنتاج`,
      });
    } catch {
      toast.error("تعذّر إكمال تشغيل الوكيل");
    } finally {
      setRunning(false);
    }
  }

  const doneCount = steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  const progress = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="clay-card space-y-5 rounded-2xl border border-border/60 bg-card/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <Bot className="size-5" strokeWidth={2.25} />
          </span>
          <div>
            <h3 className="font-display text-sm font-bold">الوكيل الذكي</h3>
            <p className="text-xs text-muted-foreground">
              ينفّذ التحليل كاملاً بنفسه: تنظيف، كشف أخطاء، لوحة، مؤشرات، تقرير وتوصيات.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
            <Switch checked={autoClean} onCheckedChange={setAutoClean} disabled={running} />
            تنظيف تلقائي
          </label>
          <Button onClick={() => void start()} disabled={running} className="clay-press gap-2 rounded-xl">
            {running ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
            ) : (
              <Play className="size-4" strokeWidth={2.25} />
            )}
            {running ? "الوكيل يعمل…" : "شغّل الوكيل"}
          </Button>
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
        <motion.div
          className="h-full rounded-full bg-gradient-to-l from-primary to-accent"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <ol className="grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <li
            key={s.id}
            className={cn(
              "clay-inset flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2.5 transition-colors",
              s.status === "running" && "border-primary/40 bg-primary/[0.06]",
            )}
          >
            <span className="mt-0.5">
              <StepIcon status={s.status} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold">{s.label}</span>
              {s.detail && (
                <span dir="auto" className="block truncate text-[11px] text-muted-foreground">
                  {s.detail}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>

      <AnimatePresence>
        {outcome?.brief && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="clay-inset rounded-2xl border border-primary/25 bg-primary/[0.05] p-4">
              <h4 dir="auto" className="font-display text-base font-bold text-primary">
                {outcome.brief.headline_ar}
              </h4>
              <p dir="auto" className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {outcome.brief.summary_ar}
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <BriefList
                icon={<Lightbulb className="size-3.5" strokeWidth={2.25} />}
                title="أهم النتائج"
                items={outcome.brief.findings_ar}
                tone="primary"
              />
              <BriefList
                icon={<AlertTriangle className="size-3.5" strokeWidth={2.25} />}
                title="المخاطر والتحفظات"
                items={outcome.brief.risks_ar}
                tone="destructive"
              />
              <BriefList
                icon={<Target className="size-3.5" strokeWidth={2.25} />}
                title="التوصيات"
                items={outcome.brief.recommendations_ar}
                tone="accent"
              />
              <BriefList
                icon={<HelpCircle className="size-3.5" strokeWidth={2.25} />}
                title="أسئلة مقترحة للمتابعة"
                items={outcome.brief.next_questions_ar}
                tone="primary"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}