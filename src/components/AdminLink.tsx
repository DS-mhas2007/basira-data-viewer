import { LayoutDashboard } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useIsAdmin } from "@/lib/admin";

/** رابط لوحة التحكم: لا يُرسم أبداً إلا إذا أكّدت قاعدة البيانات أن المستخدم هو المالك. */
export function AdminLink({ collapsed }: { collapsed: boolean }) {
  const { data: isAdmin } = useIsAdmin();
  if (!isAdmin) return null;

  return (
    <Link
      to="/admin"
      title="لوحة تحكم المالك"
      aria-label="افتح لوحة تحكم المالك"
      className="mb-2 flex w-full items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-accent transition hover:border-accent/50 hover:bg-accent/15"
    >
      <LayoutDashboard className="size-4 shrink-0" strokeWidth={2} />
      {!collapsed && <span className="text-start text-[11px] font-semibold">لوحة التحكم</span>}
    </Link>
  );
}
