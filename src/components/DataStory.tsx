import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { BasiraLogo } from "@/components/BasiraLogo";
import { AuditSealBadge } from "@/components/AuditSeal";
import { VoiceSummaryButton } from "@/components/VoiceSummaryButton";
import { formatNumber, type DatasetProfile } from "@/lib/profile";
import type { HealthReport } from "@/lib/data-health";
import type { AnomalySignal } from "@/lib/anomaly-radar";
import type { AuditSeal } from "@/lib/audit-seal";

export interface StorySlide {
  kind: "kpi" | "chart" | "text";
  eyebrow: string;
  title: string;
  value?: string;
  note?: string;
  data?: { label: string; count: number }[];
}

export function buildStorySlides(params: {
  fileName: string;
  health: HealthReport | null;
  profile: DatasetProfile | null;
  signals: AnomalySignal[];
  insights: string[];
}): StorySlide[] {
  const slides: StorySlide[] = [];
  const h = params.health;
  if (h) {
    slides.push({
      kind: "kpi",
      eyebrow: "المؤشر الأهم",
      title: "درجة جودة البيانات",
      value: `${Math.round(h.score)}/100`,
      note: `${h.rowCount.toLocaleString("ar-EG")} صف · ${h.columnCount} عمود · ${(h.missingRatio * 100).toFixed(1)}% قيم مفقودة`,
    });
  }
  const numeric = params.profile?.cards.find((c) => c.kind === "numeric");
  if (numeric && numeric.kind === "numeric") {
    slides.push({
      kind: "kpi",
      eyebrow: "رقم يستحق الانتباه",
      title: `متوسط ${numeric.column}`,
      value: formatNumber(numeric.avg),
      note: `الأدنى ${formatNumber(numeric.min)} · الأعلى ${formatNumber(numeric.max)} · الوسيط ${formatNumber(numeric.median)}`,
    });
  }
  const chartCard = params.profile?.cards.find((c) => c.kind === "categorical" || c.kind === "trend");
  if (chartCard) {
    const data = chartCard.kind === "categorical" ? chartCard.top : chartCard.points;
    slides.push({
      kind: "chart",
      eyebrow: "الرسم الرئيسي",
      title:
        chartCard.kind === "categorical"
          ? `أعلى الفئات في ${chartCard.column}`
          : `التوزيع الزمني لـ ${chartCard.column}`,
      data: data.slice(0, 8),
    });
  }
  for (const s of params.signals.slice(0, 2)) {
    slides.push({ kind: "text", eyebrow: "رادار الإشارات الغريبة", title: s.title, note: s.detail });
  }
  for (const i of params.insights.slice(0, 2)) {
    slides.push({ kind: "text", eyebrow: "التوصية الذهبية", title: i });
  }
  if (slides.length === 0) {
    slides.push({
      kind: "text",
      eyebrow: "بصيرة",
      title: "ارفع ملفاً لبدء قصة بياناتك",
    });
  }
  return slides;
}

export function DataStory({
  open,
  onOpenChange,
  slides,
  fileName,
  seal,
  voiceText,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slides: StorySlide[];
  fileName: string;
  seal: AuditSeal | null;
  voiceText: string;
}) {
  const [i, setI] = useState(0);
  const count = slides.length;
  const slide = slides[Math.min(i, count - 1)];

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
      if (e.key === "ArrowLeft") setI((v) => Math.min(v + 1, count - 1));
      if (e.key === "ArrowRight") setI((v) => Math.max(v - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, count, onOpenChange]);

  const chartData = useMemo(() => slide?.data ?? [], [slide]);
  if (!open || !slide) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[80] flex flex-col bg-background/98 backdrop-blur-2xl"
      role="dialog"
      aria-modal="true"
    >
      {/* أشرطة التقدم */}
      <div className="flex gap-1.5 px-4 pt-4 sm:px-8">
        {slides.map((_, idx) => (
          <span key={idx} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: idx <= i ? "100%" : "0%" }}
            />
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3 px-4 py-3 sm:px-8">
        <BasiraLogo className="h-7 w-auto" />
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{fileName}</p>
        <VoiceSummaryButton text={voiceText} />
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="clay-press rounded-xl border border-white/10 p-2 text-muted-foreground hover:text-foreground"
          aria-label="إغلاق"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 pb-8 sm:px-10">
        <button
          type="button"
          aria-label="السابق"
          onClick={() => setI((v) => Math.max(v - 1, 0))}
          className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/10 bg-white/5 p-2 text-muted-foreground hover:text-primary sm:block"
        >
          <ChevronRight className="size-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label="التالي"
          onClick={() => setI((v) => Math.min(v + 1, count - 1))}
          className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/10 bg-white/5 p-2 text-muted-foreground hover:text-primary sm:block"
        >
          <ChevronLeft className="size-5" strokeWidth={2} />
        </button>

        <div
          key={i}
          className="rise-in glass aura mx-auto w-full max-w-3xl rounded-3xl px-6 py-10 text-center sm:px-12 sm:py-14"
          onClick={() => setI((v) => (v + 1 < count ? v + 1 : v))}
        >
          <span className="glass-pill mx-auto text-[11px] text-muted-foreground">{slide.eyebrow}</span>
          <h2 className="mx-auto mt-6 max-w-2xl font-display text-2xl font-bold leading-snug sm:text-4xl">
            {slide.title}
          </h2>
          {slide.value && (
            <p className="text-gradient mt-6 font-display text-5xl font-bold sm:text-7xl" dir="ltr">
              {slide.value}
            </p>
          )}
          {slide.kind === "chart" && chartData.length > 0 && (
            <div className="mt-8 h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8b9bb4" }} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: "#8b9bb4" }} />
                  <Tooltip
                    contentStyle={{
                      background: "#031021",
                      border: "1px solid rgba(96,245,210,0.25)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="#60F5D2" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {slide.note && (
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {slide.note}
            </p>
          )}
          {seal && <AuditSealBadge seal={seal} className="mt-8 text-right" />}
          <p className="mt-6 text-[11px] text-muted-foreground">
            انقر للمتابعة · {i + 1} / {count}
          </p>
        </div>
      </div>
    </div>
  );
}