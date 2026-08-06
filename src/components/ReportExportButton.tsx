/**
 * الوحدة 8: زر "تصدير تقرير PDF" — يظهر فقط عند وجود استنتاج مثبّت واحد على الأقل.
 */
import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportDocument, type ReportData } from "@/components/ReportDocument";
import { exportReportPdf } from "@/lib/pdf-report";
import { reportFileName } from "@/lib/report";

interface Props {
  data: Omit<ReportData, "date">;
}

export function ReportExportButton({ data }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [doc, setDoc] = useState<ReportData | null>(null);

  if (data.insights.length === 0) return null;

  async function run() {
    if (busy) return;
    setError(false);
    setBusy(true);
    const date = new Date();
    setDoc({ ...data, date });
    try {
      // انتظار رسم المستند خارج الشاشة (الرسوم البيانية تحتاج إطاراً إضافياً).
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      await new Promise((r) => setTimeout(r, 350));
      const root = document.getElementById("basira-report-root");
      if (!root) throw new Error("no-root");
      await exportReportPdf(root, reportFileName(data.fileName, date));
    } catch {
      setError(true);
    } finally {
      setDoc(null);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="clay-press h-10 gap-2 rounded-xl px-4"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          ) : (
            <FileDown className="size-4" strokeWidth={2} />
          )}
          {busy ? "جاري إنشاء التقرير..." : "تصدير تقرير PDF"}
        </Button>
        {error && <span className="text-[11px] text-destructive">تعذّر إنشاء التقرير، حاول مرة أخرى.</span>}
      </div>

      {doc && (
        <div
          id="basira-report-root"
          aria-hidden
          style={{ position: "fixed", top: 0, insetInlineStart: -20000, zIndex: -1, pointerEvents: "none" }}
        >
          <ReportDocument data={doc} />
        </div>
      )}
    </>
  );
}
