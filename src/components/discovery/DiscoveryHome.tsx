import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpLeft,
  CheckCircle2,
  Database,
  FileSearch,
  GitBranch,
  Lightbulb,
  Network,
  Sparkles,
  Table2,
} from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { ProcessingSteps, type Stage } from "@/components/ProcessingSteps";
import type { HealthReport } from "@/lib/data-health";
import type { PinnedInsight } from "@/lib/report";

type ViewMode = "feed" | "map";

interface Props {
  onFile: (file: File) => void;
  loading: boolean;
  stage: Stage;
  hasData: boolean;
  fileName?: string;
  rowCount?: number;
  columnCount?: number;
  health: HealthReport | null;
  healthLoading?: boolean;
  insights: PinnedInsight[];
  onNavigate: (id: string) => void;
  onAsk: () => void;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`basira-panel rounded-2xl border border-border/70 bg-card/75 p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function DiscoveryHome({
  onFile,
  loading,
  stage,
  hasData,
  fileName,
  rowCount = 0,
  columnCount = 0,
  health,
  healthLoading = false,
  insights,
  onNavigate,
  onAsk,
}: Props) {
  const [view, setView] = useState<ViewMode>("feed");
  const hasQualityIssues = !!health && (
    health.missingCells > 0 || health.duplicateRows > 0 || health.mismatchedColumns > 0
  );
  const priorityItems = useMemo(() => insights, [insights]);

  return (
    <div className="basira-discovery space-y-6 sm:space-y-7">
      <section className="basira-hero relative isolate overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-5 sm:p-7 lg:p-8">
        <div aria-hidden className="pointer-events-none absolute -end-20 -top-24 -z-10 size-72 rounded-full border border-primary/10" />
        <div aria-hidden className="pointer-events-none absolute -end-8 -top-12 -z-10 size-48 rounded-full border border-accent/15" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-medium text-primary">
            <Sparkles className="size-3.5" />
            مساحة الاكتشاف
          </span>
          {hasData && (
            <span className="max-w-full truncate rounded-full border border-border/70 bg-background/50 px-3 py-1.5 text-[11px] text-muted-foreground" dir="auto">
              {fileName}
            </span>
          )}
        </div>
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.72fr)] lg:items-end">
          <div className="max-w-2xl">
            <h1 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
              {hasData ? "بياناتك أصبحت مساحة للاكتشاف." : "ما الذي تخبرك به بياناتك؟"}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              {hasData
                ? "تابع النتائج المثبتة، افحص أدلتها، واختر الخطوة التالية بناءً على ما كشفه التحليل فعلياً."
                : "ابدأ بملفك. ستساعدك بصيرة على فحص بنيته وجودته، ثم استكشاف النتائج والأدلة خطوة بخطوة."}
            </p>
            {hasData && (
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={onAsk} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-105">
                  <Sparkles className="size-4" /> اسأل بصيرة
                </button>
                <button type="button" onClick={() => onNavigate("data")} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background/50 px-4 py-2 text-sm font-medium transition hover:border-primary/40">
                  <Table2 className="size-4" /> استكشف البيانات
                </button>
              </div>
            )}
          </div>
          {hasData ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border/60 bg-background/45 p-3">
                <p className="font-mono text-xl font-bold tabular-nums sm:text-2xl">{rowCount.toLocaleString("en-US")}</p>
                <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">صف</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/45 p-3">
                <p className="font-mono text-xl font-bold tabular-nums sm:text-2xl">{columnCount.toLocaleString("en-US")}</p>
                <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">عمود</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/45 p-3">
                <p className="font-mono text-xl font-bold tabular-nums sm:text-2xl">{insights.length.toLocaleString("en-US")}</p>
                <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">اكتشاف مثبت</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-primary/20 bg-background/45 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Database className="size-4 text-primary" />
                ابدأ بمجموعة بيانات
              </div>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                CSV وExcel — تتم قراءة الملف وتحليله محلياً داخل متصفحك.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                <span className="rounded-md bg-primary/10 px-2 py-1 text-primary">فحص البنية</span>
                <span className="rounded-md bg-accent/10 px-2 py-1 text-accent">جودة البيانات</span>
                <span className="rounded-md bg-muted px-2 py-1">فرص الاكتشاف</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {!hasData ? (
        <>
          <Panel>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">استيراد موجّه</h2>
                <p className="mt-1 text-xs text-muted-foreground">ارفع الملف وسنوضح لك ما يحدث في كل مرحلة.</p>
              </div>
              <span className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-medium text-primary">الخطوة 01</span>
            </div>
            <FileDropzone onFile={onFile} loading={loading} compact={false} />
            <div className="mt-3"><ProcessingSteps stage={stage} /></div>
          </Panel>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: FileSearch, title: "افحص البنية", text: "التعرّف على الصفوف والأعمدة وأنواع البيانات." },
              { icon: CheckCircle2, title: "راجع الجودة", text: "إظهار النواقص والتكرارات والمشكلات قبل أي تعديل." },
              { icon: Lightbulb, title: "ابدأ الاكتشاف", text: "استكشاف النتائج والفرص التحليلية بعد تجهيز البيانات." },
            ].map((item, index) => (
              <div key={item.title} className="rounded-xl border border-border/60 bg-card/50 p-4">
                <div className="flex size-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 text-primary"><item.icon className="size-4" /></div>
                <p className="mt-3 text-sm font-semibold">{String(index + 1).padStart(2, "0")} · {item.title}</p>
                <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold">مشهد الاكتشافات</h2>
                  <p className="mt-1 text-xs text-muted-foreground">اعرض النتائج المثبتة كبطاقات أو استكشف ارتباطها بمجموعة البيانات.</p>
                </div>
                <div className="inline-flex rounded-xl border border-border bg-background/60 p-1" role="group" aria-label="طريقة عرض الاكتشافات">
                  <button type="button" aria-pressed={view === "feed"} onClick={() => setView("feed")} className={`rounded-lg px-3 py-2 text-xs font-medium transition ${view === "feed" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>الموجز</button>
                  <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")} className={`rounded-lg px-3 py-2 text-xs font-medium transition ${view === "map" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>الخريطة</button>
                </div>
              </div>

              {view === "feed" ? (
                <div className="mt-4 space-y-3">
                  {healthLoading ? (
                    <div className="rounded-xl border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">جارٍ فحص جودة البيانات…</div>
                  ) : hasQualityIssues ? (
                    <button type="button" onClick={() => onNavigate("quality")} className="flex w-full items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 text-start transition hover:border-warning/50">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">توجد مشكلات تستحق المراجعة في جودة البيانات</span>
                        <span className="mt-1 block text-xs leading-6 text-muted-foreground">راجع القيم المفقودة والتكرارات وتوافق أنواع الأعمدة قبل تفسير النتائج.</span>
                      </span>
                      <ArrowLeft className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    </button>
                  ) : health ? (
                    <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <CheckCircle2 className="size-4 shrink-0 text-primary" />
                      <span className="text-xs leading-6 text-muted-foreground">اكتمل فحص الجودة. درجة الجودة: <strong className="font-mono text-foreground">{health.score}/100</strong></span>
                    </div>
                  ) : null}

                  {priorityItems.length > 0 ? priorityItems.map((item) => (
                    <button key={item.evidence.id} type="button" onClick={() => onNavigate("insights")} className="group flex w-full items-start gap-3 rounded-xl border border-border/60 bg-background/40 p-4 text-start transition hover:border-primary/35">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><Lightbulb className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-6">{item.evidence.title}</span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">{item.evidence.resultRowCount.toLocaleString("en-US")} صف نتيجة{item.evidence.baseRowCount != null ? ` · ${item.evidence.baseRowCount.toLocaleString("en-US")} صف أساس` : ""}</span>
                        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary">فتح الدليل <ArrowUpLeft className="size-3" /></span>
                      </span>
                    </button>
                  )) : (
                    <div className="rounded-xl border border-dashed border-border bg-background/30 px-4 py-7 text-center">
                      <Lightbulb className="mx-auto size-6 text-muted-foreground" />
                      <p className="mt-2 text-sm font-semibold">لا توجد اكتشافات مثبتة بعد</p>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">ابدأ بسؤال بصيرة عن بياناتك؛ ستظهر هنا النتائج التي تثبّتها مع أدلتها.</p>
                      <button type="button" onClick={onAsk} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Sparkles className="size-3.5" /> اسأل بصيرة</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-border/60 bg-background/30 p-4 sm:p-6">
                  {priorityItems.length === 0 ? (
                    <div className="py-8 text-center">
                      <Network className="mx-auto size-7 text-muted-foreground" />
                      <p className="mt-2 text-sm font-semibold">ستظهر الخريطة بعد تثبيت اكتشافات</p>
                      <p className="mt-1 text-xs text-muted-foreground">لا نعرض علاقات غير مستندة إلى نتائج فعلية.</p>
                    </div>
                  ) : (
                    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
                      <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-3 text-center">
                        <Database className="mx-auto size-5 text-primary" />
                        <p className="mt-1 max-w-48 truncate text-xs font-semibold" dir="auto">{fileName}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">مجموعة البيانات</p>
                      </div>
                      <div className="h-6 w-px bg-border" />
                      <GitBranch className="size-4 text-accent" />
                      <div className="grid w-full gap-2 sm:grid-cols-2">
                        {priorityItems.map((item) => (
                          <button key={item.evidence.id} type="button" onClick={() => onNavigate("insights")} className="rounded-xl border border-accent/20 bg-accent/5 p-3 text-start transition hover:border-accent/50">
                            <span className="block text-xs font-semibold leading-5">{item.evidence.title}</span>
                            <span className="mt-1 block text-[10px] text-muted-foreground">نتيجة مثبتة · {item.evidence.resultRowCount.toLocaleString("en-US")} صف</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          </div>

          <aside className="space-y-4">
            <Panel>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-accent" />
                <h2 className="text-sm font-bold">ذكاء بصيرة في السياق</h2>
              </div>
              {healthLoading ? (
                <p className="mt-3 text-xs leading-6 text-muted-foreground">يُفحص ملفك الآن لتقديم إرشاد مرتبط بحالته الفعلية.</p>
              ) : hasQualityIssues ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs leading-6 text-muted-foreground">الأولوية الحالية هي مراجعة جودة البيانات قبل الاعتماد على نتائج التحليل.</p>
                  <button type="button" onClick={() => onNavigate("quality")} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">مراجعة الجودة <ArrowLeft className="size-3" /></button>
                </div>
              ) : priorityItems.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs leading-6 text-muted-foreground">لديك نتائج مثبتة. افتح الأدلة المرتبطة بها أو أضف سؤالاً تحليلياً جديداً.</p>
                  <button type="button" onClick={() => onNavigate("insights")} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">مراجعة الاكتشافات <ArrowLeft className="size-3" /></button>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="text-xs leading-6 text-muted-foreground">ابدأ بسؤال محدد حول متغيراتك، وسنربط الإجابة بالاستعلام والنتيجة.</p>
                  <button type="button" onClick={onAsk} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">ابدأ سؤالاً <ArrowLeft className="size-3" /></button>
                </div>
              )}
            </Panel>
            <Panel>
              <h2 className="text-sm font-bold">حالة مساحة العمل</h2>
              <div className="mt-3 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">محرك DuckDB</span><span className="text-primary">متصل بالجلسة</span></div>
                <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">الأدلة المثبتة</span><span className="font-mono">{insights.length}</span></div>
                <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">فحص الجودة</span><span>{healthLoading ? "جارٍ الفحص" : health ? "مكتمل" : "غير متاح"}</span></div>
              </div>
            </Panel>
          </aside>
        </div>
      )}
    </div>
  );
}
