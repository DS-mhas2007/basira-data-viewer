/**
 * مكتبة القوالب: بطاقات حزم تحليل جاهزة — نقرة واحدة تشغّل أسئلتها وتثبّت نتائجها.
 */
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { CheckCircle2, LayoutTemplate, Loader2, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runQuestions } from "@/lib/auto-insights";
import { planAiQuery } from "@/lib/ai-query.functions";
import { buildTemplateQuestions, rankTemplates, type AnalysisTemplate } from "@/lib/templates";
import { playSfx } from "@/lib/sfx";
import type { TableInfo } from "@/lib/duckdb-service";
import type { HealthReport } from "@/lib/data-health";
import type { Row } from "@/lib/parse-file";
import type { PinnedInsight } from "@/lib/report";
import { cn } from "@/lib/utils";

interface Props {
  tableInfo: TableInfo;
  sample: Row[];
  health: HealthReport | null;
  onInsights: (insights: PinnedInsight[]) => void;
}

export function TemplateGallery({ tableInfo, sample, health, onInsights }: Props) {
  const askAi = useServerFn(planAiQuery);
  const ranked = useMemo(() => rankTemplates(tableInfo), [tableInfo]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [doneIds, setDoneIds] = useState<Record<string, number>>({});

  async function run(t: AnalysisTemplate) {
    if (runningId) return;
    const questions = buildTemplateQuestions(t, tableInfo);
    setRunningId(t.id);
    setProgress({ done: 0, total: questions.length });
    try {
      const insights = await runQuestions({
        askAi,
        tableInfo,
        sample,
        health,
        questions,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      if (insights.length === 0) {
        toast.error("لم ينتج القالب استنتاجات صالحة على هذه البيانات");
        return;
      }
      onInsights(insights);
      setDoneIds((p) => ({ ...p, [t.id]: insights.length }));
      playSfx("success");
      toast.success(`قالب «${t.name}» جاهز`, {
        description: `${insights.length} استنتاج مثبّت وجاهز للتقرير`,
      });
    } catch {
      toast.error("تعذّر تشغيل القالب");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="clay-inset flex items-center gap-2.5 rounded-2xl border border-border/60 bg-background/50 px-4 py-3 text-xs text-muted-foreground">
        <LayoutTemplate className="size-4 shrink-0 text-primary" strokeWidth={2.25} />
        القوالب مرتّبة حسب ملاءمتها لأعمدة ملفك — كل قالب ينفّذ أسئلته محلياً ويثبّت نتائجه في التقرير.
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ranked.map(({ template: t }, i) => {
          const busy = runningId === t.id;
          const count = doneIds[t.id];
          const questions = buildTemplateQuestions(t, tableInfo);
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn(
                "clay clay-lift flex flex-col gap-3 rounded-2xl border border-border/70 bg-card px-4 py-4",
                busy && "border-primary/45",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/[0.08] text-lg">
                  {t.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-bold">{t.name}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {t.tagline}
                  </p>
                </div>
                {i === 0 && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/25 bg-accent/[0.08] px-2 py-0.5 text-[10px] text-accent">
                    <Sparkles className="size-3" strokeWidth={2.25} />
                    الأنسب
                  </span>
                )}
              </div>

              <ul className="space-y-1.5">
                {questions.slice(0, 3).map((q) => (
                  <li
                    key={q}
                    dir="auto"
                    className="truncate text-[11px] text-muted-foreground/85"
                    title={q}
                  >
                    • {q}
                  </li>
                ))}
                {questions.length > 3 && (
                  <li className="text-[11px] text-muted-foreground/60">
                    +{questions.length - 3} سؤال إضافي
                  </li>
                )}
              </ul>

              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                {busy ? (
                  <span className="font-mono text-[11px] text-primary">
                    {progress.done}/{progress.total}
                  </span>
                ) : count ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                    <CheckCircle2 className="size-3.5" strokeWidth={2.25} />
                    {count} استنتاج مثبّت
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {questions.length} سؤال جاهز
                  </span>
                )}
                <Button
                  size="sm"
                  variant={count ? "outline" : "default"}
                  disabled={!!runningId}
                  onClick={() => void run(t)}
                  className="clay-press gap-1.5 rounded-xl text-xs"
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} />
                  ) : (
                    <Play className="size-3.5" strokeWidth={2.25} />
                  )}
                  {busy ? "جارٍ التشغيل…" : count ? "إعادة التشغيل" : "شغّل القالب"}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}