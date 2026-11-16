import type { LucideIcon } from "lucide-react";
import { MIZYAiIcon } from "@/components/MIZYAiIcon";
import { mizyaNavGlyph } from "@/lib/mizya-nav-icons";

export function MIZYAiNavIcon({
  id,
  fallback: Fallback,
  className,
}: {
  id: string;
  fallback: LucideIcon;
  className?: string;
}) {
  const name = mizyaNavGlyph(id);
  return name ? (
    <MIZYAiIcon
      name={name}
      tone={name === "assistant" || name === "insights" ? "lavender" : "teal"}
      className={className}
      aria-hidden
    />
  ) : (
    <Fallback className={className} strokeWidth={2} aria-hidden />
  );
}
