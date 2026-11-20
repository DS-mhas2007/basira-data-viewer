import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ANALYTICS_CONSENT_EVENT,
  getAnalyticsConsent,
  hasAnalyticsOptOutSignal,
  setAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analytics-consent";

export function AnalyticsPrivacyControls() {
  const [consent, setConsent] = useState<AnalyticsConsent>("unknown");
  const optOut = hasAnalyticsOptOutSignal();

  useEffect(() => {
    setConsent(getAnalyticsConsent());
    const onConsentChange = (event: Event) => {
      const selected = (event as CustomEvent<AnalyticsConsent>).detail;
      setConsent(selected ?? getAnalyticsConsent());
    };
    window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsentChange);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsentChange);
  }, []);

  const status = optOut
    ? "متوقفة تلقائياً بسبب إشارة DNT أو GPC في متصفحك"
    : consent === "granted"
      ? "مسموح بها"
      : consent === "denied"
        ? "متوقفة"
        : "لم تختر بعد";

  return (
    <section
      className="mz-glass-card rounded-2xl border border-border/70 p-4 sm:p-5"
      aria-labelledby="analytics-preference-title"
    >
      <h2 id="analytics-preference-title" className="text-sm font-bold text-foreground">
        تحليلات الاستخدام الاختيارية
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        الحالة الحالية: <strong className="text-foreground">{status}</strong>. الغرض فهم استخدام
        الميزات وتحسين MIZYAi، ويمكنك تغيير اختيارك هنا في أي وقت. عند السماح، نسجل المسار ومصدر
        الإحالة كنطاق، ومعلومات الجهاز والموقع التقريبي، ومعرّفات عشوائية للزائر والجلسة؛ وإذا كنت
        مسجلاً للدخول قد ترتبط الزيارة بحسابك. لا نسجل عنوان IP أو ملفات التحليل. تُحذف سجلات
        الزيارة بعد 180 يوماً.
      </p>
      {optOut && (
        <p className="mt-2 text-xs text-muted-foreground">
          إشارة الخصوصية من متصفحك لها الأولوية؛ لذلك لن يبدأ التتبع حتى إذا اخترت السماح.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={consent === "granted" && !optOut ? "default" : "outline"}
          disabled={optOut}
          onClick={() => setAnalyticsConsent("granted")}
        >
          السماح بالتحليلات
        </Button>
        <Button
          size="sm"
          variant={consent === "denied" || optOut ? "default" : "outline"}
          onClick={() => setAnalyticsConsent("denied")}
        >
          إيقاف التحليلات
        </Button>
      </div>
    </section>
  );
}
