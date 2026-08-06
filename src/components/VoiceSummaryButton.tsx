import { useEffect, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speak, speechSupported, stopSpeaking } from "@/lib/voice-summary";
import { toast } from "sonner";

export function VoiceSummaryButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(speechSupported());
    return () => stopSpeaking();
  }, []);

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className ?? "clay-press rounded-xl border-white/10 bg-white/[0.03]"}
      onClick={() => {
        if (playing) {
          stopSpeaking();
          setPlaying(false);
          return;
        }
        if (!text.trim()) {
          toast("لا يوجد ملخص للقراءة بعد");
          return;
        }
        setPlaying(true);
        speak(text, () => setPlaying(false));
      }}
    >
      {playing ? (
        <Square className="size-4 text-accent" strokeWidth={2.25} />
      ) : (
        <Volume2 className="size-4 text-primary" strokeWidth={2.25} />
      )}
      {playing ? "إيقاف" : "استمع للموجز"}
    </Button>
  );
}