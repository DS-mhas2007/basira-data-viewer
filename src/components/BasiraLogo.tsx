/**
 * شعار "بصيرة" — النسخة المعتمدة الجديدة (حرف "b" بتدرج تركوازي/بنفسجي مع أعمدة بيانية).
 */
import logoAsset from "@/assets/basira-logo.png.asset.json";

interface LogoProps {
  className?: string;
  style?: React.CSSProperties;
  /** محجوزة للتوافق مع الاستخدامات المصغّرة. */
  micro?: boolean;
}

export function BasiraLogo({ className, style }: LogoProps) {
  return (
    <img
      src={logoAsset.url}
      alt="بصيرة"
      className={className}
      style={{ objectFit: "contain", ...style }}
      draggable={false}
    />
  );
}
