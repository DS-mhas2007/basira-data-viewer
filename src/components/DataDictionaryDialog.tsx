import { useEffect, useState, type ReactNode } from "react";
import { BookText, Copy, Download } from "@/components/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  buildDictionary,
  dictionaryToCsv,
  dictionaryToMarkdown,
  fetchDictionaryExtras,
  type DictionaryEntry,
} from "@/lib/data-dictionary";
import type { HealthReport } from "@/lib/data-health";

interface Props {
  health: HealthReport;
  table: string;
  fileName: string;
  children: ReactNode;
}

export function DataDictionaryDialog({ health, table, fileName, children }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<DictionaryEntry[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setEntries(null);
    void (async () => {
      let extras = {};
      try {
        extras = await fetchDictionaryExtras(table, health);
      } catch {
        /* نكمل بدون الأمثلة */
      }
      if (!cancelled) setEntries(buildDictionary(health, extras));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, health, table]);

  async function copy() {
    if (!entries) return;
    try {
      await navigator.clipboard.writeText(
        dictionaryToMarkdown(entries, `قاموس بيانات ${fileName}`),
      );
      toast.success("نُسخ القاموس — جاهز للصق في تقريرك");
    } catch {
      toast.error("تعذّر الوصول إلى الحافظة");
    }
  }

  function download() {
    if (!entries) return;
    const blob = new Blob([dictionaryToCsv(entries)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/\.[^.]+$/, "")}-قاموس.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent dir="rtl" className="mz-glass-card mz-glass-card--teal max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookText className="size-5 text-primary" />
            قاموس البيانات
          </DialogTitle>
          <DialogDescription>
            وصف تلقائي لكل عمود: ما هو، ومدى اكتماله، وأمثلة من قيمه، وما يستحق الانتباه. حُسب
            محلياً في متصفحك.
          </DialogDescription>
        </DialogHeader>

        <div className="mz-glass-inset max-h-[55vh] overflow-auto rounded-xl">
          {!entries ? (
            <p className="p-4 text-sm text-muted-foreground">نقرأ أعمدتك…</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#07152D] text-muted-foreground">
                <tr className="text-start">
                  <th className="px-3 py-2 text-start font-medium">العمود</th>
                  <th className="px-3 py-2 text-start font-medium">الدور</th>
                  <th className="px-3 py-2 text-start font-medium">الاكتمال</th>
                  <th className="px-3 py-2 text-start font-medium">الوصف</th>
                  <th className="px-3 py-2 text-start font-medium">أمثلة</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.name} className="border-t border-white/[0.07] align-top">
                    <td className="px-3 py-2">
                      <p dir="auto" className="font-mono text-foreground">
                        {e.name}
                      </p>
                      <p
                        dir="ltr"
                        className="text-start font-mono text-[10px] text-muted-foreground"
                      >
                        {e.type}
                      </p>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{e.roleLabel}</td>
                    <td className="px-3 py-2 font-mono">{e.filled}%</td>
                    <td className="px-3 py-2">
                      {e.description}
                      {e.notes.map((n) => (
                        <p key={n} className="mt-1 text-[11px] text-amber-400">
                          ⚠ {n}
                        </p>
                      ))}
                    </td>
                    <td dir="auto" className="px-3 py-2 text-muted-foreground">
                      {e.examples.join("، ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!entries}
            onClick={() => void copy()}
            className="rounded-xl"
          >
            <Copy className="size-4" /> نسخ كجدول (Markdown)
          </Button>
          <Button variant="outline" disabled={!entries} onClick={download} className="rounded-xl">
            <Download className="size-4" /> تنزيل CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
