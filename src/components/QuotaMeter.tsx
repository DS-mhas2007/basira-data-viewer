import { Link } from "@tanstack/react-router";
import { useAiQuota } from "@/hooks/useAiQuota";
import { quotaMeterText } from "@/lib/quota";

/** سطر صغير يوضح الحصة المتبقية: يجعل الحد متوقعاً بدل أن يصطدم به المستخدم فجأة. */
export function QuotaMeter() {
  const { quota, hasSession } = useAiQuota();

  // زائر لم يبدأ التجربة بعد
  if (!hasSession) {
    return <p className="text-[11px] text-muted-foreground">جرّب الذكاء الاصطناعي مجاناً بدون تسجيل.</p>;
  }
  if (!quota) return null;

  const empty = quota.remaining === 0;
  const low = quota.remaining <= 2;
  return (
    <p
      className={`flex flex-wrap items-center gap-x-2 text-[11px] ${
        empty ? "text-destructive" : low ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
      }`}
      aria-live="polite"
    >
      <span>{quotaMeterText(quota)}</span>
      {quota.is_anonymous && low && (
        <Link to="/auth" search={{ next: "/" }} className="font-semibold text-primary underline-offset-2 hover:underline">
          سجّل الدخول للمزيد
        </Link>
      )}
    </p>
  );
}
