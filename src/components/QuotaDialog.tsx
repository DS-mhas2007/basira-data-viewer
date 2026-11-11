import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QUOTA_EVENT, quotaMessage, type QuotaEventDetail } from "@/lib/quota";

/** نافذة عامة تظهر عند بلوغ حد الاستخدام: تسجيل دخول للزائر، أو معلومات الخطة لغيره. */
export function QuotaDialog() {
  const [detail, setDetail] = useState<QuotaEventDetail | null>(null);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const onQuota = (e: Event) => setDetail((e as CustomEvent<QuotaEventDetail>).detail);
    window.addEventListener(QUOTA_EVENT, onQuota);
    return () => window.removeEventListener(QUOTA_EVENT, onQuota);
  }, []);

  const needsLogin = detail?.code === "login_required" || detail?.quota?.is_anonymous === true;
  const isFree = detail?.quota?.plan === "free";

  function goLogin() {
    setDetail(null);
    void navigate({ to: "/auth", search: { next: pathname } });
  }

  return (
    <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {needsLogin ? "سجّل الدخول للمتابعة" : "وصلت إلى حد الاستخدام"}
          </DialogTitle>
          <DialogDescription className="leading-7">
            {detail ? quotaMessage(detail.code, detail.quota) : ""}
            {needsLogin && " حسابك المجاني يمنحك 30 طلباً شهرياً، وتبقى بياناتك في متصفحك."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          {needsLogin ? (
            <Button className="rounded-xl" onClick={goLogin}>
              تسجيل الدخول / إنشاء حساب
            </Button>
          ) : isFree ? (
            <Button className="rounded-xl" variant="secondary" disabled>
              الخطط المدفوعة قريباً
            </Button>
          ) : null}
          <Button variant="ghost" className="rounded-xl" onClick={() => setDetail(null)}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
