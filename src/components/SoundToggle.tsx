/** مفتاح إيقاف/تشغيل الأصوات التفاعلية الخفيفة. */
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playSfx, setSfxEnabled, sfxEnabled } from "@/lib/sfx";

export function SoundToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(sfxEnabled()), []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={on ? "إيقاف الأصوات" : "تشغيل الأصوات"}
      title={on ? "الأصوات التفاعلية مفعّلة" : "الأصوات التفاعلية موقوفة"}
      className="clay-press size-9 rounded-xl text-muted-foreground hover:text-foreground"
      onClick={() => {
        const next = !on;
        setOn(next);
        setSfxEnabled(next);
        if (next) playSfx("tap");
      }}
    >
      {on ? <Volume2 className="size-4" strokeWidth={2} /> : <VolumeX className="size-4" strokeWidth={2} />}
    </Button>
  );
}
