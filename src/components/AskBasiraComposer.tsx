import { useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onAsk: (question: string) => void;
  suggestions: string[];
  disabled?: boolean;
}

/** قلب المنتج: مُلحِّن السؤال الرئيسي "اسأل بصيرة". */
export function AskBasiraComposer({ onAsk, suggestions, disabled = false }: Props) {
  const [value, setValue] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q || disabled) return;
    onAsk(q);
    setValue("");
  }

  return (
    <section
      aria-labelledby="ask-basira-title"
      className="relative overflow-hidden rounded-2xl border border-primary/20 bg-surface-1 p-5 sm:p-6"
    >
      {/* توهّج خفيف جداً مخصّص لحالة الذكاء الاصطناعي فقط */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 start-1/4 size-64 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 end-0 size-56 rounded-full bg-accent/10 blur-3xl"
      />

      <div className="relative">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="size-4" strokeWidth={2} />
          <h2 id="ask-basira-title" className="font-display text-sm font-bold tracking-tight">
            اسأل بصيرة
          </h2>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
          ماذا تريد أن تعرف عن بياناتك؟
        </p>

        <form onSubmit={submit} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <label htmlFor="ask-basira-input" className="sr-only">
            اكتب سؤالك عن البيانات
          </label>
          <input
            id="ask-basira-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={disabled}
            maxLength={500}
            autoComplete="off"
            placeholder="مثال: لماذا انخفضت المبيعات هذا الشهر؟"
            className="h-12 min-w-0 flex-1 rounded-xl border border-border/70 bg-background/60 px-4 text-sm outline-none transition-colors duration-200 placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={disabled || !value.trim()}
            className="h-12 shrink-0 gap-2 rounded-xl px-6 text-sm font-bold"
          >
            تحليل
            <ArrowLeft className="size-4" strokeWidth={2.25} />
          </Button>
        </form>

        {suggestions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                disabled={disabled}
                onClick={() => onAsk(s)}
                className="min-h-[36px] rounded-lg border border-border/60 bg-surface-2 px-3 py-1.5 text-start text-[11px] leading-relaxed text-muted-foreground transition-colors duration-200 hover:border-primary/40 hover:text-primary disabled:opacity-50 sm:text-xs"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
