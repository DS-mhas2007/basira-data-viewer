import { BadgeCheck, Copy, Lock } from "lucide-react";
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
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-4 py-3",
        print
          ? "border-[#60F5D2]/40 bg-[#031021]"
          : "glass border-primary/25 bg-primary/[0.04]",
        className,
      )}
    >
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
        <BadgeCheck className="size-5" strokeWidth={2.25} />
        {!print && (
          <span className="absolute inset-0 rounded-xl border border-primary/40 pulse-dot" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-display text-xs font-bold text-foreground">
          ختم المصداقية — تحليل محلي موثّق
          <Lock className="size-3 text-primary" strokeWidth={2.25} />
        </p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          <span dir="ltr" className="font-mono">
            SHA-256: {seal.shortHash}…
          </span>
          {" · "}
          {sealTimestampAr(seal.issuedAt)}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {seal.rowCount.toLocaleString("ar-EG")} صف · {seal.columnCount} عمود · لم تغادر البيانات جهازك
        </p>
      </div>
      {!print && (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(seal.hash);
            toast.success("تم نسخ بصمة الملف");
          }}
          className="clay-press rounded-lg border border-white/10 p-2 text-muted-foreground transition hover:text-primary"
          aria-label="نسخ البصمة الكاملة"
        >
          <Copy className="size-3.5" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}