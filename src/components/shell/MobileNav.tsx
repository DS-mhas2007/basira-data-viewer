import { MoreHorizontal } from "lucide-react";
import { MIZYAiIcon } from "@/components/MIZYAiIcon";
import type { LucideIcon } from "lucide-react";
import { MIZYAiIcon, type MIZYAiIconName } from "@/components/MIZYAiIcon";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV_GLYPHS: Partial<Record<string, MIZYAiIconName>> = {\n  home: "dashboard", data: "database", quality: "quality", analysis: "analytics",\n  ask: "assistant", insights: "insights", whatif: "prediction", reports: "reports",\n  board: "dashboard", alerts: "alerts", templates: "projects",\n};\n\nexport interface MobileNavItem {
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
  // خمسة أعمدة فقط: عنصران + زر «اسأل» + عنصر + «المزيد».
  const primary = primaryIds
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is MobileNavItem => !!i)
    .slice(0, 3);
  const primarySet = new Set(primary.map((i) => i.id));
  const rest = items.filter((i) => !primarySet.has(i.id));

  return (
    <nav
      aria-label="التنقّل الرئيسي"
      className="basira-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#07152D]/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_36px_rgba(0,0,0,.24)] backdrop-blur-2xl md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-center px-1">
        {primary.slice(0, 2).map((item) => (
          <NavCell key={item.id} item={item} active={activeId === item.id} onClick={onNavigate} />
        ))}
        {primary.length < 2 &&
          Array.from({ length: 2 - primary.length }).map((_, i) => <li key={`p${i}`} />)}

        <li className="flex justify-center">
          <button
            type="button"
            onClick={onAsk}
            disabled={!askEnabled}
            aria-label="اسأل MIZYAi"
            className="-mt-6 flex size-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-primary/40 bg-primary text-primary-foreground shadow-ai transition-transform duration-200 active:scale-95 disabled:opacity-40"
          >
            <MIZYAiIcon name="assistant" className="size-6" tone="dual" />
            <span className="text-[9px] font-bold leading-none">اسأل</span>
          </button>
        </li>

        {primary.slice(2, 3).map((item) => (
          <NavCell key={item.id} item={item} active={activeId === item.id} onClick={onNavigate} />
        ))}
        {primary.length < 3 && <li />}

        <li className="min-w-0">
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="المزيد من الأقسام"
                className={`flex min-h-[56px] w-full min-w-0 flex-col items-center justify-center gap-1 px-0.5 transition-colors duration-200 ${
                  rest.some((i) => i.id === activeId) ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <MoreHorizontal className="size-[18px] shrink-0" strokeWidth={2} />
                <span className="w-full truncate text-center text-[10px] font-medium leading-none">
                  المزيد
                </span>
              </button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="mz-glass-card mz-glass-card--dual max-h-[75dvh] overflow-y-auto rounded-t-2xl border-white/10 pb-[calc(env(safe-area-inset-bottom)+2rem)]"
            >
              <SheetHeader className="text-start">
                <SheetTitle className="font-display text-base font-bold">مساحة العمل</SheetTitle>
              </SheetHeader>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {rest.map((item) => (
                  <SheetClose key={item.id} asChild>
                    <button
                      type="button"
                      disabled={!item.enabled}
                      onClick={() => onNavigate(item.id)}
                      className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start text-xs font-medium transition-colors duration-200 disabled:opacity-40 ${
                        activeId === item.id
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/60 bg-surface-1 text-foreground/90"
                      }`}
                    >
                      {NAV_GLYPHS[item.id] ? (\n                        <MIZYAiIcon name={NAV_GLYPHS[item.id]!} tone={item.id === "ask" || item.id === "insights" ? "dual" : item.id === "templates" ? "lavender" : "teal"} className="size-[19px] shrink-0" />\n                      ) : (\n                        <item.icon className="size-4 shrink-0" strokeWidth={2} />\n                      )}
                      <span className="truncate">{item.label}</span>
                    </button>
                  </SheetClose>
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
        {NAV_GLYPHS[item.id] ? (\n          <MIZYAiIcon name={NAV_GLYPHS[item.id]!} tone={item.id === "ask" || item.id === "insights" ? "dual" : item.id === "templates" ? "lavender" : "teal"} className="size-[20px] shrink-0" />\n        ) : (\n          <item.icon className="size-[18px] shrink-0" strokeWidth={2} />\n        )}
        <span className="w-full truncate text-center text-[10px] font-medium leading-none">
          {item.label}
        </span>
      </button>
    </li>
  );
}
