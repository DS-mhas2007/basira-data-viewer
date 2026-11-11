/**
 * يستهلك وحدة من حصة المستخدم عبر دالة قاعدة البيانات (ذرية، بصلاحية JWT المستخدم نفسه).
 * يُستدعى من السيرفر فقط، قبل أي استدعاء مدفوع لنموذج الذكاء الاصطناعي.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuotaInfo } from "./quota";

// PGRST202 / 42883: الدالة غير موجودة (الـ migration لم يُطبَّق بعد على هذه البيئة).
const MISSING_FUNCTION = new Set(["PGRST202", "42883"]);

export async function consumeQuota(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  actionId?: string,
  kind = "ai",
): Promise<QuotaInfo> {
  const { data, error } = await supabase.rpc("consume_ai_quota", {
    _action_id: actionId ?? null,
    _kind: kind,
  });

  if (error) {
    if (error.code && MISSING_FUNCTION.has(error.code)) {
      // انتقالي: لا نعطّل المنتج قبل تطبيق migration الحصص. أزل هذا الفرع بعد تطبيقه.
      console.error("[quota] consume_ai_quota غير موجودة — الحصص غير مفروضة حتى تطبيق الـ migration.");
      return {
        allowed: true,
        reason: "ok",
        plan: "unknown",
        period: "month",
        limit: 0,
        used: 0,
        remaining: 0,
        is_anonymous: false,
      };
    }
    console.error("[quota] فشل التحقق من الحصة:", error.message);
    throw new Error("quota_check_failed");
  }
  return data as unknown as QuotaInfo;
}
