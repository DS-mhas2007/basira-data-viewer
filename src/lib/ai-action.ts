/**
 * جانب المتصفح من نظام الحصص:
 *  - hasAiSession: التحقق من جلسة موجودة دون إنشاء حساب زائر.
 *  - metered: يربط كل استدعاءات عملية واحدة (مثل تشغيل الوكيل: عدة أسئلة + ملخص) بمعرّف واحد
 *    فتُحسب طلباً واحداً، ويُبلّغ الواجهة عند بلوغ الحد لتعرض نافذة التسجيل/الترقية.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  QUOTA_CHANGED_EVENT,
  QUOTA_EVENT,
  quotaMessage,
  type QuotaErrorCode,
  type QuotaEventDetail,
  type QuotaInfo,
} from "@/lib/quota";

/** Checks an existing session only; never registers an anonymous visitor. */
export async function hasAiSession(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getSession();
    return !error && !!data.session;
  } catch {
    return false;
  }
}

export function notifyQuota(detail: QuotaEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<QuotaEventDetail>(QUOTA_EVENT, { detail }));
}

type ServerFn = (opts: { data: never }) => Promise<unknown>;

/**
 * يغلّف دالة سيرفر ذكاء اصطناعي: جلسة موجودة + معرّف عملية موحّد + إشعار الحد.
 * استدعِه مرة لكل عملية يبدأها المستخدم، واستخدم الدالة الناتجة لكل استدعاءاتها.
 */
export function metered<F extends (opts: { data: never }) => Promise<unknown>>(
  fn: F,
  actionId: string = crypto.randomUUID(),
): F {
  const wrapped = async (opts: { data: Record<string, unknown> }) => {
    if (!(await hasAiSession())) {
      const code: QuotaErrorCode = "login_required";
      notifyQuota({ code });
      return { ok: false, error: quotaMessage(code), code };
    }
    const res = (await (fn as unknown as ServerFn)({
      ...opts,
      data: { ...opts.data, actionId } as never,
    })) as { ok?: boolean; code?: string; quota?: QuotaInfo } | undefined;
    if (typeof window !== "undefined") window.dispatchEvent(new Event(QUOTA_CHANGED_EVENT));
    if (res && res.ok === false && (res.code === "quota_exceeded" || res.code === "action_limit")) {
      notifyQuota({ code: res.code, ...(res.quota ? { quota: res.quota } : {}) });
    }
    return res;
  };
  return wrapped as unknown as F;
}
