import { useCallback, useRef, useState } from "react";
import {
  FileSpreadsheet,
  HeartPulse,
  Loader2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  UploadCloud,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { parseFile, validateFile, formatBytes, type ParsedFile, type ForcedEncoding } from "@/lib/parse-file";
import { EncodingSelector } from "@/components/EncodingSelector";
import { duckdb, TABLE_NAME } from "@/lib/duckdb-service";

interface Props {
  onFile: (file: File) => void;
  loading: boolean;
  compact?: boolean;
}

/** ملفات تجريبية تُبنى محلياً في المتصفح — بلا أي طلب شبكة. */
const DEMOS: {
  id: string;
  label: string;
  desc: string;
  rows: string;
  icon: LucideIcon;
  build: () => string;
}[] = [
  {
    id: "ecommerce",
    label: "مبيعات متجر إلكتروني",
    desc: "طلبات، منتجات، مدن، وقنوات تسويق",
    rows: "10,000 صف",
    icon: ShoppingCart,
    build: () => {
      const cities = ["الرياض", "جدة", "الدمام", "مكة", "أبها", "تبوك", "المدينة", "بريدة"];
      const cats = ["إلكترونيات", "أزياء", "منزل", "رياضة", "جمال"];
      const channels = ["بحث مدفوع", "سوشال ميديا", "بريد", "مباشر"];
      const rows = ["order_id,order_date,city,category,channel,quantity,unit_price,revenue,is_returned"];
      for (let i = 1; i <= 10000; i++) {
        const q = 1 + (i * 7) % 5;
        const price = 45 + ((i * 13) % 60) * 9;
        const day = 1 + (i % 28);
        const month = 1 + (i % 12);
        rows.push(
          [
            `ORD-${String(i).padStart(5, "0")}`,
            `2025-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
            cities[i % cities.length],
            cats[i % cats.length],
            channels[i % channels.length],
            q,
            price,
            q * price,
            i % 17 === 0 ? "yes" : "no",
          ].join(","),
        );
      }
      return rows.join("\n");
    },
  },
  {
    id: "hr",
    label: "الموارد البشرية والرواتب",
    desc: "أقسام، رواتب، خبرة، وتقييم أداء",
    rows: "1,200 صف",
    icon: Users,
    build: () => {
      const deps = ["تقنية المعلومات", "التسويق", "المالية", "العمليات", "الموارد البشرية"];
      const titles = ["مهندس", "أخصائي", "محلل", "مدير", "منسق"];
      const rows = ["employee_id,name,department,job_title,gender,salary,years_experience,performance_score,is_remote"];
      for (let i = 1; i <= 1200; i++) {
        rows.push(
          [
            `EMP-${String(i).padStart(4, "0")}`,
            `موظف ${i}`,
            deps[i % deps.length],
            titles[i % titles.length],
            i % 2 === 0 ? "ذكر" : "أنثى",
            7000 + ((i * 11) % 40) * 620,
            1 + (i % 18),
            (2.4 + ((i * 7) % 26) / 10).toFixed(1),
            i % 3 === 0 ? "yes" : "no",
          ].join(","),
        );
      }
      return rows.join("\n");
    },
  },
  {
    id: "wellbeing",
    label: "استبيان الصحة النفسية والتقنية",
    desc: "ساعات الشاشة، النوم، القلق، والتركيز",
    rows: "800 صف",
    icon: HeartPulse,
    build: () => {
      const cats = ["تواصل اجتماعي", "ألعاب", "دراسة", "فيديو", "عمل"];
      const rows = ["respondent_id,age,gender,daily_screen_hours,main_app_category,sleep_hours,anxiety_score,focus_score,exercise_days"];
      for (let i = 1; i <= 800; i++) {
        const screen = 1 + ((i * 3) % 110) / 10;
        rows.push(
          [
            `R-${String(i).padStart(4, "0")}`,
            16 + (i % 40),
            i % 2 === 0 ? "ذكر" : "أنثى",
            screen.toFixed(1),
            cats[i % cats.length],
            (9 - screen / 4).toFixed(1),
            Math.min(10, Math.round(screen * 0.8)),
            Math.max(1, 10 - Math.round(screen * 0.6)),
            i % 8,
          ].join(","),
        );
      }
      return rows.join("\n");
    },
  },
];

/** أول ورقة فيها بيانات (ورقة الغلاف أو الفارغة لا تُختار). */
function pickSheet(parsed: ParsedFile): string {
  const names = parsed.sheetNames.length ? parsed.sheetNames : Object.keys(parsed.sheets);
  return names.find((n) => (parsed.sheets[n]?.rows.length ?? 0) > 0) ?? names[0] ?? "";
}

export function FileDropzone({ onFile, loading, compact = false }: Props) {
  const [dragging, setDragging] = useState(false);
  const [building, setBuilding] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<{ sheetName: string; rowCount: number } | null>(null);
  const [aliasOpen, setAliasOpen] = useState(false);
  // نسخة قابلة للعرض من نتيجة التحليل (المرجع pendingParsedRef لا يعيد الرسم)
  const [parsedView, setParsedView] = useState<ParsedFile | null>(null);
  const [sheetChoice, setSheetChoice] = useState("");
  const [encodingChoice, setEncodingChoice] = useState<"auto" | ForcedEncoding>("auto");
  const [reparsing, setReparsing] = useState(false);
  const [alias, setAlias] = useState("");
  const [registering, setRegistering] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const pendingFileRef = useRef<File | null>(null);
  const pendingParsedRef = useRef<ParsedFile | null>(null);
  // رقم آخر اختيار: يمنع نتيجة تحليل ملف أقدم (أبطأ) من الكتابة فوق ملف أحدث
  const selectionIdRef = useRef(0);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFileSelected(file);
      }
    },
    [],
  );

  async function handleFileSelected(file: File) {
    const selectionId = ++selectionIdRef.current;
    setParsingError(null);
    setParsedPreview(null);
    setAliasOpen(false);
    setParsedView(null);
    setEncodingChoice("auto");
    pendingParsedRef.current = null;
    pendingFileRef.current = file;
    setSelectedFileName(file.name);
    setSelectedFileSize(file.size);

    const v = validateFile(file);
    if (v) {
      setParsingError(v);
      return;
    }

    try {
      setBuilding("parsing");
      const parsed = await parseFile(file);
      if (selectionId !== selectionIdRef.current) return;
      const first = pickSheet(parsed);
      const rc = (first ? parsed.sheets[first]?.rows.length : 0) ?? 0;
      if (rc === 0) {
        setParsingError("الملف لا يحتوي على أي صفوف بيانات.");
        return;
      }
      pendingParsedRef.current = parsed;
      setParsedView(parsed);
      setSheetChoice(first);
      setParsedPreview({ sheetName: first, rowCount: rc });
      setAlias((file.name ?? "").replace(/\.[^/.]+$/, ""));
      setAliasOpen(true);
    } catch (err) {
      if (selectionId === selectionIdRef.current) setParsingError(err instanceof Error ? err.message : String(err));
    } finally {
      if (selectionId === selectionIdRef.current) setBuilding(null);
    }
  }

  /** إعادة قراءة ملف CSV بترميز يحدده المستخدم (عند ظهور حروف مكسورة في المعاينة). */
  async function reparseWithEncoding(enc: "auto" | ForcedEncoding) {
    const file = pendingFileRef.current;
    if (!file) return;
    const selectionId = selectionIdRef.current;
    setEncodingChoice(enc);
    setReparsing(true);
    setParsingError(null);
    try {
      const parsed = await parseFile(file, { encoding: enc });
      if (selectionId !== selectionIdRef.current) return;
      pendingParsedRef.current = parsed;
      setParsedView(parsed);
      setSheetChoice(pickSheet(parsed));
    } catch (err) {
      if (selectionId === selectionIdRef.current) setParsingError(err instanceof Error ? err.message : String(err));
    } finally {
      setReparsing(false);
    }
  }

  async function confirmAliasAndRegister() {
    const file = pendingFileRef.current;
    const parsed = pendingParsedRef.current;
    if (!file || !parsed) return;
    if (!alias || alias.trim() === "") {
      setParsingError("الرجاء إدخال اسم مصدر (alias) صالح.");
      return;
    }
    setRegistering(true);
    setParsingError(null);
    try {
      // أول ورقة فيها بيانات (اختيار ورقة يدوي: تحسين لاحق)
      const sheetName = sheetChoice && parsed.sheets[sheetChoice] ? sheetChoice : pickSheet(parsed);
      const sheet = sheetName ? parsed.sheets[sheetName] : undefined;
      if (!sheet) {
        setParsingError("تعذّر قراءة أي ورقة عمل من الملف.");
        setRegistering(false);
        return;
      }
      const aliasValue = alias.trim();

      // تسجيل المصدر في DuckDB باسم alias
      await duckdb.registerSheet(sheet, aliasValue);

      // ✅ إنشاء VIEW افتراضي باسم dataset باستخدام duckdb.query
      try {
        const sources = await duckdb.listSources();
        const src = sources.find((s) => s.alias === aliasValue) ?? sources[0];

        if (src) {
          const safeTable = src.table.replace(/"/g, '""');
          await duckdb.query(`CREATE OR REPLACE VIEW ${TABLE_NAME} AS SELECT * FROM "${safeTable}"`);
        }
      } catch (err) {
        console.error("[Basira] Failed to create dataset view:", err);
        setParsingError("تعذّر إنشاء عرض البيانات للوكيل الذكي. حاول مجدداً.");
        setRegistering(false);
        return;
      }

      // ✅ إشعار بقية المكونات أن البيانات تغيّرت
      window.dispatchEvent(
        new CustomEvent("basira:dataset-changed", {
          detail: { alias: aliasValue },
        })
      );

      // إعلام الأب عن الملف كما كان يتم
      onFile(file);
      setAliasOpen(false);
      pendingFileRef.current = null;
      pendingParsedRef.current = null;
    } catch (err) {
      setParsingError(err instanceof Error ? err.message : String(err));
    } finally {
      setRegistering(false);
    }
  }

  async function loadDemo(demo: (typeof DEMOS)[number]) {
    setBuilding(demo.id);
    await new Promise((r) => setTimeout(r, 30)); // فسحة للرسم

    // ✅ توليد البيانات على دفعات لمنع تجميد الخيط الرئيسي (Main Thread)
    const CHUNK_SIZE = 2000;
    const rawRows = demo.build();
    const lines = rawRows.split("\n");
    const header = lines[0] ?? "";
    const rows: string[] = [header];

    for (let i = 1; i < lines.length; i += CHUNK_SIZE) {
      rows.push(...lines.slice(i, i + CHUNK_SIZE));
      // ✅ إرجاع السيطرة للمتصفح لمنع التجميد
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const csv = "\uFEFF" + rows.join("\n");
    setBuilding(null);
    const f = new File([csv], `${demo.label}.csv`, { type: "text/csv" });
    await handleFileSelected(f);
  }

  function openFilePicker() {
    if (loading) return;
    inputRef.current?.click();
  }

  return (
    <div className="space-y-4">
      <div
        id="basira-dropzone"
        ref={zoneRef}
        data-tour="upload"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => openFilePicker()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openFilePicker();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="منطقة رفع الملفات — اضغط Enter أو Space لفتح محدد الملفات أو اسحب ملفًا هنا وأفلته"
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
            if (file) {
              void handleFileSelected(file);
            }
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
            {loading || registering ? (
              <Loader2 className={compact ? "size-5 animate-spin" : "size-9 animate-spin"} strokeWidth={1.75} />
            ) : dragging ? (
              <FileSpreadsheet className={compact ? "size-5" : "size-9"} strokeWidth={1.75} />
            ) : (
              <UploadCloud className={compact ? "size-5" : "size-9"} strokeWidth={1.75} />
            )}
          </div>

          <div className="space-y-2">
            <p className={cn("font-bold tracking-tight", compact ? "text-base" : "text-2xl sm:text-3xl")}>
              {loading || registering
                ? "جارٍ معالجة الملف..."
                : dragging
                ? "أفلت الملف الآن"
                : "اسحب ملفك وأفلته هنا"}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              تُقرأ الملفات محلياً داخل متصفحك — لا يتم رفعها إلى أي خادم.
            </p>
          </div>

          <Button
            type="button"
            disabled={loading || registering}
            onClick={() => inputRef.current?.click()}
            className="glow-cta h-11 rounded-xl px-6 font-bold"
            aria-disabled={loading || registering}
          >
            اختيار ملف
          </Button>

          <p className="glass-pill text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" strokeWidth={2} />
            الصيغ المدعومة: <span dir="ltr" className="font-mono text-foreground">CSV, XLSX</span>
            <span className="opacity-40">·</span>
            <span dir="ltr" className="font-mono">25 MB</span>
          </p>

          {/* حالة الوصول/إشعار لقراءة الشاشة */}
          <div aria-live="polite" className="sr-only" id="dropzone-status">
            {building
              ? `يتم إنشاء بيانات تجريبية: ${building}`
              : loading || registering
              ? "جارٍ معالجة الملف"
              : selectedFileName
              ? `الملف المختار: ${selectedFileName}`
              : "منطقة الانتظار"}
          </div>
        </div>
      </div>

      {/* معلومات الملف المختار قصيرة تظهر بعد اختيار/سحب الملف */}
      {!compact && selectedFileName && (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{selectedFileName}</p>
            <p className="text-xs text-muted-foreground">
              {selectedFileSize ? formatBytes(selectedFileSize) : ""}
              {parsedPreview ? ` · تقريباً ${parsedPreview.rowCount} صف` : ""}
            </p>
            {parsingError && <p className="text-xs text-destructive mt-1">{parsingError}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedFileName(null);
                setSelectedFileSize(null);
                setParsedPreview(null);
                setParsingError(null);
                inputRef.current && (inputRef.current.value = "");
              }}
            >
              مسح
            </Button>
          </div>
        </div>
      )}

      {/* بطاقات بيانات تجريبية — تحميل بنقرة واحدة محلياً */}
      {!compact && (
        <div data-tour="samples" className="space-y-3">
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-accent" strokeWidth={2} />
            أو جرّب فوراً ببيانات جاهزة — تُحمّل محلياً بنقرة واحدة
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {DEMOS.map((d) => {
              const Icon = d.icon;
              const busy = building === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={loading || !!building}
                  onClick={() => void loadDemo(d)}
                  aria-label={`تحميل عينة ${d.label}`}
                  aria-busy={busy}
                  className="glass glass-hover clay-press group rounded-2xl p-4 text-start transition hover:-translate-y-0.5 disabled:opacity-50 active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                      ) : (
                        <Icon className="size-4" strokeWidth={2} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold">{d.label}</span>
                      <span dir="ltr" className="block font-mono text-[10px] text-primary">{d.rows}</span>
                    </span>
                  </span>
                  <span className="mt-2.5 block text-[11px] leading-relaxed text-muted-foreground">{d.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Alias modal */}
      {aliasOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAliasOpen(false)} />
          <div className="relative z-50 w-full max-w-md rounded-2xl bg-card p-6">
            <h3 className="text-lg font-semibold">سجل مصدر البيانات</h3>
            <p className="mt-2 text-sm text-muted-foreground">أدخل اسم مصدر (alias) لتستخدم الملف في الانضمامات والعروض.</p>
            <label className="mt-4 block">
              <span className="text-xs text-muted-foreground">اسم المصدر</span>
              <input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 bg-background text-foreground"
              />
            </label>

            {parsedView?.meta && parsedView.meta.encoding !== "XLSX" && (
              <div className="mt-4">
                <EncodingSelector
                  value={encodingChoice}
                  onChange={(v) => void reparseWithEncoding(v as "auto" | ForcedEncoding)}
                  disabled={reparsing || registering}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  المكتشف: {parsedView.meta.encoding}. إن ظهرت حروف مكسورة في المعاينة جرّب «Windows-1256».
                </p>
              </div>
            )}

            {parsedView && parsedView.sheetNames.length > 1 && (
              <label className="mt-4 block">
                <span className="text-xs text-muted-foreground">ورقة العمل</span>
                <select
                  value={sheetChoice}
                  onChange={(e) => setSheetChoice(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground"
                  disabled={registering}
                >
                  {parsedView.sheetNames.map((n) => (
                    <option key={n} value={n}>
                      {n} ({parsedView.sheets[n]?.rows.length ?? 0} صف)
                    </option>
                  ))}
                </select>
              </label>
            )}

            {parsedView && sheetChoice && parsedView.sheets[sheetChoice] && (
              <div className="mt-4" dir="rtl">
                <span className="text-xs text-muted-foreground">معاينة أول الصفوف</span>
                <div className="mt-1 overflow-x-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        {parsedView.sheets[sheetChoice]!.columns.slice(0, 4).map((c) => (
                          <th key={c} className="whitespace-nowrap px-2 py-1 text-right font-medium">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedView.sheets[sheetChoice]!.rows.slice(0, 3).map((r, i) => (
                        <tr key={i} className="border-t">
                          {parsedView.sheets[sheetChoice]!.columns.slice(0, 4).map((c) => (
                            <td key={c} className="max-w-[9rem] truncate px-2 py-1 text-right">
                              {r[c] === null || r[c] === undefined ? "" : String(r[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setAliasOpen(false)} disabled={registering}>
                إلغاء
              </Button>
              <Button onClick={() => void confirmAliasAndRegister()} disabled={registering}>
                {registering ? (
                  <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin"/> تسجيل...</span>
                ) : (
                  "سجل المصدر"
                )}
              </Button>
            </div>
            {parsingError && <p className="mt-3 text-sm text-destructive">{parsingError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
