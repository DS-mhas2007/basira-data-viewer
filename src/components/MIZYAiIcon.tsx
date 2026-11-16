import { useId, type SVGProps } from "react";
import { cn } from "@/lib/utils";

// Two independently drawn layers keep each silhouette legible at navigation sizes.
const GLYPHS = {
  dashboard: ["M3 3h7v7H3z M14 14h7v7h-7z", "M14 3h7v7h-7z M3 14h7v7H3z"],
  analytics: ["M3 3v18h18 M7 17v-4 M12 17V9 M17 17V5", "m6 9 5-4 4 2 5-5"],
  assistant: ["M5 7h14v12H5z M9 19v2 M15 19v2 M12 3v4 M2 11v4 M22 11v4", "M8 11h1 M15 11h1 M9 15h6 M11 2h2"],
  projects: ["M3 6h7l2 3h9v11H3z", "M3 6V4h7l2 2h7v3 M7 14h10 M7 17h5"],
  reports: ["M5 3h10l4 4v14H5z M15 3v5h4", "M8 17v-3 M12 17v-6 M16 17v-4"],
  settings: ["m9 3-1 3-3 1-2 3 2 2-1 3 2 3h3l2 3 3-1 1-3 3-1 2-3-2-2 1-3-2-3h-3l-2-3z", "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0"],
  alerts: ["M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z M10 21h4", "M3 7 5 4 M19 4l2 3 M12 7v5 M12 14h.01"],
  search: ["M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M15 15l6 6", "M7 10h6 M10 7v6"],
  database: ["M3 6c0-4 18-4 18 0v12c0 4-18 4-18 0z", "M3 6c0 4 18 4 18 0 M3 12c0 4 18 4 18 0"],
  security: ["m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6z", "m8 12 3 3 5-6"],
  cleaning: ["m14 3 3 3-8 9-3-3z M6 12l-3 6 5 3 5-6", "m18 11 1 2 2 1-2 1-1 2-1-2-2-1 2-1z M6 16l-1 3 M9 17l-1 3"],
  insights: ["M8 16c0-2-3-3-3-7a7 7 0 0 1 14 0c0 4-3 5-3 7 M8 18h8 M10 21h4", "m9 10 2 2 4-5 M12 12v4"],
  upload: ["M3 15v6h18v-6", "M12 16V3 m-5 5 5-5 5 5"],
  download: ["M3 15v6h18v-6", "M12 3v13 m-5-5 5 5 5-5"],
  share: ["M8 8l8-4 M8 16l8 4 M7 9v6", "M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M22 3a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M22 21a3 3 0 1 1-6 0 3 3 0 0 1 6 0"],
  filter: ["M3 4h18l-7 8v7l-4 2v-9z", "M8 7h8"],
  success: ["M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0", "m7 12 3 3 7-7"],
  warning: ["m12 3 10 18H2z", "M12 9v5 M12 17h.01"],
  error: ["m7 2-5 5v10l5 5h10l5-5V7l-5-5z", "m8 8 8 8 m0-8-8 8"],
  spark: ["m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z", "M20 2v4 M18 4h4"],
  correlation: ["M3 3v18h18 M6 18 19 5", "M7 13h.01 M10 15h.01 M11 8h.01 M15 10h.01 M18 4h.01 M19 8h.01"],
  distribution: ["M2 20h20 M3 18c4 0 4-14 9-14s5 14 9 14", "M8 18v-6 M12 18V7 M16 18v-6"],
  outliers: ["M3 3v18h18 M6 15h.01 M8 13h.01 M9 17h.01 M12 14h.01 M14 16h.01", "M21 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0"],
  quality: ["M4 18a9 9 0 1 1 16 0 M4 18h16", "m12 14 5-6 M7 10l-1-1 M12 7V5 M18 10l1-1"],
  prediction: ["M3 3v18h18 M5 17l4-5 4 2", "m13 14 4-6 4-3 M17 5h4v4"],
  "feature-engineering": ["M3 5h6v6H3z M15 13h6v6h-6z M9 8h6v8", "M5 8h2 M18 15v2 M17 16h2 M15 4h6 M18 1v6"],
  classification: ["M12 3v6 M5 14v-4h14v4", "M2 16h6v5H2z M16 16h6v5h-6z M10 1h4v4h-4z"],
  regression: ["M3 3v18h18 M5 18 20 5", "M6 14h.01 M9 16h.01 M11 10h.01 M15 12h.01 M18 6h.01"],
  clustering: ["M3 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0 M13 17a5 5 0 1 0 10 0 5 5 0 0 0-10 0", "M6 6h.01 M8 9h.01 M16 16h.01 M19 15h.01 M18 19h.01 M3 20h.01 M20 4h.01"],
  "model-evaluation": ["M4 3h16v18H4z M8 7h8 M8 11h3", "m8 16 2 2 6-5"],
  "confusion-matrix": ["M4 4h16v16H4z M4 12h16 M12 4v16", "m7 8 1 1 2-2 m4 8 1 1 2-2 M15 7l2 2 M17 7l-2 2 M7 15l2 2 M9 15l-2 2"],
  "roc-curve": ["M3 3v18h18 M4 20 20 4", "M4 20c1-11 5-15 16-16"],
  "cross-validation": ["M3 5h18v14H3z M9 5v14 M15 5v14", "M4 8h4 M10 12h4 M16 16h4 M8 2l4-1 4 1 M16 22l-4 1-4-1"],
  "feature-importance": ["M3 3v18h18 M7 7h12 M7 12h8 M7 17h4", "m18 12 1 2 3 1-3 1-1 3-1-3-2-1 2-1z"],
} satisfies Record<string, readonly [string, string]>;

export type MIZYAiIconName = keyof typeof GLYPHS;
export type MIZYAiIconTone = "teal" | "lavender" | "dual";
export interface MIZYAiIconProps extends Omit<SVGProps<SVGSVGElement>, "name" | "children" | "dangerouslySetInnerHTML"> {
  name: MIZYAiIconName;
  tone?: MIZYAiIconTone;
  title?: string;
}

export function MIZYAiIcon({ name, tone = "dual", className, title, "aria-hidden": ariaHidden, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, ...props }: MIZYAiIconProps) {
  const titleId = useId();
  const hidden = ariaHidden ?? !(title || ariaLabel || ariaLabelledBy);
  const [base, accent] = GLYPHS[name];
  return (
    <svg {...props} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false"
      className={cn("mz-brand-icon", `mz-brand-icon--${tone}`, className)}
      role={hidden === true || hidden === "true" ? undefined : "img"}
      aria-hidden={hidden} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy ?? (title ? titleId : undefined)}>
      {title && <title id={titleId}>{title}</title>}
      <path d={base} />
      <path className="mz-brand-icon__accent" d={accent} />
    </svg>
  );
}