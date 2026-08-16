/**
 * طبقة PWA: تسجيل عامل الخدمة بحراسة (لا يعمل في المعاينة/التطوير)،
 * التقاط طلب التثبيت، وحفظ التخزين المحلي من الإخلاء.
 * لا يخزّن عامل الخدمة أي بيانات مستخدم — البيانات تبقى في IndexedDB فقط.
 */

const SW_URL = "/sw.js";

/** هل يُسمح بتسجيل عامل الخدمة في السياق الحالي؟ */
export function isServiceWorkerAllowed(): boolean {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  if (!import.meta.env.PROD) return false;
  if (window.self !== window.top) return false;
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return false;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return false;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return false;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return false;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return false;
  return true;
}

async function unregisterAppServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => (r.active?.scriptURL ?? r.waiting?.scriptURL ?? "").endsWith(SW_URL))
      .map((r) => r.unregister()),
  );
}

/** يسجّل عامل الخدمة ويعيد دالة التحديث عند توفّر نسخة جديدة. */
export async function setupServiceWorker(
  onNeedRefresh: (updateNow: () => void) => void,
): Promise<void> {
  if (!isServiceWorkerAllowed()) {
    await unregisterAppServiceWorker();
    return;
  }
  try {
    const { registerSW } = await import("virtual:pwa-register");
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        onNeedRefresh(() => void updateSW(true));
      },
    });
  } catch {
    /* تجاهل: عامل الخدمة غير متاح */
  }
}

/** يطلب تخزيناً دائماً بعد أول قراءة ملف ناجحة (حماية من إخلاء المتصفح). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** هل الخطأ ناتج عن امتلاء مساحة التخزين؟ */
export function isQuotaExceeded(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
}

export const PWA_COPY = {
  offline:
    "أنت دون اتصال — بصيرة تواصل العمل محلياً على بياناتك؛ ميزة الأسئلة الذكية تتطلب الاتصال.",
  backOnline: "عاد الاتصال ✔",
  update: "وصل تحديث جديد لبصيرة.",
  updateAction: "تحديث الآن",
  install: "ثبّت بصيرة",
  installed: "تم تثبيت بصيرة ✔",
  iosHint:
    "لتثبيت بصيرة على iPhone: افتح قائمة المشاركة في Safari واختر «إضافة إلى الشاشة الرئيسية».",
  askOffline: "الأسئلة الذكية تتوفر عند الاتصال — تحليلاتك المحلية تعمل دون اتصال.",
  quota: "مساحة تخزين المتصفح ممتلئة — احذف ملفات قديمة من «ملفاتك الأخيرة» للمتابعة.",
} as const;
