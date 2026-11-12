import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QUOTA_CHANGED_EVENT, type QuotaStatus } from "@/lib/quota";

/**
 * الحصة الحالية للمستخدم (قراءة فقط). null = لا جلسة بعد أو الميزة غير مفعّلة في هذه البيئة.
 * لا ننشئ جلسة مجهولة لمجرد عرض العدّاد؛ تُنشأ عند أول استخدام فعلي للذكاء الاصطناعي.
 */
export function useAiQuota() {
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [hasSession, setHasSession] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data: s } = await supabase.auth.getSession();
      setHasSession(!!s.session);
      if (!s.session) {
        setQuota(null);
        return;
      }
      // Optional RPC is absent from generated types until its migration is deployed.
      const readQuota = supabase.rpc.bind(supabase) as unknown as (
        name: "get_ai_quota",
      ) => PromiseLike<{ data: QuotaStatus | null; error: unknown }>;
      const { data, error } = await readQuota("get_ai_quota");
      setQuota(error || !data ? null : (data as unknown as QuotaStatus));
    } catch {
      setQuota(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChanged = () => void refresh();
    window.addEventListener(QUOTA_CHANGED_EVENT, onChanged);
    const { data: sub } = supabase.auth.onAuthStateChange(() => void refresh());
    return () => {
      window.removeEventListener(QUOTA_CHANGED_EVENT, onChanged);
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  return { quota, hasSession };
}
