/**
 * شعار "بصيرة" — ثلاثة اتجاهات تصميمية بخطوط هندسية.
 * جميعها SVG مخصصة (ليست أيقونات جاهزة) وتعمل من 24px حتى 128px.
 */

interface LogoProps {
  className?: string;
  /** معرّف فريد للتدرجات عند وجود أكثر من شعار في الصفحة */
  id?: string;
}

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#60F5D2" />
        <stop offset="65%" stopColor="#60F5D2" />
        <stop offset="100%" stopColor="#D6B2FC" />
      </linearGradient>
    </defs>
  );
}

/** الاتجاه أ: عين هندسية تحتضن خط بياني صاعد كبؤبؤ. */
export function LogoIris({ className, id = "basira-a" }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden focusable="false">
      <Defs id={id} />
      <path
        d="M2.5 16C6 9.5 10.8 6.2 16 6.2S26 9.5 29.5 16C26 22.5 21.2 25.8 16 25.8S6 22.5 2.5 16Z"
        stroke={`url(#${id})`}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 18.6l3.3-3.9 2.7 2.3 4.9-5.4"
        stroke={`url(#${id})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21.4" cy="11.6" r="1.9" fill={`url(#${id})`} />
    </svg>
  );
}

/** الاتجاه ب: قزحية من أعمدة بيانات دائرية داخل حلقة العين. */
export function LogoBars({ className, id = "basira-b" }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden focusable="false">
      <Defs id={id} />
      <circle cx="16" cy="16" r="12.4" stroke={`url(#${id})`} strokeWidth="1.6" opacity="0.55" />
      <path
        d="M4.6 16c3-4.6 6.8-6.9 11.4-6.9S24.4 11.4 27.4 16c-3 4.6-6.8 6.9-11.4 6.9S7.6 20.6 4.6 16Z"
        stroke={`url(#${id})`}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <g stroke={`url(#${id})`} strokeWidth="1.7" strokeLinecap="round">
        <path d="M13 18v-3" />
        <path d="M16 18.6v-5.4" />
        <path d="M19 18v-2" />
      </g>
    </svg>
  );
}

/** الاتجاه ج: نقاط متصلة تشكّل قوس عين وبؤبؤاً في المركز. */
export function LogoConstellation({ className, id = "basira-c" }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden focusable="false">
      <Defs id={id} />
      <path
        d="M3.4 16C7 9.8 11.3 6.7 16 6.7S25 9.8 28.6 16"
        stroke={`url(#${id})`}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M3.4 16c3.6 6.2 7.9 9.3 12.6 9.3S25 22.2 28.6 16"
        stroke={`url(#${id})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.45"
        strokeDasharray="2.6 3"
      />
      <path d="M9.3 13.4l4.6 3.4 4.4-4.6 4 2.6" stroke={`url(#${id})`} strokeWidth="1.4" opacity="0.8" />
      <circle cx="16" cy="16" r="3" stroke={`url(#${id})`} strokeWidth="1.8" />
    </svg>
  );
}

/** الاتجاه المعتمد في الهيدر والـ favicon. */
export const BasiraLogo = LogoIris;