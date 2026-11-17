import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setTheme, useTheme } from "@/lib/theme";

/** تبديل الثيم الزجاجي: داكن ⇄ فاتح (يُحفظ في المتصفح). */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const light = theme === "glass-light";
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => setTheme(light ? "glass" : "glass-light")}
      aria-label={light ? "التبديل إلى الثيم الداكن" : "التبديل إلى الثيم الفاتح"}
      title={light ? "الثيم الداكن" : "الثيم الفاتح"}
      className={
        className ?? "size-9 rounded-xl border-border/70 bg-surface-1 text-muted-foreground"
      }
    >
      {light ? (
        <Moon className="size-4" strokeWidth={2} />
      ) : (
        <Sun className="size-4" strokeWidth={2} />
      )}
    </Button>
  );
}
