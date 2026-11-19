import type { LucideIcon } from "@/components/icons";

/** أيقونة التنقل: نفس مجموعة الأيقونات الموحّدة (Phosphor light) المستخدمة في بقية الواجهة. */
export function MIZYAiNavIcon({
  fallback: Icon,
  className,
}: {
  id: string;
  fallback: LucideIcon;
  className?: string;
}) {
  return <Icon className={className} aria-hidden />;
}
