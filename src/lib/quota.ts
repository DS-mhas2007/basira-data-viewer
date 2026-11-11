/**
 * حدود استخدام الذكاء الاصطناعي — الأنواع والرسائل المشتركة بين السيرفر والمتصفح.
 * المنطق الفعلي (العدّ والفرض) في دالة قاعدة البيانات consume_ai_quota.
 */

export type QuotaReason = "ok" | "quota_exceeded" | "action_limit";

export interface QuotaInfo {
  allowed: boolean;
  reason: QuotaReason;
  /** anonymous (زائر) | free | pro | team */
  plan: string;
  period: "lifetime" | "month";
  limit: number;
  used: number;
  remaining: number;
  is_anonymous: boolean;
}

/** أكواد الخطأ التي ترجعها دوال الذكاء الاصطناعي عند الرفض. */
export type QuotaErrorCode = "quota_exceeded" | "action_limit" | "login_required";

export const QUOTA_EVENT = "basira:quota";

export interface QuotaEventDetail {
  code: QuotaErrorCode;
  quota?: QuotaInfo;
}

export function quotaMessage(code: QuotaErrorCode, q?: Pick<QuotaInfo, "plan" | "limit" | "period" | "is_anonymous">): string {
  if (code === "login_required") return "سجّل الدخول لاستخدام الذكاء الاصطناعي.";
  if (code === "action_limit") {
    return "استدعت هذه العملية الذكاء الاصطناعي مرات كثيرة جداً. حاول مرة أخرى لاحقاً.";
  }
  if (q?.is_anonymous) {
    return `انتهت التجربة المجانية (${q.limit} طلبات). سجّل الدخول للمتابعة.`;
  }
  if (q?.plan === "free") {
    return `وصلت إلى حد الخطة المجانية (${q.limit} طلباً شهرياً). تتجدد حصتك مع بداية الشهر القادم، والخطط المدفوعة قريباً.`;
  }
  return q ? `وصلت إلى حد خطتك (${q.limit} طلب ${q.period === "month" ? "شهرياً" : ""}).` : "وصلت إلى حد الاستخدام.";
}

/** يحاول قراءة رد 429 من /api/chat (نص JSON) كخطأ حصة. */
export function parseQuotaError(text: string): QuotaEventDetail | null {
  try {
    const j = JSON.parse(text) as { code?: string; quota?: QuotaInfo };
    if (j && (j.code === "quota_exceeded" || j.code === "action_limit")) {
      return { code: j.code, ...(j.quota ? { quota: j.quota } : {}) };
    }
  } catch {
    /* ليس JSON */
  }
  return null;
}
