import { useSyncExternalStore } from "react";

export type ThemeId = "glass" | "glass-light";
const KEY = "mizya-theme";

/** يُحقن في <head> ليُطبَّق الثيم المحفوظ قبل أول رسم (بلا وميض). */
export const themeInitScript = `try{var t=localStorage.getItem("${KEY}");if(t==="glass"||t==="glass-light")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export function getTheme(): ThemeId {
  if (typeof document === "undefined") return "glass";
  return document.documentElement.dataset["theme"] === "glass-light" ? "glass-light" : "glass";
}

export function setTheme(theme: ThemeId) {
  document.documentElement.dataset["theme"] = theme;
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    /* التخزين غير متاح: يبقى الاختيار للجلسة فقط */
  }
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** الثيم الحالي، ويُعيد التصيير عند تبديله (للرسوم التي تُبنى ألوانها برمجياً). */
export function useTheme(): ThemeId {
  return useSyncExternalStore(subscribe, getTheme, () => "glass" as ThemeId);
}
