/**
 * شعار "بصيرة" — النسخة المعتمدة الجديدة (حرف "b" بتدرج تركوازي/بنفسجي مع أعمدة بيانات).
 * المسار مطلق من جذر الموقع (/basira-logo.png) لضمان تحميله بشكل صحيح من أي مسار.
 */

interface LogoProps {
  className?: string;
  style?: React.CSSProperties;
  /** محجوزة للتوافق مع الاستخدامات المصغّرة. */
  micro?: boolean;
}

export function BasiraLogo({ className, style }: LogoProps) {
  return (
    <img
      src="/basira-logo.png"
      alt="بصيرة"
      className={className}
      style={{ objectFit: "contain", display: "block", flexShrink: 0, ...style }}
      draggable={false}
    />
  );
}
