import { MessageSquareText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AskData } from "@/components/AskData";
import type { TableInfo } from "@/lib/duckdb-service";
import type { Row } from "@/lib/parse-file";
import type { HealthReport } from "@/lib/data-health";
import type { PinnedInsight } from "@/lib/report";

interface Props {
  tableInfo: TableInfo;
  sample: Row[];
  health: HealthReport | null;
  pinned: PinnedInsight[];
  onPinnedChange: (next: PinnedInsight[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AskDataDrawer({
  tableInfo,
  sample,
  health,
  pinned,
  onPinnedChange,
  open,
  onOpenChange,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-full flex-col gap-0 border-e border-border/60 bg-card p-0 sm:max-w-[560px]"
      >
        <SheetHeader className="shrink-0 border-b border-border/50 px-5 py-4 text-start">
          <SheetTitle className="flex items-center gap-2.5 font-display text-lg font-bold">
            <span className="flex size-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Sparkles className="size-4" strokeWidth={2} />
            </span>
            اسأل عن بياناتك
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            اطرح سؤالاً بالعربية وسيُترجم إلى استعلام آمن على بياناتك المحلية.
          </p>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <AskData
            bare
            tableInfo={tableInfo}
            sample={sample}
            health={health}
            pinned={pinned}
            onPinnedChange={onPinnedChange}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AskDataFab({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <Button
      onClick={onClick}
      className="clay fixed bottom-6 left-6 z-30 h-12 gap-2 rounded-2xl px-5 shadow-lift transition-all duration-300 hover:-translate-y-0.5"
    >
      <MessageSquareText className="size-4" strokeWidth={2} />
      <span className="font-medium">اسأل بياناتك</span>
      {count > 0 && (
        <span className="rounded-lg bg-primary-foreground/15 px-2 py-0.5 font-mono text-[11px]">
          {count}
        </span>
      )}
    </Button>
  );
}