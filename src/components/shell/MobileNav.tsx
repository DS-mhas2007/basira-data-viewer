import { MoreHorizontal, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export interface MobileNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  enabled: boolean;
}

interface Props {
  items: MobileNavItem[];
  primaryIds: string[];
  activeId: string;
  onNavigate: (id: string) => void;
  onAsk: () => void;
  askEnabled: boolean;
}

/** تنقّل سفلي للجوال — الإجراء المحوري "اسأل بصيرة" في المنتصف. */
export function MobileNav({ items, primaryIds, activeId, onNavigate, onAsk, askEnabled }: Props) {
  const primary = primaryIds
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is MobileNavItem => !!i);
  const rest = items.filter((i) => !primaryIds.includes(i.id));

  return (
    <nav
      aria-label="التنقّل الرئيسي"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-end px-1">
        {primary.slice(0, 2).map((item) => (
          <NavCell key={item.id} item={item} active={activeId === item.id} onClick={onNavigate} />
        ))}

        <li className="flex justify-center">
          <button
            type="button"
            onClick={onAsk}
            disabled={!askEnabled}
            aria-label="اسأل بصيرة"
            className="-mt-5 flex size-14 flex-col items-center justify-center gap-0.5 rounded-2xl border border-primary/40 bg-primary text-primary-foreground shadow-ai transition-transform duration-200 active:scale-95 disabled:opacity-40"
          >
            <Sparkles className="size-5" strokeWidth={2.25} />
            <span className="text-[9px] font-bold leading-none">اسأل</span>
          </button>
        </li>

        {primary.slice(2, 4).map((item) => (
          <NavCell key={item.id} item={item} active={activeId === item.id} onClick={onNavigate} />
        ))}

        {primary.length < 4 && <li />}

        <li className="min-w-0">
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="المزيد من الأقسام"
                className="flex min-h-[56px] w-full min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-muted-foreground transition-colors duration-200"
              >
                <MoreHorizontal className="size-[18px] shrink-0" strokeWidth={2} />
                <span className="w-full truncate text-center text-[10px] font-medium leading-none">
                  المزيد
                </span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl border-border/60 bg-card pb-8">
              <SheetHeader className="text-start">
                <SheetTitle className="font-display text-base font-bold">مساحة العمل</SheetTitle>
              </SheetHeader>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {rest.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!item.enabled}
                    onClick={() => onNavigate(item.id)}
                    className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start text-xs font-medium transition-colors duration-200 disabled:opacity-40 ${
                      activeId === item.id
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/60 bg-surface-1 text-foreground/90"
                    }`}
                  >
                    <item.icon className="size-4 shrink-0" strokeWidth={2} />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}

function NavCell({
  item,
  active,
  onClick,
}: {
  item: MobileNavItem;
  active: boolean;
  onClick: (id: string) => void;
}) {
  return (
    <li className="min-w-0">
      <button
        type="button"
        disabled={!item.enabled}
        aria-current={active ? "page" : undefined}
        onClick={() => onClick(item.id)}
        className={`flex min-h-[56px] w-full min-w-0 flex-col items-center justify-center gap-1 px-0.5 transition-colors duration-200 disabled:opacity-35 ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <item.icon className="size-[18px] shrink-0" strokeWidth={2} />
        <span className="w-full truncate text-center text-[10px] font-medium leading-none">
          {item.label}
        </span>
      </button>
    </li>
  );
}
