import React, { useEffect, useMemo, useState } from "react";
import { duckdb } from "@/lib/duckdb-service";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type JoinType = "inner" | "left" | "right" | "full";

export function JoinBuilder({
  open,
  onClose,
  leftAlias,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  leftAlias?: string;
  onCreated?: (info: { view: string; tableInfo: any }) => void;
}) {
  const [sources, setSources] = useState<{ alias: string; table: string; info: any }[]>([]);
  const [left, setLeft] = useState<string | undefined>(leftAlias);
  const [right, setRight] = useState<string | undefined>(undefined);
  const [leftCol, setLeftCol] = useState<string | undefined>(undefined);
  const [rightCol, setRightCol] = useState<string | undefined>(undefined);
  const [joinType, setJoinType] = useState<JoinType>("inner");
  const [previewRows, setPreviewRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewName, setViewName] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const list = await duckdb.listSources();
        setSources(list);
        if (leftAlias && !left) setLeft(leftAlias);
      } catch (e) {
        console.error(e);
        toast.error("فشل جلب قائمة المصادر");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const leftCols = useMemo(() => {
    const s = sources.find((x) => x.alias === left);
    return s?.info?.schema?.map((c: any) => ({ name: c.name, type: c.type })) ?? [];
  }, [sources, left]);

  const rightCols = useMemo(() => {
    const s = sources.find((x) => x.alias === right);
    return s?.info?.schema?.map((c: any) => ({ name: c.name, type: c.type })) ?? [];
  }, [sources, right]);

  function defaultViewName() {
    const t = new Date().toISOString().replace(/[:.]/g, "-");
    return `join_${left ?? "L"}_${right ?? "R"}_${t}`;
  }

  function buildSql({ useSuffix = true, useCastOnMismatch = true }: { useSuffix?: boolean; useCastOnMismatch?: boolean }) {
    if (!left || !right || !leftCol || !rightCol) return null;
    const leftTable = sources.find((s) => s.alias === left)!.table;
    const rightTable = sources.find((s) => s.alias === right)!.table;

    // determine types to optionally cast
    const lType = leftCols.find((c) => c.name === leftCol)?.type ?? "";
    const rType = rightCols.find((c) => c.name === rightCol)?.type ?? "";

    const castNeeded = useCastOnMismatch && lType && rType && lType.toLowerCase() !== rType.toLowerCase();
    const onExpr = castNeeded
      ? `CAST(l.${quoteIdent(leftCol)} AS VARCHAR) = CAST(r.${quoteIdent(rightCol)} AS VARCHAR)`
      : `l.${quoteIdent(leftCol)} = r.${quoteIdent(rightCol)}`;

    const lProj = leftCols.map((c) => (useSuffix ? `l.${quoteIdent(c.name)} AS ${quoteIdent(c.name + "__l")}` : `l.${quoteIdent(c.name)}`));
    const rProj = rightCols.map((c) => (useSuffix ? `r.${quoteIdent(c.name)} AS ${quoteIdent(c.name + "__r")}` : `r.${quoteIdent(c.name)}`));

    const joinMap: Record<string, string> = { inner: "INNER JOIN", left: "LEFT JOIN", right: "RIGHT JOIN", full: "FULL OUTER JOIN" };
    const joinClause = joinMap[joinType];

    return `SELECT ${[...lProj, ...rProj].join(", ")} FROM ${quoteIdent(leftTable)} AS l ${joinClause} ${quoteIdent(rightTable)} AS r ON ${onExpr}`;
  }

  async function handlePreview() {
    const sql = buildSql({ useSuffix: true, useCastOnMismatch: true });
    if (!sql) return toast.error("اختر المصدرين وعمود المطابقة أولاً");
    setBusy(true);
    setPreviewRows(null);
    try {
      const rows = await duckdb.runSelect(sql, { limit: 100, timeoutMs: 5000 });
      setPreviewRows(rows);
    } catch (e) {
      console.error(e);
      toast.error("فشل إنشاء معاينة الانضمام");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateView() {
    const sql = buildSql({ useSuffix: true, useCastOnMismatch: true });
    if (!sql) return toast.error("اختر الإعدادات أولاً");
    const name = viewName || defaultViewName();
    setBusy(true);
    try {
      await duckdb.setRelation(sql, name);
      const info = await duckdb.describe(name);
      toast.success("تم إنشاء العرض بنجاح");
      onCreated?.({ view: name, tableInfo: info });
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("فشل تثبيت العرض");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full rounded-2xl bg-card p-6 shadow-lg">
        <header className="flex items-center justify-between">
          <h3 className="font-medium">منشئ الدمج (Join Builder)</h3>
          <div>
            <Button size="sm" variant="ghost" onClick={onClose}>
              إغلاق
            </Button>
          </div>
        </header>

        <div className="mt-4 grid gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">المصدر الأيسر</label>
              <Select value={left} onValueChange={(v) => { setLeft(v); setLeftCol(undefined); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((s) => (
                    <SelectItem key={s.alias} value={s.alias}>
                      {s.alias}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">المصدر الأيمن</label>
              <Select value={right} onValueChange={(v) => { setRight(v); setRightCol(undefined); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((s) => (
                    <SelectItem key={s.alias} value={s.alias}>
                      {s.alias}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">عمود المطابقة (يسار)</label>
              <Select value={leftCol} onValueChange={(v) => setLeftCol(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {leftCols.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name} — {c.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">عمود المطابقة (يمين)</label>
              <Select value={rightCol} onValueChange={(v) => setRightCol(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rightCols.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name} — {c.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">نوع الانضمام</label>
            <select value={joinType} onChange={(e) => setJoinType(e.target.value as JoinType)} className="rounded-md bg-input px-2 py-1">
              <option value="inner">INNER</option>
              <option value="left">LEFT</option>
              <option value="right">RIGHT</option>
              <option value="full">FULL OUTER</option>
            </select>

            <label className="ms-4 text-xs text-muted-foreground">اسم العرض (اختياري)</label>
            <input className="rounded-md bg-input px-2 py-1 flex-1" placeholder={defaultViewName()} value={viewName} onChange={(e) => setViewName(e.target.value)} />
          </div>

          <div className="flex gap-2 mt-3">
            <Button onClick={() => void handlePreview()} disabled={busy}>
              معاينة (100)
            </Button>
            <Button onClick={() => void handleCreateView()} variant="primary" disabled={busy}>
              تثبيت كـ View
            </Button>
            <Button variant="ghost" onClick={() => { setPreviewRows(null); }}>
              مسح المعاينة
            </Button>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-medium">المعاينة</h4>
            <div className="mt-2 max-h-64 overflow-auto rounded-md border bg-card p-2 text-xs">
              {busy && <div className="text-sm text-muted-foreground">جارٍ التحميل…</div>}
              {!busy && previewRows && previewRows.length === 0 && <div className="text-sm text-muted-foreground">لا توجد نتائج.</div>}
              {!busy && previewRows && previewRows.length > 0 && (
                <table className="w-full table-auto text-xs">
                  <thead>
                    <tr>
                      {Object.keys(previewRows[0]).slice(0, 20).map((c) => (
                        <th key={c} className="text-left pr-3">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i}>
                        {Object.values(r).slice(0, 20).map((v, j) => (
                          <td key={j} className="pr-3">{String(v ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// helper for quoting identifiers
function quoteIdent(name: string) {
  return `"${String(name).replace(/\"/g, '\"\"')}"`;
}
