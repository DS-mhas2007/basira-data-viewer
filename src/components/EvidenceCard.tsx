/**
 * الوحدة 6: بطاقة الدليل (Evidence Card).
 * عرض فقط — لا تغيير في منطق الوحدة 4 (OpenRouter) ولا في المدقق (الوحدة 5).
 */
import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Filter,
  Pin,
  Rows3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AiPlan } from "@/lib/ai-query.functions";
import type { Row } from "@/lib/parse-file";

export interface HighlightMetric {
  label: string;
  value: string;
}

export interface EvidenceData {
  id: string;
  title: string;
  sql: string;
  filters: string[];
  baseRowCount: number | null;
  resultRowCount: number;
  highlights: HighlightMetric[];
  warnings: string[];
}

const SQL_KEYWORDS =
  /\b(SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|LIMIT|WITH|AS|AND|OR|NOT|IN|IS|NULL|JOIN|LEFT|RIGHT|INNER|OUTER|ON|HAVING|DESC|ASC|CASE|WHEN|THEN|ELSE|END|DISTINCT|BETWEEN|LIKE|UNION|ALL)\b/gi;

function SqlHighlight({ sql }: { sql: string }) {
  const parts: { text: string; kw: boolean }[] = [];
  let last = 0;
  for (const m of sql.matchAll(SQL_KEYWORDS)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ text: sql.slice(last, i), kw: false });
    parts.push({ text: m[0], kw: true });
    last = i + m[0].length;
  }
  parts.push({ text: sql.slice(last), kw: false });
  return (
    <pre
      dir="ltr"
      className="clay-inset overflow-x-auto rounded-xl border border-border/70 bg-background/60 p-3 text-left font-mono text-xs leading-relaxed"
    >
      {parts.map((p, i) => (
        <span key={i} className={p.kw ? "font-semibold text-primary" : "text-foreground/85"}>
          {p.text}
        </span>
      ))}
    </pre>
  );
}

function Metric({ metric }: { metric: HighlightMetric }) {
  return (
    <div className="clay-inset rounded-xl border border-border/70 px-4 py-3">
      <p className="font-mono text-2xl font-bold text-primary">{metric.value}</p>
      <p dir="auto" className="mt-1 truncate text-xs text-muted-foreground">
        {metric.label}
      </p>
    </div>
  );
}

interface Props {
  evidence: EvidenceData;
  plan: AiPlan;
  rows: Row[];
  chart: React.ReactNode;
  pinned: boolean;
  onPin: () => void;
}

export function EvidenceCard({ evidence, rows, chart, pinned, onPin }: Props) {
  const [openSql, setOpenSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(evidence.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* تجاهل: المتصفح قد يمنع الوصول للحافظة */
    }
  };

  return (
    <article className="clay space-y-5 rounded-2xl border border-border/70 bg-card/70 px-4 py-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-display text-base font-bold leading-relaxed">{evidence.title}</h3>
        <Button
          type="button"
          variant={pinned ? "secondary" : "outline"}
          size="sm"
          onClick={onPin}
          disabled={pinned}
          className="clay-press h-9 shrink-0 gap-2 rounded-xl"
        >
          <Pin className="size-4" strokeWidth={2} />
          {pinned ? "مثبّت" : "تثبيت هذا الاستنتاج"}
        </Button>
      </header>

      {evidence.highlights.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {evidence.highlights.map((m, i) => (
            <Metric key={i} metric={m} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="clay-inset flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1 text-muted-foreground">
          <Rows3 className="size-3.5 text-accent" strokeWidth={2} />
          الصفوف الداخلة في الحساب:{" "}
          <span className="font-mono text-foreground">
            {evidence.baseRowCount === null ? "—" : evidence.baseRowCount.toLocaleString("en-US")}
          </span>
        </span>
        <span className="clay-inset flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1 text-muted-foreground">
          صفوف النتيجة:{" "}
          <span className="font-mono text-foreground">
            {evidence.resultRowCount.toLocaleString("en-US")}
          </span>
        </span>
      </div>

      {evidence.filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="size-3.5 text-accent" strokeWidth={2} />
            الفلاتر المطبقة:
          </span>
          {evidence.filters.map((f, i) => (
            <span
              key={i}
              dir="ltr"
              className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-[11px] text-accent"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      {chart}

      {columns.length > 0 && (
        <div className="clay-inset max-h-80 overflow-auto rounded-xl border border-border/70">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card/95 backdrop-blur">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c}
                    dir="ltr"
                    className="px-3 py-2 text-right font-mono text-xs font-semibold text-muted-foreground"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border/50">
                  {columns.map((c) => (
                    <td key={c} dir="auto" className="px-3 py-2 font-mono text-xs">
                      {r[c] === null ? "—" : String(r[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenSql((v) => !v)}
            className="clay-press flex flex-1 items-center gap-2 rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm transition hover:border-primary/50"
            aria-expanded={openSql}
          >
            <Code2 className="size-4 text-primary" strokeWidth={2} />
            عرض الاستعلام SQL
            <ChevronDown
              className={`ms-auto size-4 text-muted-foreground transition-transform ${openSql ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copy()}
            className="clay-press h-9 gap-2 rounded-xl"
          >
            {copied ? (
              <Check className="size-4 text-primary" strokeWidth={2} />
            ) : (
              <Copy className="size-4" strokeWidth={2} />
            )}
            {copied ? "تم النسخ" : "نسخ"}
          </Button>
        </div>
        {openSql && <SqlHighlight sql={evidence.sql} />}
      </div>

      {evidence.warnings.length > 0 && (
        <ul className="space-y-1.5">
          {evidence.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[#F5C978]" strokeWidth={2} />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
