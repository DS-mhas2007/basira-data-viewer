import { BadgeCheck, Copy, ShieldAlert } from "@/components/icons";
import { toast } from "sonner";
import { sealTimestampAr, type AuditSeal } from "@/lib/audit-seal";
import { cn } from "@/lib/utils";

interface Props {
  seal: AuditSeal;
  className?: string;
  /** نسخة مبسطة بلا تفاعل للطباعة داخل التقرير. */
  print?: boolean;
}

export function AuditSealBadge({ seal, className, print }: Props) {
  const isComplete = seal.status === "complete";
  const short = (fingerprint: string | null) => fingerprint?.split(":").at(-1)?.slice(0, 16) ?? null;
  const outputFingerprint = seal.output?.fingerprint;
  return (
    <div
      role={isComplete ? "status" : "alert"}
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3",
        print
          ? isComplete ? "border-primary/40 bg-card" : "border-destructive/40 bg-card"
          : isComplete ? "mz-glass-card mz-glass-card--teal border-primary/25" : "border-destructive/40 bg-card",
        className,
      )}
    >
      <span className={cn(
        "relative flex size-10 shrink-0 items-center justify-center rounded-xl border",
        isComplete ? "border-primary/30 bg-primary/10 text-primary" : "border-destructive/30 bg-destructive/10 text-destructive",
      )}>
        {isComplete ? <BadgeCheck className="size-5" strokeWidth={2.25} /> : <ShieldAlert className="size-5" />}
        {isComplete && !print && (
          <span className="absolute inset-0 rounded-xl border border-primary/40 pulse-dot" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-xs font-bold text-foreground">
          {isComplete ? "سجل اتساق محلي — ليس توقيعاً رقمياً" : "سجل مصدر وناتج غير مكتمل"}
        </p>
        <dl className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
          <div>
            <dt className="inline font-medium text-foreground">المصدر الأصلي: </dt>
            <dd className="inline">{seal.fileName}{seal.source.alias ? ` (${seal.source.alias})` : ""} · {seal.source.fingerprint ? `SHA-256 ${short(seal.source.fingerprint)}…` : "بصمة المصدر غير متاحة"}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">وصفة التحويل: </dt>
            <dd className="inline">{seal.transformation.fingerprint ? `SHA-256 ${short(seal.transformation.fingerprint)}…` : "غير متاحة"}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">الناتج التحليلي: </dt>
            <dd className="inline">
              {seal.output
                ? `SHA-256 ${short(seal.output.fingerprint)}… · ${seal.output.rowCount.toLocaleString("ar-EG")} صف · ${seal.output.schema.map((column) => `${column.name} (${column.type})`).join("، ")}`
                : "بصمة الناتج ومخططه غير متاحين"}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">سياق التنفيذ: </dt>
            <dd className="inline">
              {seal.execution
                ? `${seal.execution.engine} ${seal.execution.engineVersion} · SHA-256 ${short(seal.execution.fingerprint)}… · سجل محلي غير موقع`
                : "لا يوجد سجل تنفيذ مكتمل"}
            </dd>
          </div>
        </dl>
        <div className="mt-2">
          <p className="text-[11px] font-medium text-foreground">التحويلات المسجلة:</p>
          {seal.transformation.steps.length > 0 ? (
            <ol className="list-inside list-decimal text-[11px] text-muted-foreground">
              {seal.transformation.steps.map((step, index) => (
                <li key={`${step.kind}-${index}`}>{step.label} · {step.affectedRows.toLocaleString("ar-EG")}</li>
              ))}
            </ol>
          ) : <p className="text-[11px] text-muted-foreground">لا توجد تحويلات مسجلة.</p>}
        </div>
        {seal.issues.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-[11px] text-destructive">
            {seal.issues.map((issue, index) => <li key={index}>{issue}</li>)}
          </ul>
        )}
        <p className="mt-2 text-[10px] text-muted-foreground">
          تُحسب البصمات محلياً؛ لا تثبت أصالة الملف أو تنفيذ التحليل في بيئة موثوقة. · {sealTimestampAr(seal.issuedAt)}
        </p>
      </div>
      {!print && outputFingerprint && (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(outputFingerprint);
            toast.success("نُسخت بصمة الناتج التحليلي");
          }}
          className="clay-press rounded-lg border border-white/10 p-2 text-muted-foreground transition hover:text-primary"
          aria-label="نسخ بصمة الناتج التحليلي"
        >
          <Copy className="size-3.5" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}