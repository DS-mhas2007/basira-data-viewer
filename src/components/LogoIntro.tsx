import { useEffect, useState } from "react";
import { BasiraLogo } from "@/components/BasiraLogo";

const DURATION = 2400;

/** انترو دخول: يظهر الشعار متحركاً ثم يتلاشى ليكشف التطبيق. */
export function LogoIntro() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDone(true);
      return;
    }
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => setDone(true), DURATION);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (done) document.body.style.overflow = "";
  }, [done]);

  if (done) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background"
      style={{ animation: `intro-out 500ms ease-in ${DURATION - 500}ms forwards` }}
    >
      <div className="relative flex items-center justify-center">
        {/* حلقات نبض خافتة */}
        <span
          className="absolute size-36 rounded-full border border-primary/25"
          style={{ animation: "intro-ring 1.6s ease-out 250ms both" }}
        />
        <span
          className="absolute size-36 rounded-full border border-accent/22"
          style={{ animation: "intro-ring 1.6s ease-out 600ms both" }}
        />
        {/* توهج خلفي ناعم */}
        <span className="absolute size-40 rounded-full bg-primary/5 blur-2xl" />

        <div
          className="relative size-28 overflow-hidden"
          style={{ animation: "intro-logo-in 1s cubic-bezier(0.22, 1, 0.36, 1) both" }}
        >
          <BasiraLogo className="size-full" />
          {/* لمعة تمر فوق الشعار بشكل خفيف */}
          <span
            className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-l from-transparent via-white/25 to-transparent"
            style={{ animation: "intro-sweep 1.1s ease-out 900ms both" }}
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <h1
          className="font-display text-4xl font-extrabold tracking-tight text-foreground"
          style={{ animation: "intro-word 700ms cubic-bezier(0.22, 1, 0.36, 1) 550ms both" }}
        >
          بصيرة
        </h1>
        <p
          className="text-xs text-muted-foreground"
          style={{ animation: "intro-word 700ms cubic-bezier(0.22, 1, 0.36, 1) 800ms both" }}
        >
          تحليل بياناتك محلياً في متصفحك
        </p>
      </div>
    </div>
  );
}
