import { useCallback, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  onFile: (file: File) => void;
  loading: boolean;
  compact?: boolean;
}

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

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "relative rounded-2xl border border-dashed bg-card/60 text-center shadow-[var(--shadow-panel)] transition-all duration-300",
        compact ? "p-6" : "p-12",
        dragging
          ? "border-primary bg-primary/5 shadow-[var(--shadow-lift)]"
          : "border-border/70 hover:border-primary/50",
        loading && "pointer-events-none opacity-70",
      )}
    >
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
      <div className="flex flex-col items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors duration-300">
          {loading ? (
            <Loader2 className="size-6 animate-spin" strokeWidth={2} />
          ) : dragging ? (
            <FileSpreadsheet className="size-6" strokeWidth={2} />
          ) : (
            <UploadCloud className="size-6" strokeWidth={2} />
          )}
        </div>
        <div className="space-y-2">
          <p className="font-display text-lg font-bold">
            {loading ? "جارٍ قراءة الملف..." : "اسحب ملفك وأفلته هنا"}
          </p>
          <p className="text-sm text-muted-foreground">
            تُقرأ الملفات محلياً داخل متصفحك — لا يتم رفعها إلى أي خادم.
          </p>
        </div>
        <Button type="button" variant="secondary" disabled={loading} onClick={() => inputRef.current?.click()}>
          اختيار ملف
        </Button>
        <p className="text-xs text-muted-foreground">
          الصيغ المدعومة: <span dir="ltr" className="font-mono">CSV, XLSX</span> — بحد أقصى{" "}
          <span dir="ltr" className="font-mono">25 MB</span>
        </p>
      </div>
    </div>
  );
}