/**
 * شعار "بصيرة" المعتمد.
 * عين هندسية حادة مكوّنة من نصفين متقاطعين: جفن علوي بنفسجي #D6B2FC
 * وجفن سفلي تركوازي #60F5D2 يلتقيان على وتر مائل واحد (بلا فجوات أو تراكب)،
 * وفي مركزها حدقة بلون الخلفية #010A19 وبؤبؤ فاتح #EEF2F7 بداخله أعمدة بيانية.
 */

// هندسة العين: طرفان حادان + وتر مشترك بين النصفين
const A = "1.5 17.5"; // الطرف الأيسر
const B = "30.5 12.5"; // الطرف الأيمن (أعلى قليلاً => ميل ديناميكي)
const UPPER = `M${A} Q16 -4 ${B} Z`; // جفن علوي: منحنى للأعلى ثم وتر مستقيم للعودة
const LOWER = `M${A} L${B} Q16 34 ${A} Z`; // جفن سفلي: وتر ثم منحنى للأسفل

const IRIS = { cx: 16, cy: 15, r: 6.6 };
const PUPIL_R = 4.7;

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
