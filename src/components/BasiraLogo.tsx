/**
 * شعار "بصيرة" النهائي.
 * حرف «ب» هندسي على هيئة فقاعة حوار (البيانات تتحدث)، وبداخله
 * أعمدة بيانية متصاعدة مع خط اتجاه صاعد ونقاط، ونقطة الحرف أسفله.
 */

interface LogoProps {
  className?: string;
  /** معرّف فريد للتدرجات عند تكرار الشعار في نفس الصفحة */
  id?: string;
}

export function BasiraLogo({ className, id = "basira" }: LogoProps) {
  const gBody = `${id}-body`;
  const gBar = `${id}-bar`;
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gBody} gradientUnits="userSpaceOnUse" x1="16" y1="3" x2="16" y2="29">
          <stop offset="0%" stopColor="#60F5D2" />
          <stop offset="55%" stopColor="#2FA79B" />
          <stop offset="100%" stopColor="#0D4550" />
        </linearGradient>
        <linearGradient id={gBar} gradientUnits="userSpaceOnUse" x1="16" y1="9" x2="16" y2="22">
          <stop offset="0%" stopColor="#60F5D2" />
          <stop offset="100%" stopColor="#166A66" />
        </linearGradient>
      </defs>

      {/* جسم حرف «ب» / فقاعة الحوار بذيل صغير أسفل اليمين */}
      <path
        d="M9.2 4.4h13.6A5.6 5.6 0 0 1 28.4 10v7.2a5.6 5.6 0 0 1-5.6 5.6h-8.2l-4.9 3.9c-.7.6-1.7.1-1.7-.8v-3.3A5.6 5.6 0 0 1 3.6 17.2V10a5.6 5.6 0 0 1 5.6-5.6Z"
        stroke={`url(#${gBody})`}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />

      {/* أعمدة متصاعدة */}
      <g stroke={`url(#${gBar})`} strokeWidth="2.3" strokeLinecap="round">
        <path d="M10 18.4v-2.6" />
        <path d="M16 18.4v-4.8" />
        <path d="M22 18.4v-7.2" />
      </g>

      {/* خط الاتجاه الصاعد بلون تركوازي صافٍ */}
      <path
        d="M10 13.2 16 11l6-3.2"
        stroke="#60F5D2"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="13.2" r="1.35" fill="#60F5D2" />
      <circle cx="16" cy="11" r="1.35" fill="#60F5D2" />
      {/* آخر نقطة: لمسة بنفسجية خفيفة */}
      <circle cx="22" cy="7.8" r="1.6" fill="#D6B2FC" />

      {/* نقطة حرف «ب» */}
      <circle cx="16" cy="29.4" r="1.5" fill={`url(#${gBar})`} />
    </svg>
  );
}
