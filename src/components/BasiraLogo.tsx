/** أيقونة MIZYAi الرسمية؛ المسار مطلق ليعمل في جميع الصفحات والمسارات. */

interface LogoProps {
  className?: string;
  style?: React.CSSProperties;
  /** محجوزة للتوافق مع الاستخدامات المصغّرة. */
  micro?: boolean;
}

export function BasiraLogo({ className, style }: LogoProps) {
  return (
    <img
      src="/brand/mizya-icon.svg"
      alt="MIZYAi"
      className={className}
      style={{ objectFit: "contain", display: "block", flexShrink: 0, ...style }}
      draggable={false}
    />
  );
}

/** الشعار الأفقي الكامل (أيقونة + MIZYAi): تُعرض النسخة المناسبة للثيم الحالي عبر CSS. */
export function MizyaLockup({ className, style }: LogoProps) {
  const base = { objectFit: "contain", flexShrink: 0, ...style } as const;
  return (
    <>
      <img
        src="/brand/mizya-lockup-horizontal-light-640.png"
        alt="MIZYAi"
        className={`mizya-lockup-light block ${className ?? ""}`}
        style={base}
        draggable={false}
      />
      <img
        src="/brand/mizya-lockup-horizontal-dark-640.png"
        alt=""
        aria-hidden
        className={`mizya-lockup-dark ${className ?? ""}`}
        style={base}
        draggable={false}
      />
    </>
  );
}
