import { EvidenceCard } from "@/components/EvidenceCard";
import { ChartView } from "@/components/AskData";
import { Pin } from "@/components/icons";
import type { PinnedInsight } from "@/lib/report";
import type { TableInfo } from "@/lib/duckdb-service";

/** الرؤى المثبّتة بأدلّتها الكاملة (SQL، الصفوف، التحذيرات) مع إمكان إلغاء التثبيت. */
export default function PinnedInsightsList({
  pinned,
  tableInfo,
  onUnpin,
}: {
  pinned: PinnedInsight[];
  tableInfo: TableInfo | null;
  onUnpin: (id: string) => void;
}) {
  if (pinned.length === 0) return null;
  return (
    <section className="space-y-3" aria-label="الرؤى المثبتة">
      <h3 className="flex items-center gap-2 font-display text-base font-bold">
        <Pin className="size-4 text-primary" strokeWidth={2} />
        الرؤى المثبتة
        <span className="font-mono text-xs font-normal text-muted-foreground">{pinned.length}</span>
      </h3>
      <div className="space-y-4">
        {pinned.map((p) => (
          <EvidenceCard
            key={p.evidence.id}
            tableInfo={tableInfo}
            evidence={p.evidence}
            plan={p.plan}
            rows={p.rows}
            pinned
            onPin={() => {}}
            onUnpin={() => onUnpin(p.evidence.id)}
            chart={<ChartView plan={p.plan} rows={p.rows} />}
          />
        ))}
      </div>
    </section>
  );
}
