import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";

export const CLOUD_AI_CONSENT_KEY = "mizyai:cloud-ai-consent:v1";
const CONSENT_EVENT = "mizyai:cloud-ai-consent-changed";

export function useCloudAiConsent() {
  const [cloudAiConsent, setCloudAiConsentState] = useState(false);
  const [cloudAiConsentReady, setCloudAiConsentReady] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        setCloudAiConsentState(window.localStorage.getItem(CLOUD_AI_CONSENT_KEY) === "1");
      } catch {
        setCloudAiConsentState(false);
      } finally {
        setCloudAiConsentReady(true);
      }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener(CONSENT_EVENT, read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener(CONSENT_EVENT, read);
    };
  }, []);

  function setCloudAiConsent(value: boolean) {
    setCloudAiConsentState(value);
    try {
      if (value) window.localStorage.setItem(CLOUD_AI_CONSENT_KEY, "1");
      else window.localStorage.removeItem(CLOUD_AI_CONSENT_KEY);
    } catch {
      // إذا تعذّر حفظ التفضيل، يبقى القرار الحالي في الذاكرة فقط؛ الخادم يشترط الإذن بكل طلب.
    }
    window.dispatchEvent(new Event(CONSENT_EVENT));
  }

  return { cloudAiConsent, cloudAiConsentReady, setCloudAiConsent };
}

export function CloudAiConsentControl({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="mz-glass-inset flex cursor-pointer items-start gap-2.5 rounded-xl border border-border/60 px-3 py-2.5 text-[11px] text-muted-foreground">
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-label="السماح بإرسال البيانات إلى AI سحابي"
        className="mt-0.5 shrink-0"
      />
      <span className="leading-relaxed">
        <span className="font-semibold text-foreground">السماح باستخدام AI سحابي</span>
        <span className="block">
          عند تشغيله، يُرسل السؤال والبيانات اللازمة للتحليل إلى مزوّد AI (مثل مخطط الأعمدة وعينة
          محدودة أو نتائج الأدوات/الملخص). لا يُرسل الملف كاملاً في مسارات التحليل، والتحليل المحلي لا
          يحتاج هذا الإذن. هذا الخيار مستقل عن حفظ المحادثة ويمكن إيقافه في أي وقت.
        </span>
        <span className="mt-1 block font-medium" role="status">
          {checked
            ? "الإرسال السحابي مسموح حالياً."
            : "مغلق افتراضياً: لن يُرسل أي طلب إلى مزوّد AI حتى توافق."}
        </span>
      </span>
    </label>
  );
}
