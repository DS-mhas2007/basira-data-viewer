import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { UIMessage } from "ai";
import { AgentChatWindow } from "@/components/AgentChatWindow";
import { BasiraLogo } from "@/components/BasiraLogo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  createThread,
  deleteThread,
  listThreads,
  loadMessages,
  renameThread,
  type ChatThread,
} from "@/lib/chat-threads";
import { Loader2, MessageSquarePlus, Trash2, LayoutGrid, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({
    meta: [
      { title: "الوكيل الذكي | بصيرة" },
      { name: "description", content: "تحدّث مع وكيل بصيرة الذكي عن بياناتك: استعلامات، رسوم، تنظيف وتقارير." },
      { property: "og:title", content: "الوكيل الذكي | بصيرة" },
      { property: "og:description", content: "محادثة عربية طبيعية مع وكيل تحليل البيانات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [messages, setMessages] = useState<UIMessage[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      setThreads(await listThreads());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر تحميل المحادثات");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    setMessages(null);
    void loadMessages(threadId)
      .then((m) => {
        if (!cancelled) setMessages(m);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMessages([]);
          toast.error(err instanceof Error ? err.message : "تعذّر تحميل الرسائل");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  async function newThread() {
    try {
      const t = await createThread();
      await refresh();
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إنشاء محادثة");
    }
  }

  async function removeThread(id: string) {
    try {
      await deleteThread(id);
      const rest = await listThreads();
      setThreads(rest);
      if (id === threadId) {
        const target = rest[0] ?? (await createThread());
        navigate({ to: "/chat/$threadId", params: { threadId: target.id }, replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر حذف المحادثة");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { next: "/chat" }, replace: true });
  }

  return (
    <div dir="rtl" className="flex h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-l border-border/60 bg-card/40 md:flex">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <BasiraLogo className="h-8 w-auto" />
          <span className="text-sm font-bold">الوكيل الذكي</span>
        </div>
        <div className="p-3">
          <Button onClick={() => void newThread()} className="w-full rounded-xl gap-2" size="sm">
            <MessageSquarePlus className="h-4 w-4" /> محادثة جديدة
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {threads.map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-1 rounded-xl px-2 ${
                t.id === threadId ? "bg-primary/15 text-primary" : "hover:bg-muted/40"
              }`}
            >
              <Link
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                className="flex-1 truncate py-2 text-right text-xs"
              >
                {t.title}
              </Link>
              <button
                type="button"
                aria-label="حذف المحادثة"
                onClick={() => void removeThread(t.id)}
                className="opacity-0 transition group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </nav>
        <div className="border-t border-border/60 p-3 space-y-1">
          <Link to="/" className="flex items-center gap-2 rounded-xl px-2 py-2 text-xs hover:bg-muted/40">
            <LayoutGrid className="h-3.5 w-3.5" /> العودة إلى مساحة العمل
          </Link>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-xs hover:bg-muted/40"
          >
            <LogOut className="h-3.5 w-3.5" /> تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {messages === null ? (
          <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> جارٍ تحميل المحادثة…
          </div>
        ) : (
          <AgentChatWindow
            key={threadId}
            threadId={threadId}
            initialMessages={messages}
            onFirstMessage={(text) => {
              const title = text.slice(0, 40);
              void renameThread(threadId, title).then(refresh).catch(() => undefined);
            }}
          />
        )}
      </main>
    </div>
  );
}
