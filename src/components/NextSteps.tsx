import { ArrowLeft, BarChart3, FileDown, Sparkles } from "lucide-react";
import type { HealthReport } from "@/lib/data-health";

interface Step {
  id: string;
  title: string;
  hint: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

/** يبني الخطوات المقترحة حسب حالة البيانات: التنظيف أولاً إن وُجدت مشاكل. */
export function buildNextSteps(health: HealthReport | null): Step[] {
  const issues = health ? health.missingCells + health.duplicateRows + health.mismatchedColumns : 0;
  const steps: Step[] = [];
  if (health && issues > 0) {
    const parts: string[] = [];
    if (health.missingCells) parts.push(`${health.missingCells.toLocaleString("en-US")} قيمة ناقصة`);
    if (health.duplicateRows) parts.push(`${health.duplicateRows.toLocaleString("en-US")} صف مكرر`);
    if (health.mismatchedColumns) parts.push(`${health.mismatchedColumns} عمود بنوع غير متسق`);
    steps.push({
      id: "quality",
      title: "نظّف بياناتك أولاً",
      hint: `وجدنا ${parts.join(" و")}. التنظيف يجعل نتائج التحليل أدق.`,
      icon: <Sparkles className="size-4" strokeWidth={2} />,
      highlight: true,
    });
  }
  steps.push(
    {
      id: "ask",
      title: "اسأل بياناتك",
      hint: "اكتب سؤالك بالعربي وبصيرة تحوّله إلى جدول ورسم.",
      icon: <Sparkles className="size-4" strokeWidth={2} />,
    },
    {
      id: "analysis",
      title: "استكشف الرسوم والتحليل",
      hint: "ابنِ رسوماً ولوحة متابعة من أعمدتك.",
      icon: <BarChart3 className="size-4" strokeWidth={2} />,
    },
    {
      id: "insights",
      title: "صدّر تقريراً",
      hint: "حوّل ما وجدته إلى تقرير PDF جاهز للمشاركة.",
      icon: <FileDown className="size-4" strokeWidth={2} />,
    },
  );
  return steps;
}

export function NextSteps({
  health,
  onGo,
}: {
  health: HealthReport | null;
  onGo: (id: string) => void;
}) {
  const steps = buildNextSteps(health);
  return (
    <section aria-label="الخطوات المقترحة" className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">ماذا بعد؟ الخطوات المقترحة</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onGo(s.id)}
            className={`group flex flex-col gap-2 rounded-xl border px-4 py-3 text-start transition hover:border-primary/60 ${
              s.highlight ? "border-warning/50 bg-warning/5" : "border-border/50 bg-surface-1"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <span className="flex size-6 items-center justify-center rounded-lg bg-accent/10 text-accent">
                {s.icon}
              </span>
              <span className="text-[11px] text-muted-foreground" dir="ltr">
                {i + 1}
              </span>
              {s.title}
              <ArrowLeft className="ms-auto size-3.5 opacity-0 transition group-hover:opacity-100" />
            </span>
            <span className="text-xs leading-relaxed text-muted-foreground">{s.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
