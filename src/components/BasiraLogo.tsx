/**
 * شعار "بصيرة" — ثلاثة اتجاهات إبداعية مختلفة تماماً.
 * جميعها SVG مخصصة، واضحة من 24px حتى 128px.
 */

interface LogoProps {
  className?: string;
  /** معرّف فريد للتدرجات عند وجود أكثر من شعار في الصفحة */
  id?: string;
  /** تفعيل الحركة الخفيفة عند التحميل */
  animate?: boolean;
}

function Grad({ id, from = "#60F5D2", to = "#D6B2FC", x2 = "1", y2 = "1" }: {
  id: string; from?: string; to?: string; x2?: string; y2?: string;
}) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={Number(x2) * 32} y2={Number(y2) * 32}>
      <stop offset="0%" stopColor={from} />
      <stop offset="100%" stopColor={to} />
    </linearGradient>
  );
}

/* ─────────────────────────────────────────────────────────────
   الاتجاه 1 — العين الذكية الحية
   عين بخط واحد متصل، والبؤبؤ رسم بياني نابض.
   ───────────────────────────────────────────────────────────── */
export function LogoLivingEye({ className, id = "eye", animate = true }: LogoProps) {
  const g = `${id}-g`;
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden focusable="false">
      <defs>
        <Grad id={g} />
        <linearGradient id={`${g}-b`} gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="11">
          <stop offset="0%" stopColor="#60F5D2" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#60F5D2" />
        </linearGradient>
      </defs>

      {/* خط واحد متصل يرسم العين ويلتف كذيل */}
      <path
        d="M1.8 16.2C6.4 8.6 11.1 4.8 16.4 4.8c5.3 0 10 3.8 13.8 11.4-3.8 7.6-8.5 11.4-13.8 11.4-4.2 0-8.1-2.4-11.6-7.2"
        stroke={`url(#${g})`}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          animate
            ? { strokeDasharray: 78, ["--dash" as string]: 78, animation: "logo-draw 1.1s ease-out both" }
            : undefined
        }
      />

      {/* البؤبؤ = رسم بياني صغير */}
      <g stroke={`url(#${g}-b)`} strokeWidth="2.1" strokeLinecap="round">
        {[
          { x: 12.6, y1: 19.4, y2: 15.6, d: "0.15s" },
          { x: 16.4, y1: 19.4, y2: 12.4, d: "0.3s" },
          { x: 20.2, y1: 19.4, y2: 16.6, d: "0.45s" },
        ].map((b) => (
          <path
            key={b.x}
            d={`M${b.x} ${b.y1}V${b.y2}`}
            style={
              animate
                ? {
                    transformOrigin: `${b.x}px 19.4px`,
                    animation: `logo-bar 0.9s cubic-bezier(0.22,1,0.36,1) ${b.d} both`,
                  }
                : undefined
            }
          />
        ))}
      </g>
      <circle cx="24.6" cy="10.4" r="1.5" fill="#D6B2FC" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   الاتجاه 2 — الحرف الرمزي المدمج (ب) مع عين في الفراغ السالب
   ───────────────────────────────────────────────────────────── */
export function LogoGlyph({ className, id = "glyph" }: LogoProps) {
  const g = `${id}-g`;
  const mask = `${id}-m`;
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={g} gradientUnits="userSpaceOnUse" x1="2" y1="4" x2="30" y2="28">
          <stop offset="0%" stopColor="#60F5D2" />
          <stop offset="55%" stopColor="#7FE9E0" />
          <stop offset="100%" stopColor="#D6B2FC" />
        </linearGradient>
        <mask id={mask}>
          <rect width="32" height="32" fill="black" />
          {/* جسم الحرف "ب": وعاء أفقي بطرف صاعد */}
          <path
            d="M4.6 8.8v7.4c0 4 3.2 7.2 7.2 7.2h12.4c2 0 3.6-1.6 3.6-3.6"
            stroke="white"
            strokeWidth="8.4"
            strokeLinecap="round"
            fill="none"
          />
          {/* الفراغ السالب: عين مختبئة داخل انحناء الحرف */}
          <path
            d="M8.2 19.4c2.4-3.9 5-5.9 7.9-5.9s5.5 2 7.9 5.9c-2.4 3.9-5 5.9-7.9 5.9s-5.5-2-7.9-5.9Z"
            fill="black"
          />
          <circle cx="16.1" cy="19.4" r="2.1" fill="white" />
        </mask>
      </defs>
      <rect width="32" height="32" fill={`url(#${g})`} mask={`url(#${mask})`} />
      {/* نقطة الحرف "ب" */}
      <circle cx="16.1" cy="29.2" r="1.8" fill="#D6B2FC" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   الاتجاه 3 — البصمة البصرية للبيانات
   فوضى نقاط تتكثف تدريجياً حتى تصبح منحنى واضحاً.
   ───────────────────────────────────────────────────────────── */
export function LogoDataprint({ className, id = "print" }: LogoProps) {
  const g = `${id}-g`;
  const dots: Array<[number, number, number, number]> = [
    [4.2, 8.4, 1.5, 0.22],
    [8.4, 22.6, 1.9, 0.3],
    [6.6, 15.4, 1.2, 0.26],
    [11.6, 9.2, 1.6, 0.42],
    [10.4, 18.4, 2.2, 0.5],
    [14.8, 22.4, 1.5, 0.6],
    [15.6, 12.6, 1.9, 0.7],
    [19.6, 17.8, 1.6, 0.82],
  ];
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={g} gradientUnits="userSpaceOnUse" x1="3" y1="27" x2="29" y2="5">
          <stop offset="0%" stopColor="#D6B2FC" />
          <stop offset="55%" stopColor="#8FE7E4" />
          <stop offset="100%" stopColor="#60F5D2" />
        </linearGradient>
      </defs>

      {/* المنحنى الواضح الناتج عن التجمّع */}
      <path
        d="M3.6 25.8C10.2 25.4 15.4 21.6 19 15.2c2-3.6 4.6-6.2 8.6-8"
        stroke={`url(#${g})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* النقاط: من فوضى باهتة إلى تركيز زاهٍ */}
      {dots.map(([cx, cy, r, o]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={`url(#${g})`} opacity={o} />
      ))}
      <circle cx="27.4" cy="6.6" r="2.6" fill="#60F5D2" />
      <circle cx="27.4" cy="6.6" r="5.2" stroke="#60F5D2" strokeWidth="1.2" opacity="0.35" />
    </svg>
  );
}

export const LOGO_DIRECTIONS = [
  { key: "living-eye", name: "الاتجاه 1 — العين الذكية الحية", desc: "خط واحد متصل وبؤبؤ نابض على هيئة رسم بياني", Comp: LogoLivingEye },
  { key: "glyph", name: "الاتجاه 2 — الحرف الرمزي المدمج", desc: "حرف «ب» بتدرج جريء وعين مخفية في الفراغ السالب", Comp: LogoGlyph },
  { key: "dataprint", name: "الاتجاه 3 — البصمة البصرية للبيانات", desc: "نقاط فوضوية تتكثف حتى تشكّل منحنى واضحاً", Comp: LogoDataprint },
] as const;

/** الاتجاه المستخدم حالياً في الهيدر (بانتظار اختيارك النهائي). */
export const BasiraLogo = LogoLivingEye;
