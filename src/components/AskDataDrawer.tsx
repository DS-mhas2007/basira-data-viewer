import { useEffect, useState } from "react";
import { AlertCircle, Loader2, MessageSquareText, Plus, Sparkles } from "lucide-react";
import type { UIMessage } from "ai";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AskData } from "@/components/AskData";
import { AgentChatWindow } from "@/components/AgentChatWindow";
import { supabase } from "@/integrations/supabase/client";
import { ensureGuestSession } from "@/lib/ai-action";
import { createThread, listThreads, loadMessages, moveThreadToProject, renameThread, type ChatThread } from "@/lib/chat-threads";
import type { TableInfo } from "@/lib/duckdb-service";
import type { Row } from "@/lib/parse-file";
import type { HealthReport } from "@/lib/data-health";
import type { PinnedInsight } from "@/lib/report";

interface Props {
  projectId: string | null;
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
  projectId,
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
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [legacyThreads, setLegacyThreads] = useState<ChatThread[]>([]);
  const [legacyThreadId, setLegacyThreadId] = useState("");
  const [importingLegacy, setImportingLegacy] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [chatError, setChatError] = useState(false);

  useEffect(() => {
    if (initialQuestion?.trim()) setTab("quick");
  }, [initialQuestion]);

  // كل مشروع يحمّل قائمة محادثاته فقط، ويبدأ محادثة مستقلة إن لم توجد.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setThreadId(null);
    setMessages(null);
    setThreads([]);
    setLegacyThreads([]);
    setLegacyThreadId("");
    setAuthed(null);
    setChatError(false);
    setLoadingThreads(true);
    void (async () => {
      await ensureGuestSession();
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setAuthed(false);
        setLoadingThreads(false);
        return;
      }
      setAuthed(true);
      try {
        const [projectThreads, unassignedThreads] = await Promise.all([
          listThreads(projectId),
          projectId ? listThreads(null) : Promise.resolve([]),
        ]);
        const target = projectThreads[0] ?? (await createThread("محادثة جديدة", projectId));
        const nextThreads = projectThreads.length ? projectThreads : [target];
        const msgs = await loadMessages(target.id, projectId);
        if (cancelled) return;
        setThreads(nextThreads);
        setLegacyThreads(unassignedThreads);
        setThreadId(target.id);
        setMessages(msgs);
      } catch (error) {
        console.error("[mizya] project chat initialization failed", error);
        if (!cancelled) {
          setMessages(null);
          setChatError(true);
        }
      } finally {
        if (!cancelled) setLoadingThreads(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, projectId]);

  async function handleSelectThread(nextId: string) {
    if (!nextId || nextId === threadId) return;
    setMessages(null);
    setThreadId(nextId);
    try {
      const nextMessages = await loadMessages(nextId, projectId);
      setMessages(nextMessages);
    } catch {
      setMessages([]);
      toast.error("تعذّر تحميل رسائل هذه المحادثة");
    }
  }

  async function handleImportLegacyThread() {
    if (!projectId || !legacyThreadId || importingLegacy) return;
    setImportingLegacy(true);
    try {
      const moved = await moveThreadToProject(legacyThreadId, projectId);
      const importedMessages = await loadMessages(moved.id, projectId);
      setThreads((current) => [moved, ...current]);
      setLegacyThreads((current) => current.filter((thread) => thread.id !== moved.id));
      setLegacyThreadId("");
      setThreadId(moved.id);
      setMessages(importedMessages);
      setTab("agent");
      toast.success("تم ربط المحادثة القديمة بهذا المشروع");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر ربط المحادثة بالمشروع");
    } finally {
      setImportingLegacy(false);
    }
  }

  async function handleCreateThread() {
    if (creatingThread) return;
    setCreatingThread(true);
    try {
      const next = await createThread("محادثة جديدة", projectId);
      setThreads((current) => [next, ...current]);
      setThreadId(next.id);
      setMessages([]);
      setTab("agent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر إنشاء محادثة");
    } finally {
      setCreatingThread(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="mz-glass-card mz-glass-card--dual flex w-full flex-col gap-0 border-e border-white/10 p-0 sm:max-w-[560px]"
      >
        <SheetHeader className="shrink-0 border-b border-white/10 px-5 py-4 text-start">
          <SheetTitle className="flex items-center gap-2.5 font-display text-lg font-bold">
            <span className="flex size-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Sparkles className="size-4" strokeWidth={2} />
            </span>
            اسأل عن بياناتك
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            محادثة ذكية تنفّذ الاستعلامات والتنظيف والرسوم — والملف نفسه يبقى في متصفحك (يُرسل للنموذج أسماء الأعمدة وعيّنة صغيرة فقط).
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
            {authed && (
              <div className="mz-glass-inset mx-5 mb-3 mt-3 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2">
                <select
                  aria-label="محادثة المشروع الحالية"
                  value={threadId ?? ""}
                  onChange={(event) => void handleSelectThread(event.target.value)}
                  disabled={loadingThreads || threads.length === 0}
                  className="h-9 min-w-0 flex-1 rounded-xl border border-border/60 bg-background px-3 text-xs outline-none focus:border-primary"
                >
                  {threads.map((thread) => (
                    <option key={thread.id} value={thread.id}>{thread.title}</option>
                  ))}
                </select>
                <Button size="sm" variant="outline" className="h-9 shrink-0 rounded-xl" onClick={() => void handleCreateThread()} disabled={creatingThread || loadingThreads}>
                  {creatingThread ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  جديدة
                </Button>
              </div>
            )}
            {authed && legacyThreads.length > 0 && projectId && (
              <details className="mx-5 mb-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2">
                <summary className="cursor-pointer list-none text-xs text-muted-foreground">
                  محادثات سابقة غير مرتبطة بمشروع ({legacyThreads.length})
                </summary>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    aria-label="اختر محادثة قديمة لربطها بالمشروع"
                    value={legacyThreadId}
                    onChange={(event) => setLegacyThreadId(event.target.value)}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-border/60 bg-background px-2 text-xs"
                  >
                    <option value="">اختر محادثة</option>
                    {legacyThreads.map((thread) => (
                      <option key={thread.id} value={thread.id}>{thread.title}</option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={() => void handleImportLegacyThread()} disabled={!legacyThreadId || importingLegacy}>
                    {importingLegacy ? <Loader2 className="size-3.5 animate-spin" /> : "ربط"}
                  </Button>
                </div>
              </details>
            )}
            {authed === false ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
                سجّل الدخول لتشغيل المحادثة الذكية وحفظ سجلّها.
                <Button asChild size="sm" className="rounded-xl">
                  <a href="/auth">تسجيل الدخول</a>
                </Button>
              </div>
            ) : chatError ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
                <AlertCircle className="size-5 text-destructive" />
                تعذّر تجهيز محادثات هذا المشروع. قد تحتاج قاعدة البيانات إلى تحديث.
              </div>
            ) : threadId && messages ? (
              <AgentChatWindow
                key={threadId}
                threadId={threadId}
                projectId={projectId}
                initialMessages={messages}
                onFirstMessage={(text) => {
                  const title = text.trim().slice(0, 40) || "محادثة جديدة";
                  void renameThread(threadId, title, projectId).then(() => {
                    setThreads((current) => current.map((thread) =>
                      thread.id === threadId ? { ...thread, title, updated_at: new Date().toISOString() } : thread,
                    ));
                  }).catch(() => undefined);
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
