/**
 * جولة تعريفية بؤرية (Spotlight Tour) من 3 خطوات — تظهر مرة واحدة لأول زيارة.
 * بلا مكتبات خارجية: قناع مظلم + إطار مضيء حول العنصر المستهدف + بطاقة شرح.
 */
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { ArrowLeft, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "basira-tour-v1";

const STEPS: { selector: string; title: string; body: string }[] = [
  {
    selector: '[data-tour="upload"]',
    title: "ارفع ملفك هنا — محلياً",
    body: "اسحب ملف CSV أو XLSX وأفلته، أو جرّب إحدى مجموعات البيانات الجاهزة. لا يغادر أي ملف جهازك.",
  },
  {
    selector: '[data-tour-nav="health"]',
    title: "افحص جودة البيانات ونظّفها",
    body: "احصل على درجة جودة من 100، ثم نظّف القيم المفقودة والصفوف المكررة بضغطة زر — مع تراجع وإعادة في أي وقت.",
  },
  {
    selector: '[data-tour="export"]',
    title: "اختر نوع التقرير وصدّره",
    body: "تقرير تنفيذي للمدراء، أو تحليلي مفصّل — يُصدَّر PDF عربي كامل من داخل متصفحك.",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function SpotlightTour() {
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => setStep(0), 3200);
    return () => clearTimeout(t);
  }, []);

  const measure = useCallback(() => {
    if (step === null) return;
    const el = document.querySelector(STEPS[step]!.selector);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    if (step === null) return;
    const el = document.querySelector(STEPS[step]!.selector);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(measure, 320);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, measure]);

  function finish() {
    localStorage.setItem(STORAGE_KEY, "done");
    setStep(null);
  }

  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  if (step === null) return null;
  const current = STEPS[step]!;
  const pad = 8;
  const below = rect ? rect.top + rect.height + 16 : 0;
  const cardTop =
    rect && below + 190 < window.innerHeight ? below : rect ? Math.max(16, rect.top - 200) : 120;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="جولة تعريفية">
      {/* القناع البؤري */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-2xl border-2 border-primary/70 transition-all duration-300"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow:
              "0 0 0 9999px rgba(1,10,25,0.82), 0 0 40px rgba(96,245,210,0.35) inset, 0 0 40px rgba(96,245,210,0.25)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-background/85 backdrop-blur-[2px]" />
      )}

      {/* بطاقة الشرح */}
      <div
        className="glass rise-in absolute w-[min(360px,calc(100vw-2rem))] rounded-2xl p-4 shadow-2xl"
        style={{
          top: cardTop,
          left: rect
            ? Math.min(Math.max(16, rect.left + rect.width / 2 - 180), window.innerWidth - 376)
            : "50%",
          transform: rect ? undefined : "translateX(-50%)",
        }}
      >
        <div className="flex items-start gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Sparkles className="size-4" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold">{current.title}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{current.body}</p>
          </div>
          <button
            type="button"
            onClick={finish}
            aria-label="إغلاق الجولة"
            className="rounded-lg p-1 text-muted-foreground transition hover:text-foreground"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={
                  i === step
                    ? "h-1.5 w-5 rounded-full bg-primary transition-all"
                    : "size-1.5 rounded-full bg-muted-foreground/40 transition-all"
                }
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={finish}
              className="h-8 rounded-lg px-2 text-xs text-muted-foreground"
            >
              تخطي
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => (step >= STEPS.length - 1 ? finish() : setStep(step + 1))}
              className="glow-cta h-8 gap-1.5 rounded-lg px-3 text-xs font-bold"
            >
              {step >= STEPS.length - 1 ? "ابدأ الآن" : "التالي"}
              <ArrowLeft className="size-3.5" strokeWidth={2.25} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
