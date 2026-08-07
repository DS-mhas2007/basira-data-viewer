import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { createThread, listThreads } from "@/lib/chat-threads";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const threads = await listThreads();
        const target = threads[0] ?? (await createThread());
        if (!cancelled) navigate({ to: "/chat/$threadId", params: { threadId: target.id }, replace: true });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذّر فتح المحادثات");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground gap-2" dir="rtl">
      <Loader2 className="h-4 w-4 animate-spin text-primary" /> جارٍ تجهيز المحادثة…
    </div>
  );
}
