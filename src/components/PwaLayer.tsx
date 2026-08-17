import { useEffect, useState } from "react";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";
import { PWA_COPY, setupServiceWorker } from "@/lib/pwa";

/** طبقة PWA: شريط انقطاع الاتصال + إشعار التحديث. تُركّب مرة واحدة في الجذر. */
export function PwaLayer() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", () => {
      sync();
      toast.success(PWA_COPY.backOnline);
    });
    window.addEventListener("offline", sync);
    void setupServiceWorker((updateNow) => {
      toast(PWA_COPY.update, {
        duration: Infinity,
        action: { label: PWA_COPY.updateAction, onClick: updateNow },
      });
    });
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-warning/15 px-3 py-2 text-center text-[11px] leading-tight text-foreground backdrop-blur-md"
    >
      <WifiOff className="size-3.5 shrink-0" strokeWidth={2} />
      <span className="min-w-0">{PWA_COPY.offline}</span>
    </div>
  );
}