import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/parse-file";

const PREVIEW_LIMIT = 100;

interface Props {
  columns: string[];
  rows: Row[];
}

type Dir = "asc" | "desc";

function isNumeric(v: unknown) {
  return typeof v === "number" && !Number.isNaN(v);
}

export function DataTable({ columns, rows }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ col: string; dir: Dir } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => columns.some((c) => String(r[c] ?? "").toLowerCase().includes(q)));
  }, [rows, columns, query]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sort.col] ?? null;
      const bv = b[sort.col] ?? null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp =
        isNumeric(av) && isNumeric(bv)
          ? (av as number) - (bv as number)
          : String(av).localeCompare(String(bv), "ar", { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sort]);

  const visible = sorted.slice(0, PREVIEW_LIMIT);

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
            className="pe-9"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          عرض <span dir="ltr" className="font-mono">{visible.length}</span> من{" "}
          <span dir="ltr" className="font-mono">{sorted.length}</span> صف مطابق
          {sorted.length > PREVIEW_LIMIT && " (أول 100 صف فقط)"}
        </p>
      </div>

      <div className="max-h-[32rem] overflow-auto rounded-xl border border-border bg-card shadow-[var(--shadow-panel)]">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-secondary">
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
                        "flex w-full items-center gap-1.5 whitespace-nowrap px-3 py-2.5 font-semibold transition-colors hover:bg-primary/10",
                        active ? "text-primary" : "text-secondary-foreground",
                      )}
                    >
                      <span dir="ltr" className="truncate">
                        {col}
                      </span>
                      {active ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-40" />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={i} className="even:bg-muted/40 hover:bg-primary/5">
                <td
                  dir="ltr"
                  className="border-b border-border/60 px-3 py-2 text-center font-mono text-xs text-muted-foreground"
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
                        "max-w-[22rem] truncate border-b border-border/60 px-3 py-2",
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
                  لا توجد نتائج مطابقة لبحثك.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}