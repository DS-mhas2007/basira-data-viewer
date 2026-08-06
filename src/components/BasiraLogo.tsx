/**
 * شعار "بصيرة" المعتمد (مطابق للنسخة النهائية).
 * ورقتان (عدسة عين) متقاطعتان قطرياً: العليا بنفسجية #D6B2FC تشير لليمين،
 * والسفلى تركوازية #60F5D2 تشير لليسار (دوران 180° حول المركز)،
 * وفوقهما حدقة داكنة #010A19 وبؤبؤ فاتح #EEF2F7 بداخله أعمدة بيانية ونقطة.
 */

// الورقة العليا: طرف أيسر-أعلى وطرف أيمن حاد، مع بطن منتفخ للأعلى
const LEAF = "M11.4 11.2 C14.6 7.2 21.8 8.2 26.8 16.3 C21.2 19.4 15.2 17.4 11.4 11.2 Z";

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
      <defs>
        <clipPath id="basira-pupil">
          <circle cx={IRIS.cx} cy={IRIS.cy} r={PUPIL_R} />
        </clipPath>
      </defs>
      {/* الورقة العليا — بنفسجي */}
      <path d={LEAF} fill="#D6B2FC" />
      {/* الورقة السفلى — تركوازي (نفس الشكل مدوّراً 180°) */}
      <path d={LEAF} fill="#60F5D2" transform="rotate(180 16.1 16.1)" />

      {/* الحدقة بلون خلفية الموقع كي تندمج بسلاسة */}
      <circle cx={IRIS.cx} cy={IRIS.cy} r={IRIS.r} fill="#010A19" />
      {/* البؤبؤ */}
      <circle cx={IRIS.cx} cy={IRIS.cy} r={PUPIL_R} fill="#EEF2F7" />

      {/* أعمدة بيانية متصاعدة داخل البؤبؤ (تُحذف في النسخة المصغّرة) */}
      {!micro && (
        <g fill="#010A19" clipPath="url(#basira-pupil)">
          <rect x="13.75" y="17.1" width="1.05" height="2.35" />
          <rect x="15.55" y="16.0" width="1.05" height="3.45" />
          <rect x="17.35" y="14.6" width="1.05" height="4.85" />
          <circle cx="16.08" cy="15.35" r="0.95" />
        </g>
      )}
    </svg>
  );
}
