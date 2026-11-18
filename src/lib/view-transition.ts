import { flushSync } from "react-dom";

type VTDocument = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

const reduced = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function supportsViewTransition(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof (document as VTDocument).startViewTransition === "function" &&
    !reduced()
  );
}

/**
 * ينفّذ تغيير الحالة داخل View Transition (تلاشٍ سلس بين الصفحتين/الثيمين)،
 * ويرجع للتنفيذ المباشر إن لم يدعمها المتصفح أو فُعّل تقليل الحركة.
 */
export function withViewTransition(kind: "theme", update: () => void) {
  if (!supportsViewTransition()) {
    update();
    return;
  }
  const root = document.documentElement;
  root.dataset["vt"] = kind;
  const t = (document as VTDocument).startViewTransition!(() => flushSync(update));
  const done = () => {
    delete root.dataset["vt"];
  };
  t.finished.then(done, done);
}
