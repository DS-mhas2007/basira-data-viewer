import { useEffect, useState, useRef } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/parse-file";

const PREVIEW_LIMIT = 1000; // رفع الحد الافتراضي لتمكين معاينات أكبر

type Dir = "asc" | "desc";

interface Props {
  columns: string[];
  /** مصدر البيانات: DuckDB */
  fetchRows: (params: {
    search: string;
    sortColumn: string | null;
    sortDir: Dir;
    limit: number;
  }) => Promise<Row[]>;
  countRows: (search: string) => Promise<number>;
  /** يتغير عند تحميل ملف/ورقة جديدة لإعادة الجلب */
  sourceKey: string;
}

function isNumeric(v: unknown) {
  return typeof v === "number" && !Number.isNaN(v);
}

export function DataTable({ columns, fetchRows, countRows, sourceKey }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<{ col: string; dir: Dir } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [matches, setMatches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Virtualization simple: حساب نطاق مرئي بناءً على الscroll
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState({ start: 0, end: 50 });
  const ROW_HEIGHT = 44; // تقريب ثابت لارتفاع الصف
  const OVERSCAN = 8;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setSort(null);
    setQuery("");
    setDebounced("");
  }, [sourceKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchRows({
        search: debounced,
        sortColumn: sort?.col ?? null,
        sortDir: sort?.dir ?? "asc",
        limit: PREVIEW_LIMIT,
      }),
      countRows(debounced),
    ])
      .then(([r, n]) => {
        if (cancelled) return;
        setRows(r);
        setMatches(n);
        // reset virtualization range
        setRange({ start: 0, end: Math.min(r.length, Math.ceil((containerRef.current?.clientHeight ?? 600) / ROW_HEIGHT) + OVERSCAN) });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setRows([]);
        setMatches(0);
        setError(e instanceof Error ? e.message : "تعذّر جلب البيانات من محرك DuckDB.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, sort, sourceKey, fetchRows, countRows]);

  const visible = rows;

  const toggleSort = (col: string) =>
    setSort((s) => (s?.col !== col ? { col, dir: "asc" } : s.dir === "asc" ? { col, dir: "desc" } : null));

  function onScroll() {
    const el = containerRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop;
    const height = el.clientHeight;
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(visible.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN);
    setRange({ start, end });
  }

  const slice = visible.slice(range.start, range.end);
  const topSpacer = range.start * ROW_HEIGHT;
  const bottomSpacer = Math.max(0, (visible.length - range.end) * ROW_HEIGHT);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            aria-label="ابحث في الجدول"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في البيانات..."
            className="clay-press rounded-xl pe-9 focus-visible:ring-0"
          />
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {loading && <Loader2 className="size-4 animate-spin text-primary" />}
          عرض <span dir="ltr" className="font-mono">{Math.min(visible.length, PREVIEW_LIMIT)}</span> من {" "}
          <span dir="ltr" className="font-mono">{matches}</span> صف مطابق
          {matches > PREVIEW_LIMIT && " (أول 1000 صف فقط)"}
        </p>
      </div>

      <div
        className="clay max-h-[32rem] overflow-auto rounded-2xl border border-border/70 bg-card"
        ref={containerRef}
        onScroll={() => onScroll()}
      >
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-secondary shadow-[var(--shadow-clay-head)]">
            <tr>
              <th className="w-12 border-b border-border px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">
                #
              </th>
              {columns.map((col) => {
                const active = sort?.col === col;
                return (
                  <th key={col} className="border-b border-border p-0 text-start">
                    <button
                      onClick={() => toggleSort(col)}
                      className={cn(
                        "focus-glow flex w-full cursor-pointer items-center gap-1.5 whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold transition-colors duration-200 hover:bg-primary/10",
                        active ? "text-primary" : "text-secondary-foreground",
                      )}
                      aria-pressed={active}
                      title={col}
                    >
                      <span dir="ltr" className="truncate">
                        {col}
                      </span>
                      {active ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="size-3.5" strokeWidth={2} />
                        ) : (
                          <ArrowDown className="size-3.5" strokeWidth={2} />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-40" strokeWidth={2} />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Spacer أعلى لتحديد إزاحة البداية */}
            {topSpacer > 0 && (
              <tr style={{ height: topSpacer }}>
                <td colSpan={columns.length + 1} />
              </tr>
            )}

            {slice.map((row, i) => (
              <tr key={range.start + i} className="clay-row even:bg-muted/30" style={{ height: ROW_HEIGHT }}>
                <td
                  dir="ltr"
                  className="border-b border-border/40 px-4 py-2.5 text-center font-mono text-xs text-muted-foreground"
                >
                  {range.start + i + 1}
                </td>
                {columns.map((col) => {
                  const v = row[col] ?? null;
                  const num = isNumeric(v);
                  return (
                    <td
                      key={col}
                      dir={num ? "ltr" : "auto"}
                      className={cn(
                        "max-w-[22rem] truncate border-b border-border/40 px-4 py-2.5",
                        num && "text-start font-mono tabular-nums",
                        v === null && "text-muted-foreground/60",
                      )}
                      title={v === null ? "" : String(v)}
                    >
                      {v === null ? "—" : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Spacer أسفل لتعبئة المساحة المتبقية */}
            {bottomSpacer > 0 && (
              <tr style={{ height: bottomSpacer }}>
                <td colSpan={columns.length + 1} />
              </tr>
            )}

            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-12 text-center text-muted-foreground">
                  {loading ? "جارٍ الجلب من DuckDB..." : (error ?? "لا توجد نتائج مطابقة لبحثك.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
