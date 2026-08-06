/**
 * شعار "بصيرة" — نسخة معتمدة، هندسة مضبوطة بأقواس دائرية دقيقة.
 * هلالان متقاطعان (بنفسجي أعلى #D6B2FC، تركوازي أسفل #60F5D2) بتماثل دوراني 180°،
 * وفي المركز حدقة داكنة #010A19 وبؤبؤ فاتح #EEF2F7 بداخله أعمدة بيانية ونقطة نمو تركوازية.
 */

// هلال مبني على قوسين: قوس خارجي منتفخ وقوس داخلي ضحل (نصف الطول 10.8)
const CRESCENT =
  "M -10.8 0 A 13.815 13.815 0 0 1 10.8 0 A 42.357 42.357 0 0 0 -10.8 0 Z";

const PLACE = "translate(16 13.1) rotate(-22)";
const IRIS_R = 5.9;
const PUPIL_R = 4.2;

interface LogoProps {
  className?: string;
  style?: React.CSSProperties;
  /** نسخة مصغّرة (تحت ~24px): بدون الأعمدة الداخلية لضمان الوضوح. */
  micro?: boolean;
}

export function BasiraLogo({ className, style, micro = false }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label="بصيرة"
      focusable="false"
      shapeRendering="geometricPrecision"
    >
      <defs>
        <clipPath id="basira-pupil">
          <circle cx="16" cy="16" r={PUPIL_R} />
        </clipPath>
      </defs>

      {/* الجفن العلوي — بنفسجي */}
      <g transform={PLACE}>
        <path d={CRESCENT} fill="#D6B2FC" />
      </g>
      {/* الجفن السفلي — تركوازي (نفس الشكل بدوران 180° حول المركز) */}
      <g transform="rotate(180 16 16)">
        <g transform={PLACE}>
          <path d={CRESCENT} fill="#60F5D2" />
        </g>
      </g>

      {/* الحدقة بلون الخلفية لتفصل العين عن الجفون */}
      <circle cx="16" cy="16" r={IRIS_R} fill="#010A19" />
      {/* البؤبؤ */}
      <circle cx="16" cy="16" r={PUPIL_R} fill="#EEF2F7" />

      {!micro && (
        <g clipPath="url(#basira-pupil)">
          <g fill="#010A19">
            <rect x="12.78" y="16.73" width="1.32" height="2.93" rx="0.44" />
            <rect x="15.33" y="15.56" width="1.32" height="4.10" rx="0.44" />
            <rect x="17.91" y="14.19" width="1.32" height="5.47" rx="0.44" />
          </g>
          {/* نقطة النمو */}
          <circle cx="18.56" cy="13.03" r="0.98" fill="#60F5D2" />
        </g>
      )}
    </svg>
  );
}
