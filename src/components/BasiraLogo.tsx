/**
 * شعار "بصيرة" المعتمد (مطابق للنسخة النهائية).
 * ورقتان (عدسة عين) متقاطعتان قطرياً: العليا بنفسجية #D6B2FC تشير لليمين،
 * والسفلى تركوازية #60F5D2 تشير لليسار (دوران 180° حول المركز)،
 * وفوقهما حدقة داكنة #010A19 وبؤبؤ فاتح #EEF2F7 بداخله أعمدة بيانية ونقطة.
 */

// الورقة العليا: طرف أيسر-أعلى وطرف أيمن حاد، مع بطن منتفخ للأعلى
const LEAF = "M11.9 11.6 C14.3 8.0 21.6 8.6 26.4 16.2 C21.4 18.6 15.6 16.9 11.9 11.6 Z";

const IRIS = { cx: 16.1, cy: 16.1, r: 5.25 };
const PUPIL_R = 3.75;

interface LogoProps {
  className?: string;
  /**
   * النسخة المصغّرة: عين + حدقة + بؤبؤ فقط بلا أعمدة داخلية.
   * تُستخدم تحت ~24px حيث تختفي تفاصيل الأعمدة.
   */
  micro?: boolean;
}

export function BasiraLogo({ className, micro = false }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="بصيرة"
      focusable="false"
      shapeRendering="geometricPrecision"
    >
      {/* الجفن العلوي — بنفسجي */}
      <path d={UPPER} fill="#D6B2FC" />
      {/* الجفن السفلي — تركوازي */}
      <path d={LOWER} fill="#60F5D2" />

      {/* الحدقة بلون خلفية الموقع كي تندمج بسلاسة */}
      <circle cx={IRIS.cx} cy={IRIS.cy} r={IRIS.r} fill="#010A19" />
      {/* البؤبؤ */}
      <circle cx={IRIS.cx} cy={IRIS.cy} r={PUPIL_R} fill="#EEF2F7" />

      {/* أعمدة بيانية متصاعدة داخل البؤبؤ (تُحذف في النسخة المصغّرة) */}
      {!micro && (
        <g fill="#010A19">
          <rect x="13.05" y="15.5" width="1.6" height="2.4" rx="0.35" />
          <rect x="15.2" y="14.3" width="1.6" height="3.6" rx="0.35" />
          <rect x="17.35" y="13.1" width="1.6" height="4.8" rx="0.35" />
        </g>
      )}
    </svg>
  );
}
