/**
 * مكوّن الشعار المتوافق مع هوية MIZYAi.
 * نحافظ على ملف الصورة الحالي حتى اعتماد ملف الشعار النهائي رسمياً.
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
      alt="MIZYAi"
      className={className}
      style={{ objectFit: "contain", display: "block", flexShrink: 0, ...style }}
      draggable={false}
    />
  );
}
