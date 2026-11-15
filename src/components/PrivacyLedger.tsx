import { useSyncExternalStore, type ReactNode } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatBytes } from "@/lib/parse-file";
import {
  fileStayedLocal,
  getLedgerEntries,
  getLedgerFileBytes,
  getLedgerVersion,
  subscribeLedger,
  summarize,
  type LedgerCategory,
} from "@/lib/network-ledger";

const CATEGORY_LABEL: Record<LedgerCategory, string> = {
  engine: "ملفات التطبيق (تنزيل)",
  account: "الحساب والمشاريع",
  server: "الخادم والذكاء الاصطناعي",
  other: "وجهات أخرى",
};

/** زر يفتح «سجل الخصوصية»: دليل حيّ على ما غادر المتصفح فعلاً وما لم يغادره. */
export function PrivacyLedger({ children }: { children: ReactNode }) {
  useSyncExternalStore(subscribeLedger, getLedgerVersion, getLedgerVersion);
  const entries = getLedgerEntries();
  const fileBytes = getLedgerFileBytes();
  const s = summarize(entries);
  const proven = fileStayedLocal(s, fileBytes);
  const recent = [...entries].reverse().slice(0, 12);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent dir="rtl" className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {proven ? (
              <ShieldCheck className="size-5 text-accent" />
            ) : (
              <ShieldAlert className="size-5 text-muted-foreground" />
            )}
            سجل الخصوصية
          </DialogTitle>
          <DialogDescription>
            يرصد هذا السجل كل طلب خرج من هذه الصفحة منذ فتحتها. يحفظ الأحجام والوجهات فقط، لا
            المحتوى.
          </DialogDescription>
        </DialogHeader>

        <div
          className={`rounded-xl border px-4 py-3 text-sm ${proven ? "border-accent/40 bg-accent/10" : "border-border/60 bg-muted/30"}`}
        >
          {fileBytes <= 0 ? (
            "ارفع ملفاً لنقارن حجمه بما أُرسل فعلاً."
          ) : proven ? (
            <>
              ملفك ({formatBytes(fileBytes)}) <b>لم يُرفع</b>.{" "}
              {s.maxBytes > 0
                ? `أكبر طلب أُرسل حجمه ${formatBytes(s.maxBytes)} فقط، فلا يمكن أن يحوي الملف كاملاً.`
                : "لم يخرج من هذه الصفحة أي طلب يحمل بيانات."}
            </>
          ) : (
            <>
              لا نستطيع الجزم الآن:{" "}
              {s.unknownSize > 0 ? "بعض الطلبات حجمها غير معروف." : "أحد الطلبات قريب من حجم ملفك."}
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="طلبات صادرة" value={s.requests.toLocaleString("en-US")} />
          <Stat label="طلبات تحمل بيانات" value={s.withBody.toLocaleString("en-US")} />
          <Stat label="أكبر طلب" value={s.maxBytes > 0 ? formatBytes(s.maxBytes) : "—"} />
        </div>

        <div className="max-h-52 overflow-auto rounded-xl border border-border/60">
          {recent.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">لا طلبات بعد.</p>
          ) : (
            <table className="w-full text-[11px]" dir="ltr">
              <tbody>
                {recent.map((e) => (
                  <tr key={e.id} className="border-b border-border/40 last:border-0">
                    <td className="px-2 py-1.5 font-mono text-muted-foreground">{e.method}</td>
                    <td className="max-w-[16rem] truncate px-2 py-1.5 font-mono">
                      {e.host}
                      {e.path}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono" dir="rtl">
                      {e.bytes > 0 ? formatBytes(e.bytes) : e.bytes < 0 ? "؟" : "بلا جسم"}
                    </td>
                    <td className="px-2 py-1.5 text-right text-muted-foreground" dir="rtl">
                      {CATEGORY_LABEL[e.category]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          ملاحظة صادقة: عند استخدام ميزات الذكاء الاصطناعي تُرسَل أسماء الأعمدة وعيّنة صغيرة ونتائج
          الاستعلامات، وتظهر هنا كطلبات «الخادم والذكاء الاصطناعي». أما الملف الأصلي وكل ما سواه
          فيبقى في متصفحك.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 px-2 py-2">
      <p className="font-mono text-base font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
