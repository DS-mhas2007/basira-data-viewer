import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { BasiraLogo, MizyaLockup } from "@/components/BasiraLogo";
import { BookOpen, ShieldCheck } from "@/components/icons";
import { Link } from "@tanstack/react-router";
import { PrivacyLedger } from "@/components/PrivacyLedger";
import type { LucideIcon } from "@/components/icons";
import { MIZYAiNavIcon } from "@/components/MIZYAiNavIcon";

export interface NavSection {
  id: string;
  label: string;
  icon: LucideIcon;
  enabled: boolean;
  hint?: string | undefined;
  /** مجموعة التنقّل: أساسية أو إعدادات/أدوات مساعدة. */
  group?: "main" | "tools";
}

interface Props {
  sections: NavSection[];
  activeId: string;
  onNavigate: (id: string) => void;
  fileName?: string | undefined;
  rowCount?: number | undefined;
  columnCount?: number | undefined;
}

export function WorkspaceSidebar({
  sections,
  activeId,
  onNavigate,
  fileName,
  rowCount,
  columnCount,
}: Props) {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <Sidebar
      side="right"
      collapsible="icon"
      role="complementary"
      aria-label="التنقل في مساحة العمل"
      className="basira-sidebar border-e-0 border-s border-border/50"
    >
      <SidebarHeader className="border-b border-border/40 px-3 py-4">
        {collapsed ? (
          <div className="flex size-9 items-center justify-center">
            <BasiraLogo className="size-full" />
          </div>
        ) : (
          <div className="min-w-0 space-y-1.5">
            <MizyaLockup className="h-11 w-auto max-w-full" />
            <p className="truncate text-[11px] leading-none text-muted-foreground">
              تحليل البيانات محلياً
            </p>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-1 py-2">
        {(["main", "tools"] as const).map((group) => {
          const items = sections.filter((s) => (s.group ?? "main") === group);
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group}>
              {!collapsed && (
                <SidebarGroupLabel>{group === "main" ? "مساحة العمل" : "أدوات"}</SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((s) => (
                    <SidebarMenuItem key={s.id} data-tour-nav={s.id}>
                      <SidebarMenuButton
                        isActive={activeId === s.id}
                        disabled={!s.enabled}
                        tooltip={s.label}
                        onClick={() => s.enabled && onNavigate(s.id)}
                        className="gap-2.5 rounded-xl transition-colors duration-200 data-[active=true]:bg-primary/10 data-[active=true]:font-semibold data-[active=true]:text-primary disabled:opacity-40"
                      >
                        <MIZYAiNavIcon id={s.id} fallback={s.icon} className="size-4" />
                        <span className="truncate">{s.label}</span>
                        {s.hint && !collapsed && (
                          <span className="ms-auto font-mono text-[10px] text-muted-foreground">
                            {s.hint}
                          </span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {!collapsed && fileName && (
          <SidebarGroup>
            <SidebarGroupLabel>الملف الحالي</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="mx-2 space-y-2 rounded-xl border border-border/60 bg-background/40 px-3 py-3">
                <p dir="auto" className="truncate text-xs font-medium">
                  {fileName}
                </p>
                <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                  <span>{(rowCount ?? 0).toLocaleString("en-US")} صف</span>
                  <span className="text-border">|</span>
                  <span>{(columnCount ?? 0).toLocaleString("en-US")} عمود</span>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 p-3">
        <AdminLink collapsed={collapsed} />
        <Link
          to="/guide"
          title="مكتبة الأدلة والشروحات"
          aria-label="افتح مكتبة الأدلة والشروحات"
          className="mb-2 flex w-full items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-primary transition hover:border-primary/40 hover:bg-primary/10"
        >
          <BookOpen className="size-4 shrink-0" strokeWidth={2} />
          {!collapsed && (
            <span className="text-start text-[11px] font-semibold">مكتبة الأدلة والشروحات</span>
          )}
        </Link>
        <PrivacyLedger>
          <button
            type="button"
            title="اعرض سجل الخصوصية"
            className="flex w-full items-center gap-2 rounded-xl bg-accent/10 px-3 py-2 text-accent transition hover:bg-accent/15"
          >
            <ShieldCheck className="size-4 shrink-0" strokeWidth={2} />
            {!collapsed && (
              <span className="text-start text-[11px] leading-tight">
                ملفك لا يُرفع — تحقّق بنفسك
              </span>
            )}
          </button>
        </PrivacyLedger>
      </SidebarFooter>
    </Sidebar>
  );
}
import { AdminLink } from "@/components/AdminLink";
