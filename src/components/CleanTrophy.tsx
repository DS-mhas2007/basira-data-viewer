/**
 * مكافأة البيانات النقية: احتفال بأوراق متناثرة + شارة عند بلوغ الجودة 100/100.
 */
import { useEffect, useRef, useState } from "react";
import { Trophy, X } from "lucide-react";
import { playSfx } from "@/lib/sfx";

const COLORS = ["#60F5D2", "#D6B2FC", "#EEF2F7", "#3ED9B6"];

function Confetti({ run }: { run: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!run) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const count = reduce ? 30 : 120;
    const parts = Array.from({ length: count }, () => ({
      x: Math.random() * window.innerWidth,
      y: -20 - Math.random() * window.innerHeight * 0.5,
      w: 5 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      vy: 1.6 + Math.random() * 2.6,
      vx: -1 + Math.random() * 2,
      rot: Math.random() * Math.PI,
      vr: -0.12 + Math.random() * 0.24,
      c: COLORS[Math.floor(Math.random() * COLORS.length)]!,
    }));

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const fade = t > 3200 ? Math.max(0, 1 - (t - 3200) / 1200) : 1;
      ctx.globalAlpha = fade;
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t < 4400) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run]);

  if (!run) return null;
  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[92] size-full"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}

/** يراقب درجة الجودة ويحتفل عند بلوغها 100 بعد تنظيف. */
export function CleanTrophy({ score, steps }: { score: number | null; steps: number }) {
  const [show, setShow] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (score === 100 && steps > 0 && !fired.current) {
      fired.current = true;
      setShow(true);
      playSfx("trophy");
      const id = setTimeout(() => setShow(false), 6000);
      return () => clearTimeout(id);
    }
    if (score !== 100) fired.current = false;
  }, [score, steps]);

  if (!show) return null;

  return (
    <>
      <Confetti run={show} />
      <div className="pointer-events-none fixed inset-x-0 top-24 z-[93] flex justify-center px-4">
        <div className="scale-in pointer-events-auto flex items-center gap-3 rounded-2xl border border-primary/35 bg-card/85 px-5 py-3.5 shadow-[0_25px_70px_-30px_rgba(96,245,210,0.75)] backdrop-blur-xl">
          <div className="grid size-10 place-items-center rounded-xl border border-primary/30 bg-primary/[0.12]">
            <Trophy className="size-5 text-primary" strokeWidth={2.25} />
          </div>
          <div className="text-start">
            <p className="font-display text-sm font-bold">🏆 ملف نقي وموثوق 100%</p>
            <p className="text-xs text-muted-foreground">لا قيم مفقودة، لا تكرار، ولا أنواع مختلطة — عمل ممتاز.</p>
          </div>
          <button
            type="button"
            aria-label="إغلاق"
            onClick={() => setShow(false)}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </>
  );
}
