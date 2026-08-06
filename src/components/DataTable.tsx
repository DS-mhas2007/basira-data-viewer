import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/parse-file";

const PREVIEW_LIMIT = 100;

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

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في البيانات..."
            className="clay-press rounded-xl pe-9 focus-visible:ring-0"
          />
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {loading && <Loader2 className="size-4 animate-spin text-primary" />}
          عرض <span dir="ltr" className="font-mono">{visible.length}</span> من{" "}
          <span dir="ltr" className="font-mono">{matches}</span> صف مطابق
          {matches > PREVIEW_LIMIT && " (أول 100 صف فقط)"}
        </p>
      </div>

      <div className="clay max-h-[32rem] overflow-auto rounded-2xl border border-border/70 bg-card">
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
                        "focus-glow flex w-full cursor-pointer items-center gap-1.5 whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold transition-colors duration-200 hover:bg-primary/10 active:bg-primary/15",
                        active ? "text-primary" : "text-secondary-foreground",
                      )}
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
            {visible.map((row, i) => (
              <tr key={i} className="clay-row even:bg-muted/30">
                <td
                  dir="ltr"
                  className="border-b border-border/40 px-4 py-2.5 text-center font-mono text-xs text-muted-foreground"
                >
                  {i + 1}
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