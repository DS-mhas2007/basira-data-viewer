import { useEffect, useState } from "react";
import { Loader2, MessageSquareText, Sparkles } from "lucide-react";
import type { UIMessage } from "ai";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AskData } from "@/components/AskData";
import { AgentChatWindow } from "@/components/AgentChatWindow";
import { supabase } from "@/integrations/supabase/client";
import { createThread, listThreads, loadMessages, renameThread } from "@/lib/chat-threads";
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
  /** سؤال قادم من مُلحِّن الصفحة الرئيسية — يفتح تبويب "سؤال سريع" وينفّذه. */
  initialQuestion?: string | undefined;
}

export function AskDataDrawer({
  tableInfo,
  sample,
  health,
  pinned,
  onPinnedChange,
  open,
  onOpenChange,
  initialQuestion,
}: Props) {
  const [tab, setTab] = useState("agent");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[] | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    if (initialQuestion?.trim()) setTab("quick");
  }, [initialQuestion]);

  // تجهيز محادثة الوكيل عند فتح اللوحة لأول مرة (تتطلب تسجيل دخول للحفظ السحابي)
  useEffect(() => {
    if (!open || threadId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setAuthed(false);
        return;
      }
      setAuthed(true);
      try {
        const threads = await listThreads();
        const target = threads[0] ?? (await createThread());
        const msgs = await loadMessages(target.id);
        if (cancelled) return;
        setThreadId(target.id);
        setMessages(msgs);
      } catch {
        if (!cancelled) setMessages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, threadId]);

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
            محادثة ذكية تنفّذ الاستعلامات والتنظيف والرسوم — وبياناتك تبقى في متصفحك.
          </p>
        </SheetHeader>
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
          <TabsList className="mx-5 mt-4 grid shrink-0 grid-cols-2 rounded-xl">
            <TabsTrigger value="agent" className="rounded-lg text-xs">
              محادثة ذكية
            </TabsTrigger>
            <TabsTrigger value="quick" className="rounded-lg text-xs">
              سؤال سريع
            </TabsTrigger>
          </TabsList>
          <TabsContent value="agent" className="min-h-0 flex-1 overflow-hidden">
            {authed === false ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
                سجّل الدخول لتشغيل المحادثة الذكية وحفظ سجلّها.
                <Button asChild size="sm" className="rounded-xl">
                  <a href="/auth">تسجيل الدخول</a>
                </Button>
              </div>
            ) : threadId && messages ? (
              <AgentChatWindow
                key={threadId}
                threadId={threadId}
                initialMessages={messages}
                onFirstMessage={(text) => {
                  void renameThread(threadId, text.slice(0, 40)).catch(() => undefined);
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" /> جارٍ تجهيز المحادثة…
              </div>
            )}
          </TabsContent>
          <TabsContent value="quick" className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <AskData
              bare
              initialQuestion={initialQuestion}
              tableInfo={tableInfo}
              sample={sample}
              health={health}
              pinned={pinned}
              onPinnedChange={onPinnedChange}
            />
          </TabsContent>
        </Tabs>
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
