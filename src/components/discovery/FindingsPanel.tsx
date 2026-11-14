import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  Copy,
  ImageDown,
  Sparkles,
  Target,
} from "lucide-react";
import type { Finding } from "@/lib/findings";
import { findingCardBlob } from "@/lib/finding-card";

async function downloadCard(f: Finding) {
  const blob = await findingCardBlob(f);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `basira-${f.id}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ICON = {
  share: BarChart3,
  trend: ArrowUpRight,
  concentration: Target,
} as const;

const BIDI = /[\u2066\u2067\u2068\u2069]/g;

/** «ما وجدناه في بياناتك»: جمل عربية محسوبة محلياً بلا ذكاء اصطناعي. */
export function FindingsPanel({
  findings,
  loading,
  onAsk,
}: {
  findings: Finding[];
  loading: boolean;
  onAsk: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!loading && findings.length === 0) return null;
  async function copyAll() {
    const text = findings
      .map((f) => `• ${f.text}`)
      .join("\n")
      .replace(BIDI, "");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* الحافظة غير متاحة */
    }
  }
  return (
    <section
      aria-label="ما وجدناه في بياناتك"
      className="basira-panel rounded-2xl border border-primary/25 bg-card/75 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Sparkles className="size-4 text-primary" />
            ما وجدناه في بياناتك
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            قراءة هادئة لبياناتك، حُسبت محلياً في متصفحك دون ذكاء اصطناعي ودون خصم من حصتك.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {findings.length > 0 && (
            <button
              type="button"
              onClick={() => void copyAll()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "تم النسخ" : "نسخ النتائج"}
            </button>
          )}
          <button
            type="button"
            onClick={onAsk}
            className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition hover:bg-primary/10"
          >
            اسأل بصيرة عن المزيد
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {loading && findings.length === 0
          ? [0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-border/50 bg-muted/30"
                aria-hidden
              />
            ))
          : findings.map((f) => {
              const Icon = f.kind === "trend" && f.direction === -1 ? ArrowDownLeft : ICON[f.kind];
              const tone =
                f.kind === "trend" && f.direction === -1 ? "text-destructive" : "text-primary";
              return (
                <article
                  key={f.id}
                  className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/40 p-4"
                >
                  <span
                    className={`flex size-8 items-center justify-center rounded-lg bg-primary/10 ${tone}`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <p className="text-sm font-semibold leading-7">{f.text}</p>
                  {typeof f.bar === "number" && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${f.bar}%` }}
                      />
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground" dir="rtl">
                    {f.detail}
                  </p>
                  <button
                    type="button"
                    onClick={() => void downloadCard(f)}
                    className="mt-auto inline-flex items-center gap-1.5 self-start text-[11px] text-muted-foreground transition hover:text-primary"
                  >
                    <ImageDown className="size-3.5" />
                    حفظ كصورة
                  </button>
                </article>
              );
            })}
      </div>
    </section>
  );
}
