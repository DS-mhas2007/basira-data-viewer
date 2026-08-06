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
import { BasiraLogo } from "@/components/BasiraLogo";
import { ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavSection {
  id: string;
  label: string;
  icon: LucideIcon;
  enabled: boolean;
  hint?: string | undefined;
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
    <Sidebar side="right" collapsible="icon" className="border-e-0 border-s border-border/50">
      <SidebarHeader className="border-b border-border/40 px-3 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center">
            <BasiraLogo className="size-full" />
          </div>
          {!collapsed && (
            <div className="min-w-0 space-y-0.5">
              <p className="font-display text-lg font-extrabold leading-none tracking-tight">بصيرة</p>
              <p className="truncate text-[11px] leading-none text-muted-foreground">
                تحليل البيانات محلياً
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1 py-2">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>مساحة العمل</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {sections.map((s) => (
                <SidebarMenuItem key={s.id}>
                  <SidebarMenuButton
                    isActive={activeId === s.id}
                    disabled={!s.enabled}
                    tooltip={s.label}
                    onClick={() => s.enabled && onNavigate(s.id)}
                    className="gap-2.5 rounded-xl transition-colors data-[active=true]:bg-primary/10 data-[active=true]:text-primary disabled:opacity-40"
                  >
                    <s.icon className="size-4" strokeWidth={2} />
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
        <div className="flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2 text-accent">
          <ShieldCheck className="size-4 shrink-0" strokeWidth={2} />
          {!collapsed && <span className="text-[11px] leading-tight">لا يُرفع أي ملف إلى الإنترنت</span>}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}