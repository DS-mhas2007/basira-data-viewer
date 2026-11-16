import { useMemo, useState } from "react";
import { MIZYAiIcon, type MIZYAiIconName } from "@/components/MIZYAiIcon";
import { cn } from "@/lib/utils";

type Tone = "teal" | "lavender" | "dual";
type Group = "الكل" | "مساحة العمل" | "الذكاء والتحليل" | "النظام والإجراءات" | "الإحصاء وعلوم البيانات" | "تعلم الآلة";

const ICON_GROUPS: Array<{ label: string; names: MIZYAiIconName[] }> = [
  { label: "مساحة العمل", names: ["dashboard", "projects", "reports"] },
  { label: "الذكاء والتحليل", names: ["analytics", "assistant", "insights", "spark"] },
  { label: "النظام والإجراءات", names: ["settings", "alerts", "search", "database", "security", "cleaning", "upload", "download", "share", "filter", "success", "warning", "error"] },
  { label: "الإحصاء وعلوم البيانات", names: ["correlation", "distribution", "outliers", "quality"] },
  { label: "تعلم الآلة", names: ["prediction", "feature-engineering", "classification", "regression", "clustering", "model-evaluation", "confusion-matrix", "roc-curve", "cross-validation", "feature-importance"] },
];

const ICON_LABELS: Record<MIZYAiIconName, string> = {
  dashboard: "لوحة التحكم", analytics: "التحليلات", assistant: "المساعد الذكي", projects: "المشاريع",
  reports: "التقارير", settings: "الإعدادات", alerts: "التنبيهات", search: "البحث",
  database: "قاعدة البيانات", security: "الأمان", cleaning: "تنظيف البيانات", insights: "الرؤى",
  upload: "رفع ملف", download: "تنزيل", share: "مشاركة", filter: "تصفية",
  success: "نجاح", warning: "تحذير", error: "خطأ", spark: "لمسة ذكية",
  correlation: "الارتباط", distribution: "التوزيع", outliers: "القيم الشاذة", quality: "جودة البيانات",
  prediction: "التنبؤ", "feature-engineering": "هندسة الخصائص", classification: "التصنيف",
  regression: "الانحدار", clustering: "التجميع", "model-evaluation": "تقييم النموذج",
  "confusion-matrix": "مصفوفة الالتباس", "roc-curve": "منحنى ROC",
  "cross-validation": "التحقق المتقاطع", "feature-importance": "أهمية الخصائص",
};

const TONES: Array<{ value: Tone; label: string; color: string }> = [
  { value: "teal", label: "Teal", color: "#60F5D2" },
  { value: "lavender", label: "Lavender", color: "#D6B2FC" },
  { value: "dual", label: "Dual", color: "linear-gradient(110deg,#60F5D2,#D6B2FC)" },
];

const SWATCHES = [
  { label: "Void Navy", hex: "#010A19", usage: "الخلفية الأساسية" },
  { label: "Deep Navy", hex: "#07152D", usage: "الأسطح الرئيسية" },
  { label: "Surface", hex: "#0D1F3C", usage: "البطاقات" },
  { label: "Elevated", hex: "#112547", usage: "الأسطح المرتفعة" },
  { label: "Teal", hex: "#60F5D2", usage: "البيانات والإجراءات" },
  { label: "Lavender", hex: "#D6B2FC", usage: "الذكاء والرؤى" },
];

export function MIZYAiIconGallery() {
  const [tone, setTone] = useState<Tone>("dual");
  const [group, setGroup] = useState<Group>("الكل");
  const [query, setQuery] = useState("");
  const [surface, setSurface] = useState<"navy" | "surface" | "glass">("glass");

  const icons = useMemo(() => ICON_GROUPS
    .filter((item) => group === "الكل" || item.label === group)
    .flatMap((item) => item.names.map((name) => ({ name, group: item.label })))
    .filter(({ name, group: groupName }) => {
      const q = query.trim().toLocaleLowerCase();
      return !q || ICON_LABELS[name].toLocaleLowerCase().includes(q) || name.includes(q) || groupName.includes(q);
    }), [group, query]);

  const cardSurface = surface === "navy"
    ? "bg-[#010A19] border-white/10"
    : surface === "surface"
      ? "bg-[#0D1F3C] border-white/10"
      : "mz-glass-card mz-glass-card--dual";

  return (
    <main dir="rtl" className="min-h-screen bg-[#010A19] px-4 py-8 text-[#EEF2F7] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="mz-glass-card mz-glass-card--dual relative overflow-hidden rounded-[28px] p-6 sm:p-8">
          <div className="pointer-events-none absolute -left-16 -top-20 size-64 rounded-full bg-[#60F5D2]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-1/3 size-72 rounded-full bg-[#D6B2FC]/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-[#B9C7D8]">
                <MIZYAiIcon name="spark" tone="dual" className="size-4" />
                نظام الهوية البصرية · MIZYAi
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">معرض أيقونات Glass</h1>
              <p className="max-w-2xl text-sm leading-7 text-[#A0AEC0] sm:text-base">
                مكتبة SVG أصلية من 34 رمزاً. عاين توازن Teal وLavender على أسطح الهوية المعتمدة قبل اعتمادها في الواجهات.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#07152D]/75 px-4 py-3 backdrop-blur-xl">
              <MIZYAiIcon name="assistant" tone="dual" className="size-10" />
              <div>
                <p className="text-sm font-bold">34 أيقونة أصلية</p>
                <p className="text-xs text-[#A0AEC0]">5 مجموعات وظيفية</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SWATCHES.map((swatch) => (
            <div key={swatch.hex} className="mz-glass-card mz-glass-card--neutral flex items-center gap-3 rounded-2xl p-3">
              <div className="size-12 shrink-0 rounded-xl border border-white/15 shadow-inner" style={{ background: swatch.hex }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{swatch.label}</p>
                <p className="font-mono text-xs text-[#A0AEC0]" dir="ltr">{swatch.hex}</p>
                <p className="mt-1 text-[11px] text-[#8798AD]">{swatch.usage}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="mz-glass-card mz-glass-card--neutral space-y-4 rounded-3xl p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold">إعدادات المعاينة</h2>
              <p className="mt-1 text-xs text-[#A0AEC0]">غيّر النغمة والخلفية لرؤية التباين الحقيقي.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {TONES.map((item) => (
                <button key={item.value} type="button" onClick={() => setTone(item.value)}
                  aria-pressed={tone === item.value}
                  className={cn("inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                    tone === item.value ? "border-white/30 bg-white/10 text-white" : "border-white/10 bg-white/[0.025] text-[#A0AEC0] hover:bg-white/[0.06]")}>
                  <span className="size-3 rounded-full" style={{ background: item.color }} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="me-1 text-xs text-[#A0AEC0]">الخلفية:</span>
            {([
              ["navy", "Void Navy"],
              ["surface", "Surface"],
              ["glass", "Premium Glass"],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setSurface(value)} aria-pressed={surface === value}
                className={cn("rounded-lg border px-3 py-1.5 text-xs transition",
                  surface === value ? "border-[#60F5D2]/50 bg-[#60F5D2]/10 text-[#60F5D2]" : "border-white/10 text-[#A0AEC0] hover:border-white/20")}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
            <div className="flex items-center gap-2 text-xs text-[#A0AEC0]">
              <span className="size-2 rounded-full" style={{ background: TONES.find((item) => item.value === tone)?.color }} />
              النغمة الحالية: <strong className="text-white">{TONES.find((item) => item.value === tone)?.label}</strong>
            </div>
            <span className="font-mono text-xs text-[#8798AD]" dir="ltr">{icons.length} / 34 glyphs</span>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold">مكتبة الرموز</h2>
              <p className="mt-1 text-xs text-[#A0AEC0]">كل بطاقة تعرض الرمز، اسمه الوظيفي، ومعاينته على اللون المختار.</p>
            </div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن أيقونة..."
              aria-label="ابحث عن أيقونة"
              className="w-full rounded-xl border border-white/10 bg-[#07152D] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#718198] focus:border-[#60F5D2]/50 md:max-w-xs" />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["الكل", ...ICON_GROUPS.map((item) => item.label)] as Group[]).map((item) => (
              <button key={item} type="button" onClick={() => setGroup(item)} aria-pressed={group === item}
                className={cn("rounded-full border px-3 py-1.5 text-xs transition",
                  group === item ? "border-[#D6B2FC]/50 bg-[#D6B2FC]/10 text-[#EAD8FF]" : "border-white/10 text-[#A0AEC0] hover:border-white/20")}>
                {item}
              </button>
            ))}
          </div>
          {icons.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {icons.map(({ name, group: groupName }) => (
                <article key={name} className={cn("group rounded-2xl border p-3 transition duration-200 hover:-translate-y-1 hover:border-white/25", cardSurface)}>
                  <div className="flex aspect-[1.25] items-center justify-center rounded-xl border border-white/[0.06] bg-[#07152D]/45">
                    <MIZYAiIcon name={name} tone={tone} className="size-12 sm:size-14" />
                  </div>
                  <div className="mt-3 min-w-0">
                    <p className="truncate text-sm font-semibold">{ICON_LABELS[name]}</p>
                    <p className="mt-1 truncate font-mono text-[10px] text-[#8798AD]" dir="ltr">{name}</p>
                    <p className="mt-2 text-[10px] text-[#A0AEC0]">{groupName}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mz-glass-card rounded-2xl p-8 text-center text-sm text-[#A0AEC0]">لا توجد أيقونات تطابق البحث.</div>
          )}
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-[#8798AD] sm:flex-row sm:items-center sm:justify-between">
          <span>MIZYAi · Premium Dark Intelligence</span>
          <span>Void Navy · Teal #60F5D2 · Lavender #D6B2FC</span>
        </footer>
      </div>
    </main>
  );
}
