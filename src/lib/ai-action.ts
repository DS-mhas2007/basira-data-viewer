/**
 * جانب المتصفح من نظام الحصص:
 *  - ensureGuestSession: تسجيل دخول مجهول تلقائي للزائر (تجربة مجانية بحدود).
 *  - metered: يربط كل استدعاءات عملية واحدة (مثل تشغيل الوكيل: عدة أسئلة + ملخص) بمعرّف واحد
 *    فتُحسب طلباً واحداً، ويُبلّغ الواجهة عند بلوغ الحد لتعرض نافذة التسجيل/الترقية.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  QUOTA_EVENT,
  quotaMessage,
  type QuotaErrorCode,
  type QuotaEventDetail,
  type QuotaInfo,
} from "@/lib/quota";

let pendingGuest: Promise<boolean> | null = null;

/** يضمن وجود جلسة (حقيقية أو مجهولة). يعيد false إن تعذّر (مثلاً الدخول المجهول معطّل). */
export async function ensureGuestSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) return true;
    pendingGuest ??= supabase.auth
      .signInAnonymously()
      .then((r) => !r.error)
      .catch(() => false)
      .finally(() => {
        pendingGuest = null;
      });
    return await pendingGuest;
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
 * يغلّف دالة سيرفر ذكاء اصطناعي: جلسة تلقائية + معرّف عملية موحّد + إشعار الحد.
 * استدعِه مرة لكل عملية يبدأها المستخدم، واستخدم الدالة الناتجة لكل استدعاءاتها.
 */
export function metered<F extends (opts: { data: never }) => Promise<unknown>>(
  fn: F,
  actionId: string = crypto.randomUUID(),
): F {
  const wrapped = async (opts: { data: Record<string, unknown> }) => {
    if (!(await ensureGuestSession())) {
      const code: QuotaErrorCode = "login_required";
      notifyQuota({ code });
      return { ok: false, error: quotaMessage(code), code };
    }
    const res = (await (fn as unknown as ServerFn)({
      ...opts,
      data: { ...opts.data, actionId } as never,
    })) as { ok?: boolean; code?: string; quota?: QuotaInfo } | undefined;
    if (res && res.ok === false && (res.code === "quota_exceeded" || res.code === "action_limit")) {
      notifyQuota({ code: res.code, ...(res.quota ? { quota: res.quota } : {}) });
    }
    return res;
  };
  return wrapped as unknown as F;
}
