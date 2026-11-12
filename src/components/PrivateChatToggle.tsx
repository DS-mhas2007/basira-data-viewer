import { Switch } from "@/components/ui/switch";

/** مفتاح «لا تحفظ محادثتي»: عند تفعيله لا تُخزَّن رسائل هذه المحادثة في حسابك. */
export function PrivateChatToggle({
  saving,
  onChange,
}: {
  saving: boolean;
  onChange: (saving: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
      <Switch checked={!saving} onCheckedChange={(v) => onChange(!v)} aria-label="لا تحفظ محادثتي" />
      <span>
        {saving
          ? "المحادثة تُحفظ في حسابك. فعّل المفتاح لعدم الحفظ."
          : "لن تُحفظ هذه المحادثة في حسابك وستختفي عند إعادة التحميل."}
      </span>
    </label>
  );
}
