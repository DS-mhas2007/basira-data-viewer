import {
  AlertTriangle,
  CheckCircle2,
  Columns3,
  Copy,
  CircleSlash,
  ShieldCheck,
  Type,
} from "lucide-react";
import {
  DUPLICATES_WEIGHT,
  MISSING_VALUES_WEIGHT,
  TYPE_MISMATCH_WEIGHT,
  severityOfScore,
  type HealthIssue,
  type HealthReport,
  type Severity,
} from "@/lib/data-health";

const TONE: Record<Severity, { text: string; ring: string; bg: string; border: string; label: string }> = {
  good: {
    text: "text-primary",
    ring: "stroke-[hsl(var(--primary))]",
    bg: "bg-primary/10",
    border: "border-primary/30",
    label: "جيدة",
  },
  warn: {
    text: "text-[hsl(38_92%_62%)]",
    ring: "stroke-[hsl(38_92%_62%)]",
    bg: "bg-[hsl(38_92%_62%)]/10",
    border: "border-[hsl(38_92%_62%)]/30",
    label: "تحتاج انتباهاً",
  },
  bad: {
    text: "text-destructive",
    ring: "stroke-[hsl(var(--destructive))]",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    label: "ضعيفة",
  },
};

const ISSUE_ICON = {
  missing: CircleSlash,
  duplicates: Copy,
  type: Type,
  constant: Columns3,
} as const;

function ScoreRing({ score, severity }: { score: number; severity: Severity }) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  return (
    <div className="relative size-[136px] shrink-0">
      <svg viewBox="0 0 128 128" className="size-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          strokeWidth="10"
          className="stroke-muted/50"
        />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${TONE[severity].ring} transition-[stroke-dashoffset] duration-1000 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span dir="ltr" className={`font-display text-4xl font-extrabold leading-none ${TONE[severity].text}`}>
          {score}
        </span>
        <span className="mt-1 text-[11px] text-muted-foreground">من 100</span>
      </div>
    </div>
  );
}

function IssueCard({ issue }: { issue: HealthIssue }) {
  const tone = TONE[issue.severity];
  const Icon = ISSUE_ICON[issue.kind];
  return (
    <li className={`clay clay-lift flex items-start gap-3 rounded-2xl border ${tone.border} bg-card px-4 py-3.5`}>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${tone.bg} ${tone.text}`}>
        <Icon className="size-4.5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-medium leading-relaxed">{issue.title}</p>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {issue.column && (
            <span dir="auto" className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 font-mono">
              {issue.column}
            </span>
          )}
          <span>
            الصفوف المتأثرة:{" "}
            <span dir="ltr" className="font-mono text-foreground/80">
              {issue.affectedRows.toLocaleString("en-US")}
            </span>
          </span>
        </div>
      </div>
      <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium ${tone.bg} ${tone.text}`}>
        {issue.severity === "bad" ? "خطورة عالية" : issue.severity === "warn" ? "متوسطة" : "منخفضة"}
      </span>
    </li>
  );
}

function WeightRow({ label, deduction, weight }: { label: string; deduction: number; weight: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span dir="ltr" className="font-mono text-xs text-foreground/80">
        −{deduction.toFixed(1)} / {weight}
      </span>
    </div>
  );
}

/** بطاقة درجة جودة البيانات + قائمة المشاكل المكتشفة. */
export function HealthScoreCard({ report }: { report: HealthReport }) {
  const severity = severityOfScore(report.score);
  const tone = TONE[severity];

  return (
    <section className="rise-in space-y-5">
      <div className="clay rounded-2xl border border-border/70 bg-card p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <ScoreRing score={report.score} severity={severity} />
          <div className="min-w-0 flex-1 space-y-3 text-center sm:text-right">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className={`flex size-8 items-center justify-center rounded-xl ${tone.bg} ${tone.text}`}>
                <ShieldCheck className="size-4.5" strokeWidth={2} />
              </span>
              <h2 className="font-display text-xl font-bold">درجة جودة البيانات</h2>
              <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${tone.bg} ${tone.text}`}>
                {tone.label}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              محسوبة بأوزان ثابتة عبر استعلامات <span dir="ltr" className="font-mono">SQL</span> على محرك{" "}
              <span dir="ltr" className="font-mono">DuckDB</span> — بدون أي ذكاء اصطناعي.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <WeightRow label="القيم المفقودة" deduction={report.deductions.missing} weight={MISSING_VALUES_WEIGHT} />
              <WeightRow label="الصفوف المكررة" deduction={report.deductions.duplicates} weight={DUPLICATES_WEIGHT} />
              <WeightRow label="عدم تناسق النوع" deduction={report.deductions.typeMismatch} weight={TYPE_MISMATCH_WEIGHT} />
            </div>
          </div>
        </div>
      </div>

      {report.issues.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-muted-foreground" strokeWidth={2} />
            <h3 className="text-sm font-semibold">
              مشاكل مكتشفة{" "}
              <span dir="ltr" className="font-mono text-muted-foreground">
                ({report.issues.length})
              </span>
            </h3>
          </div>
          <ul className="grid gap-3 lg:grid-cols-2">
            {report.issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </ul>
        </div>
      ) : (
        <div className="clay flex items-center gap-4 rounded-2xl border border-primary/30 bg-card px-5 py-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CheckCircle2 className="size-6" strokeWidth={2} />
          </span>
          <div className="space-y-1">
            <p className="font-display text-base font-bold">لا توجد مشاكل واضحة في بياناتك</p>
            <p className="text-sm text-muted-foreground">
              لم نعثر على قيم مفقودة مؤثرة ولا صفوف مكررة ولا تعارض في أنواع الأعمدة.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
