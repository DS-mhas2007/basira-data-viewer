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
    <label className="mz-glass-inset flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-[11px] text-muted-foreground">
      <Switch checked={!saving} onCheckedChange={(v) => onChange(!v)} aria-label="لا تحفظ محادثتي" />
      <span>
        {saving
          ? "المحادثة تُحفظ في حسابك. فعّل المفتاح لعدم الحفظ. هذا الخيار لا يغيّر موافقتك المنفصلة على AI السحابي."
          : "لن تُحفظ هذه المحادثة في حسابك وستختفي عند إعادة التحميل. إرسال السؤال ونتائج الأدوات إلى مزوّد النموذج يتحكم به خيار AI السحابي المستقل أدناه."}
      </span>
    </label>
  );
}
