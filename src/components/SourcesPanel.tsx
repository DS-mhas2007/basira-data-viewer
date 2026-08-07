import React, { useEffect, useState } from "react";
import { duckdb } from "@/lib/duckdb-service";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type SourcesPanelProps = {
  onPreview?: (tableName: string) => void;
  onOpenJoin?: (leftAlias?: string) => void;
};

export function SourcesPanel({ onPreview, onOpenJoin }: SourcesPanelProps) {
  const [sources, setSources] = useState<{ alias: string; table: string; info: any }[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const list = await duckdb.listSources();
      setSources(list);
    } catch (e) {
      console.error(e);
      toast.error("فشل جلب المصادر");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleDrop(alias: string) {
    try {
      await duckdb.dropSource(alias);
      toast.success("تم حذف المصدر");
      void refresh();
    } catch (e) {
      console.error(e);
      toast.error("فشلت إزالة المصدر");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">المصادر</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => void refresh()}>
            تحديث
          </Button>
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">جارٍ التحميل…</div>}

      {!loading && sources.length === 0 && (
        <div className="text-sm text-muted-foreground">لا توجد مصادر مسجّلة. ارفع ملفاً لبدء التحليل.</div>
      )}

      <div className="grid gap-3">
        {sources.map((s) => (
          <div key={s.alias} className="glass rounded-xl p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{s.alias}</p>
                  <p className="text-xs text-muted-foreground">{s.info.rowCount?.toLocaleString?.() ?? 0} صف</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{s.table}</p>
                <div className="mt-2 text-xs text-muted-foreground">
                  {s.info.schema?.slice(0, 6).map((c: any) => c.name).join(", ")}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onPreview?.(s.table)}
                >
                  معاينة
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenJoin?.(s.alias)}
                >
                  دمج
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleDrop(s.alias)}
                >
                  حذف
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SourcesPanel;
