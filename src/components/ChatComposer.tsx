import { useEffect, useRef } from "react";
import { ArrowUp, Square } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
}

export function ChatComposer({ value, onChange, onSend, onStop, busy }: ChatComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }, [value]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && value.trim()) onSend();
      }}
      className="mz-glass-inset flex min-w-0 items-end gap-2 rounded-xl border border-border/60 bg-background/60 p-2 focus-within:border-primary/50"
    >
      <Textarea
        ref={inputRef}
        aria-label="سؤالك عن البيانات"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (!busy && value.trim()) onSend();
          }
        }}
        rows={1}
        placeholder="اسأل عن بياناتك…"
        className="min-h-11 max-h-40 min-w-0 resize-none border-0 bg-transparent text-base leading-6 shadow-none focus-visible:ring-0 sm:text-sm"
      />
      {busy ? (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="size-11 shrink-0 rounded-lg"
          onClick={onStop}
          aria-label="إيقاف الإجابة"
          title="إيقاف الإجابة"
        >
          <Square className="size-4" />
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon"
          className="size-11 shrink-0 rounded-lg"
          disabled={!value.trim()}
          aria-label="إرسال السؤال"
          title="إرسال السؤال"
        >
          <ArrowUp className="size-4" />
        </Button>
      )}
    </form>
  );
}
