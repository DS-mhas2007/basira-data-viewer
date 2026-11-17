/**
 * يستهلك وحدة من حصة المستخدم عبر دالة قاعدة البيانات (ذرية، بصلاحية JWT المستخدم نفسه).
 * يُستدعى من السيرفر فقط، قبل أي استدعاء لنموذج الذكاء الاصطناعي.
 *
 * Fail closed: غياب migration أو فشل RPC لا يمنح المستخدم حصة غير محدودة.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuotaInfo } from "./quota";

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
    console.error("[quota] فشل التحقق من الحصة:", error.code ?? error.message);
    throw new Error("quota_check_failed");
  }

  if (!data || typeof data !== "object" || typeof (data as { allowed?: unknown }).allowed !== "boolean") {
    console.error("[quota] أعادت قاعدة البيانات استجابة حصة غير صالحة.");
    throw new Error("quota_check_failed");
  }

  return data as unknown as QuotaInfo;
}
