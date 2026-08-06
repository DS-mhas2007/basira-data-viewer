import { useEffect } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { MessageSquare, ArrowUpToLine, RefreshCw, Lock } from "lucide-react";
import type { NavSection } from "@/components/WorkspaceSidebar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: NavSection[];
  onNavigate: (id: string) => void;
  onAsk: () => void;
  onScrollTop: () => void;
  onReset: () => void;
  canReset: boolean;
}

/** لوحة أوامر سريعة (Ctrl/⌘ + K) للتنقل بين أقسام مساحة العمل. */
export function CommandPalette({
  open,
  onOpenChange,
  sections,
  onNavigate,
  onAsk,
  onScrollTop,
  onReset,
  canReset,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function pick(fn: () => void) {
    onOpenChange(false);
    // ندع الحوار يُغلق أولاً حتى لا يتعارض مع التمرير
    setTimeout(fn, 60);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div dir="rtl">
        <CommandInput placeholder="ابحث عن قسم أو إجراء…" />
        <CommandList>
          <CommandEmpty>لا توجد نتائج مطابقة.</CommandEmpty>
          <CommandGroup heading="الأقسام">
            {sections.map((s) => (
              <CommandItem
                key={s.id}
                value={`${s.label} ${s.id}`}
                disabled={!s.enabled}
                onSelect={() => pick(() => onNavigate(s.id))}
              >
                <s.icon className="size-4 text-primary" strokeWidth={2} />
                <span>{s.label}</span>
                {!s.enabled && <Lock className="ms-auto size-3.5 opacity-50" strokeWidth={2} />}
                {s.enabled && s.hint && <CommandShortcut>{s.hint}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="إجراءات">
            <CommandItem value="اسأل بياناتك الذكاء" onSelect={() => pick(onAsk)}>
              <MessageSquare className="size-4 text-primary" strokeWidth={2} />
              <span>اسأل بياناتك</span>
            </CommandItem>
            <CommandItem value="أعلى الصفحة" onSelect={() => pick(onScrollTop)}>
              <ArrowUpToLine className="size-4 text-primary" strokeWidth={2} />
              <span>الانتقال لأعلى الصفحة</span>
            </CommandItem>
            <CommandItem
              value="ملف جديد إعادة تعيين"
              disabled={!canReset}
              onSelect={() => pick(onReset)}
            >
              <RefreshCw className="size-4 text-primary" strokeWidth={2} />
              <span>بدء من جديد (ملف آخر)</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </div>
    </CommandDialog>
  );
}
