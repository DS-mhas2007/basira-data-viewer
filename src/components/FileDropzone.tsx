import { useCallback, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  onFile: (file: File) => void;
  loading: boolean;
  compact?: boolean;
}

/** ملفات تجريبية تُبنى محلياً في المتصفح — بلا أي طلب شبكة. */
const DEMOS: { id: string; label: string; build: () => string }[] = [
  {
    id: "sales",
    label: "مبيعات ربع سنوي",
    build: () => {
      const regions = ["الرياض", "جدة", "الدمام", "أبها", "تبوك"];
      const months = ["يناير", "فبراير", "مارس"];
      const rows = ["region,month,orders,revenue,returns"];
      regions.forEach((r, ri) =>
        months.forEach((m, mi) =>
          rows.push(
            `${r},${m},${120 + ri * 37 + mi * 14},${(9000 + ri * 2400 + mi * 900).toFixed(0)},${2 + ((ri + mi) % 5)}`,
          ),
        ),
      );
      return rows.join("\n");
    },
  },
  {
    id: "screen",
    label: "وقت استخدام الشاشة",
    build: () => {
      const rows = ["user_id,age,daily_hours,app_category,sleep_hours"];
      const cats = ["social", "gaming", "study", "video"];
      for (let i = 1; i <= 40; i++) {
        rows.push(
          `U${String(i).padStart(3, "0")},${16 + (i % 25)},${(3 + ((i * 7) % 90) / 10).toFixed(2)},${cats[i % 4]},${(5 + ((i * 3) % 40) / 10).toFixed(1)}`,
        );
      }
      return rows.join("\n");
    },
  },
  {
    id: "hr",
    label: "بيانات موظفين",
    build: () => {
      const rows = ["employee,department,salary,years,performance"];
      const deps = ["تقنية", "تسويق", "مالية", "عمليات"];
      for (let i = 1; i <= 30; i++) {
        rows.push(
          `موظف ${i},${deps[i % 4]},${8000 + (i % 9) * 1450},${1 + (i % 12)},${(2.5 + ((i * 5) % 25) / 10).toFixed(1)}`,
        );
      }
      return rows.join("\n");
    },
  },
];

export function FileDropzone({ onFile, loading, compact = false }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  function loadDemo(demo: (typeof DEMOS)[number]) {
    const csv = "\uFEFF" + demo.build();
    onFile(new File([csv], `${demo.label}.csv`, { type: "text/csv" }));
  }

  return (
    <div className="space-y-4">
      <div
        id="basira-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "glass relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed text-center",
          compact ? "min-h-[150px] p-6" : "min-h-[260px] p-10 sm:p-14",
          dragging
            ? "border-primary bg-primary/[0.07] shadow-[0_0_45px_-12px_rgba(96,245,210,0.55)]"
            : "border-primary/30 hover:border-primary hover:bg-white/[0.06]",
          loading && "pointer-events-none opacity-70",
        )}
      >
        {/* توهج ناعم عند سحب الملف فوق المنطقة */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 -z-10 transition-opacity duration-300",
            dragging ? "opacity-100" : "opacity-0",
          )}
          style={{
            background:
              "radial-gradient(60% 70% at 50% 40%, rgba(96,245,210,0.22), transparent 70%)",
          }}
        />

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />

        <div className="flex flex-col items-center gap-5">
          <div
            className={cn(
              "flex items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary transition-all duration-300",
              compact ? "size-12" : "size-20",
              dragging && "scale-110 border-primary/60 bg-primary/20",
            )}
          >
            {loading ? (
              <Loader2 className={compact ? "size-5 animate-spin" : "size-9 animate-spin"} strokeWidth={1.75} />
            ) : dragging ? (
              <FileSpreadsheet className={compact ? "size-5" : "size-9"} strokeWidth={1.75} />
            ) : (
              <UploadCloud className={compact ? "size-5" : "size-9"} strokeWidth={1.75} />
            )}
          </div>

          <div className="space-y-2">
            <p className={cn("font-bold tracking-tight", compact ? "text-base" : "text-2xl sm:text-3xl")}>
              {loading ? "جارٍ قراءة الملف..." : dragging ? "أفلت الملف الآن" : "اسحب ملفك وأفلته هنا"}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              تُقرأ الملفات محلياً داخل متصفحك — لا يتم رفعها إلى أي خادم.
            </p>
          </div>

          <Button
            type="button"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
            className="glow-cta h-11 rounded-xl px-6 font-bold"
          >
            اختيار ملف
          </Button>

          <p className="glass-pill text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" strokeWidth={2} />
            الصيغ المدعومة: <span dir="ltr" className="font-mono text-foreground">CSV, XLSX</span>
            <span className="opacity-40">·</span>
            <span dir="ltr" className="font-mono">25 MB</span>
          </p>
        </div>
      </div>

      {/* بيانات تجريبية — كبسولات زجاجية تفاعلية */}
      {!compact && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-accent" strokeWidth={2} />
            جرّب ببيانات جاهزة:
          </span>
          {DEMOS.map((d) => (
            <button
              key={d.id}
              type="button"
              disabled={loading}
              onClick={() => loadDemo(d)}
              className="glass glass-hover clay-press rounded-full px-3.5 py-1.5 text-xs font-medium text-foreground/90 hover:text-foreground active:scale-[0.98] disabled:opacity-50"
            >
              {d.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
