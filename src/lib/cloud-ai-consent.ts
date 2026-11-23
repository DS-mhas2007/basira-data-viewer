/** لا تُعدّ القيمة المفقودة أو أي قيمة غير true موافقة. */
export function isCloudAiConsentGranted(value: unknown): value is true {
  return value === true;
}

export type CloudAiRequestResult<T> =
  { ok: true; value: T } | { ok: false; code: "cloud_consent_required"; error: string };

/** نقطة تشغيل قابلة للاختبار: لا يستدعي callback مطلقاً إلا مع موافقة صريحة. */
export async function runCloudAiRequest<T>(
  request: { cloudAiConsent?: unknown; persist?: unknown },
  sendToProvider: () => Promise<T>,
): Promise<CloudAiRequestResult<T>> {
  if (!isCloudAiConsentGranted(request.cloudAiConsent)) {
    return {
      ok: false,
      code: "cloud_consent_required",
      error: "Cloud AI consent is required before sending user data to a provider.",
    };
  }
  return { ok: true, value: await sendToProvider() };
}
