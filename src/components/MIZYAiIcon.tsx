import * as React from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";

export type MIZYAiIconName =
  | "dashboard" | "analytics" | "assistant" | "projects"
  | "reports" | "settings" | "alerts" | "search"
  | "database" | "security" | "cleaning" | "insights"
  | "upload" | "download" | "share" | "filter"
  | "success" | "warning" | "error" | "spark"
  | "correlation" | "distribution" | "outliers" | "quality" | "prediction"
  | "feature-engineering" | "classification" | "regression" | "clustering"
  | "model-evaluation" | "confusion-matrix" | "roc-curve" | "cross-validation"
  | "feature-importance";

export interface MIZYAiIconProps extends React.SVGProps<SVGSVGElement> {
  name: MIZYAiIconName;
  tone?: "teal" | "lavender" | "dual";
  title?: string;
}

/**
 * Original MIZYAi glass icon family.
 * Each glyph is drawn for the brand rather than wrapping a generic icon font.
 */
export function MIZYAiIcon({
  name,
  tone = "dual",
  title,
  className,
  ...props
}: MIZYAiIconProps) {
  const rawId = useId().replace(/:/g, "");
  const teal = `mz-teal-${rawId}`;
  const lavender = `mz-lavender-${rawId}`;
  const glass = `mz-glass-${rawId}`;
  const glow = `mz-glow-${rawId}`;
  const fill = tone === "teal" ? `url(#${teal})` : tone === "lavender" ? `url(#${lavender})` : `url(#${glass})`;
  const edge = tone === "dual" ? `url(#${glass})` : tone === "teal" ? "#60F5D2" : "#D6B2FC";

  const glyphs: Record<MIZYAiIconName, React.ReactNode> = {
    dashboard: <><rect x="5" y="6" width="17" height="15" rx="4" /><rect x="26" y="6" width="17" height="10" rx="3" /><rect x="26" y="21" width="17" height="21" rx="4" /><rect x="5" y="26" width="17" height="16" rx="4" /><path d="M9 11h9M30 11h9M30 27h9M9 31h9" className="mz-icon-detail" /></>,
    analytics: <><path d="M7 40V25a4 4 0 0 1 4-4h3v19zM21 40V13a4 4 0 0 1 4-4h3v31zM35 40V5h3a4 4 0 0 1 4 4v31z" /><path d="m7 17 10-6 8 3 13-9" className="mz-icon-line" /></>,
    assistant: <><path d="M24 8c-4-5-13-3-15 4-6 2-7 12-2 16-1 8 7 12 14 8l3-4z" /><path d="M24 8c4-5 13-3 15 4 6 2 7 12 2 16 1 8-7 12-14 8l-3-4z" /><path d="M24 8v24M12 17l5 3m-7 8 7-1m19-10-5 3m7 8-7-1" className="mz-icon-line" /><path d="m34 4 2-3 2 3 3 2-3 2-2 3-2-3-3-2z" className="mz-icon-spark" /></>,
    projects: <><path d="M4 14a4 4 0 0 1 4-4h10l5 5h17a4 4 0 0 1 4 4v17a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M5 19h38l-4 16a5 5 0 0 1-5 4H9a5 5 0 0 1-5-5z" className="mz-icon-front" /></>,
    reports: <><path d="M11 4h18l9 9v27a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" /><path d="M29 4v10h9M14 23h19M14 30h19M14 37h12" className="mz-icon-line" /></>,
    settings: <><path d="m20 4 8 0 2 5 5 2 5-2 4 7-4 4v6l4 4-4 7-5-2-5 2-2 5h-8l-2-5-5-2-5 2-4-7 4-4v-6l-4-4 4-7 5 2 5-2z" /><circle cx="24" cy="23" r="8" className="mz-icon-cut" /><circle cx="24" cy="23" r="4" className="mz-icon-line" /></>,
    alerts: <><path d="M24 5a11 11 0 0 0-11 11v7c0 5-3 8-6 11h34c-3-3-6-6-6-11v-7A11 11 0 0 0 24 5z" /><path d="M19 39a5 5 0 0 0 10 0" className="mz-icon-line" /><path d="M24 12v10m0 5v1" className="mz-icon-line" /></>,
    search: <><circle cx="21" cy="20" r="13" /><path d="m31 30 11 11" className="mz-icon-line" /><path d="M13 20a8 8 0 0 1 8-8" className="mz-icon-highlight" /></>,
    database: <><ellipse cx="24" cy="9" rx="17" ry="6" /><path d="M7 9v10c0 4 8 7 17 7s17-3 17-7V9M7 19v10c0 4 8 7 17 7s17-3 17-7V19M7 29v9c0 4 8 7 17 7s17-3 17-7v-9" /><path d="M7 19c0 4 8 7 17 7s17-3 17-7M7 29c0 4 8 7 17 7s17-3 17-7" className="mz-icon-line" /></>,
    security: <><path d="M24 4 41 11v12c0 11-7 18-17 22C14 41 7 34 7 23V11z" /><path d="m15 24 6 6 13-14" className="mz-icon-line" /><path d="M24 8v31" className="mz-icon-detail" /></>,
    cleaning: <><path d="m8 34 20-20 8 8-20 20-8-8z" /><path d="m25 17 8 8M7 9l2-5 2 5 5 2-5 2-2 5-2-5-5-2zM37 7l2-4 2 4 4 2-4 2-2 4-2-4-4-2z" className="mz-icon-spark" /></>,
    insights: <><circle cx="24" cy="24" r="19" /><circle cx="24" cy="24" r="12" className="mz-icon-line" /><circle cx="24" cy="24" r="5" className="mz-icon-line" /><path d="m24 24 15-15" className="mz-icon-line" /><path d="m33 9 6 0 0 6" className="mz-icon-line" /></>,
    upload: <><path d="M8 30v9a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4v-9" /><path d="M24 34V6m-11 11 11-11 11 11" className="mz-icon-line" /></>,
    download: <><path d="M8 30v9a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4v-9" /><path d="M24 6v28m-11-11 11 11 11-11" className="mz-icon-line" /></>,
    share: <><circle cx="10" cy="24" r="6" /><circle cx="38" cy="9" r="6" /><circle cx="38" cy="39" r="6" /><path d="m15 21 17-9M15 27l17 9" className="mz-icon-line" /></>,
    filter: <><path d="M5 7h38L29 24v13l-10 5V24z" /><path d="M13 14h22" className="mz-icon-line" /></>,
    success: <><circle cx="24" cy="24" r="19" /><path d="m13 24 7 7 15-16" className="mz-icon-line" /></>,
    warning: <><path d="M21 6a4 4 0 0 1 7 0l17 29a4 4 0 0 1-3 6H6a4 4 0 0 1-3-6z" /><path d="M24 17v11m0 7v1" className="mz-icon-line" /></>,
    error: <><circle cx="24" cy="24" r="19" /><path d="m17 17 14 14m0-14L17 31" className="mz-icon-line" /></>,
    spark: <><path d="m24 3 5 14 14 7-14 6-5 15-6-15-15-6 15-7z" /><path d="m39 3 2 5 5 2-5 2-2 5-2-5-5-2 5-2z" className="mz-icon-spark" /></>,
    correlation: <><path d="M7 39V8m0 31h34" className="mz-icon-line" /><path d="m11 32 8-10 7 4 12-16" className="mz-icon-line" /><circle cx="11" cy="32" r="3" /><circle cx="19" cy="22" r="3" /><circle cx="26" cy="26" r="3" /><circle cx="38" cy="10" r="3" /></>,
    distribution: <><path d="M5 40h38" className="mz-icon-line" /><path d="M8 38c4-1 5-7 8-16 3-9 6-15 9-15s6 6 9 15c3 9 4 15 8 16z" /><path d="M8 38c4-1 5-7 8-16 3-9 6-15 9-15s6 6 9 15c3 9 4 15 8 16" className="mz-icon-line" /></>,
    outliers: <><path d="M7 40h34M24 8v26m-9-18h18M15 16v14m18-14v14" className="mz-icon-line" /><path d="M24 34v6M15 23v7m18-7v7" className="mz-icon-line" /><circle cx="8" cy="8" r="3" /><circle cx="40" cy="13" r="3" /><circle cx="35" cy="4" r="2" className="mz-icon-spark" /></>,
    quality: <><path d="M24 4 41 11v12c0 11-7 18-17 22C14 41 7 34 7 23V11z" /><path d="m15 24 6 6 13-14" className="mz-icon-line" /><path d="M24 8v7" className="mz-icon-detail" /></>,
    prediction: <><path d="M6 38h36M8 35l9-10 7 4 7-12 10-9" className="mz-icon-line" /><path d="m33 8 8-1-1 8" className="mz-icon-line" /><path d="M8 35h33v5H8z" /></>,
    "feature-engineering": <><path d="M7 24h10m18 0h6M24 7v10m0 14v10" className="mz-icon-line" /><path d="m24 14 7 7-7 7-7-7z" /><circle cx="7" cy="24" r="3" /><circle cx="41" cy="24" r="3" /><circle cx="24" cy="7" r="3" /><circle cx="24" cy="41" r="3" /></>,
    classification: <><path d="M7 40h34M8 8v32" className="mz-icon-line" /><circle cx="15" cy="13" r="3" /><circle cx="21" cy="20" r="3" /><circle cx="13" cy="29" r="3" /><path d="M26 8h13v13H26zM29 29h10v10H29z" /></>,
    regression: <><path d="M7 40h34M8 8v32" className="mz-icon-line" /><path d="m11 34 8-9 7 2 13-17" className="mz-icon-line" /><path d="m33 10 6-1-1 6" className="mz-icon-highlight" /><path d="M11 34 39 10" strokeDasharray="2 3" className="mz-icon-detail" /></>,
    clustering: <><circle cx="15" cy="15" r="4" /><circle cx="25" cy="11" r="3" /><circle cx="18" cy="26" r="3" /><circle cx="34" cy="31" r="4" /><circle cx="28" cy="39" r="2.5" /><path d="M9 8c7-6 20-5 24 2s4 17-3 23-17 5-22-2-5-17 1-23z" className="mz-icon-detail" strokeDasharray="3 3" /></>,
    "model-evaluation": <><path d="M7 40h34M8 8v32" className="mz-icon-line" /><path d="M13 33V22h6v11M23 33V14h6v19M33 33V8h6v25" /><path d="m12 16 8-5 7 1 12-7" className="mz-icon-highlight" /></>,
    "confusion-matrix": <><rect x="7" y="7" width="16" height="16" rx="2" /><rect x="25" y="7" width="16" height="16" rx="2" /><rect x="7" y="25" width="16" height="16" rx="2" /><rect x="25" y="25" width="16" height="16" rx="2" /><path d="M11 11h8v8h-8zM29 29h8v8h-8z" className="mz-icon-highlight" /></>,
    "roc-curve": <><path d="M7 40h34M8 40V8" className="mz-icon-line" /><path d="M8 40 39 9" className="mz-icon-detail" strokeDasharray="3 3" /><path d="M8 40c5-18 9-25 16-27 6-2 10-2 15-4" className="mz-icon-line" /><circle cx="24" cy="13" r="2.5" /></>,
    "cross-validation": <><path d="M10 15a16 16 0 0 1 27-4l3 4M38 33a16 16 0 0 1-27 4l-3-4" className="mz-icon-line" /><path d="m33 6 7 9-10 1M15 42l-7-9 10-1" className="mz-icon-highlight" /><rect x="17" y="18" width="14" height="12" rx="3" /></>,
    "feature-importance": <><path d="M7 40h34M8 8v32" className="mz-icon-line" /><path d="M13 12h24v5H13zM13 22h16v5H13zM13 32h9v5h-9z" /><path d="M37 10v9M29 20v9M22 30v9" className="mz-icon-highlight" /></>,
  };

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={cn("mz-brand-icon", `mz-brand-icon--${tone}`, className)}
      {...props}
    >
      <defs>
        <linearGradient id={teal} x1="5" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D9FFFA" />
          <stop offset=".28" stopColor="#60F5D2" />
          <stop offset=".72" stopColor="#159F9B" />
          <stop offset="1" stopColor="#B5FFF0" />
        </linearGradient>
        <linearGradient id={lavender} x1="5" y1="4" x2="43" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8EFFF" />
          <stop offset=".3" stopColor="#D6B2FC" />
          <stop offset=".72" stopColor="#8D6AD6" />
          <stop offset="1" stopColor="#EBD7FF" />
        </linearGradient>
        <linearGradient id={glass} x1="5" y1="4" x2="43" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D8FFFA" />
          <stop offset=".42" stopColor="#60F5D2" />
          <stop offset=".7" stopColor="#B78BF0" />
          <stop offset="1" stopColor="#E9D5FF" />
        </linearGradient>
        <filter id={glow} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <g
        fill={fill}
        fillOpacity=".24"
        stroke={edge}
        strokeWidth="1.45"
        strokeLinejoin="round"
        strokeLinecap="round"
        filter={`url(#${glow})`}
        className="mz-icon-body"
      >
        {glyphs[name]}
      </g>
      <g
        fill="none"
        stroke="rgba(255,255,255,.82)"
        strokeWidth="1.05"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mz-icon-glint"
      >
        <path d="M9 10 12 7h8" />
        <path d="M31 40h5" />
      </g>
    </svg>
  );
}
