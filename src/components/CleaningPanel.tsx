import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Brush,
  CheckCircle2,
  Copy,
  History,
  Layers,
  Loader2,
  Sparkles,
  Type,
  Undo2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BASE_RELATION,
  applySteps,
  buildRelation,
  checkCastability,
  countDuplicates,
  duplicateSample,
  isNumericType,
  makeCastStep,
  makeDedupeStep,
  makeFillStep,
  makeMergeStep,
  makeTrimStep,
  previewColumnChange,
  suggestCategoryGroups,
  suggestFill,
  type CategoryGroup,
  type CleanStep,
} from "@/lib/cleaning";
import type { TableInfo } from "@/lib/duckdb-service";
import type { HealthReport } from "@/lib/data-health";
import type { Row } from "@/lib/parse-file";

interface Props {
  tableInfo: TableInfo;
  health: HealthReport;
  steps: CleanStep[];
  onStepsChange: (steps: CleanStep[]) => void;
  /** يُستدعى بعد كل تطبيق/تراجع لإعادة حساب الجدول وصحة البيانات. */
  onApplied: (info: TableInfo) => void;
}

interface PendingPreview {
  step: CleanStep;
  title: string;
  description: string;
  affected: number;
  samples?: { before: string; after: string }[];
  rows?: Row[];
}

const CARD = "clay rounded-2xl border border-border/70 bg-card/70 px-4 py-4 space-y-3";

function SectionTitle({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="text-sm font-medium">{title}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function CleaningPanel({ tableInfo, health, steps, onStepsChange, onApplied }: Props) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingPreview | null>(null);
  const [castChecks, setCastChecks] = useState<
    Record<string, { target: "DOUBLE" | "DATE"; failing: number; ratio: number }>
  >({});
  const [groups, setGroups] = useState<{ column: string; group: CategoryGroup }[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [fillChoice, setFillChoice] = useState<Record<string, string>>({});
  const [fillCustom, setFillCustom] = useState<Record<string, string>>({});

  const relation = useMemo(() => buildRelation(steps) ?? BASE_RELATION, [steps]);
  const allColumns = useMemo(() => tableInfo.schema.map((c) => c.name), [tableInfo]);
  const textColumns = useMemo(
    () => tableInfo.schema.filter((c) => !isNumericType(c.type)).map((c) => c.name),
    [tableInfo],
  );
  const missingColumns = useMemo(
    () => health.columns.filter((c) => c.nullCount > 0),
    [health],
  );
  const typeIssueColumns = useMemo(
    () => health.columns.filter((c) => c.typeMismatchCount > 0).map((c) => c.name),
    [health],
  );

  /** تحليل محلي للاقتراحات (تحويل الأنواع + الفئات المتشابهة). */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setAnalyzing(true);
      const checks: Record<string, { target: "DOUBLE" | "DATE"; failing: number; ratio: number }> = {};
      try {
        for (const col of typeIssueColumns) {
          const asNumber = await checkCastability(relation, col, "DOUBLE");
          const asDate = await checkCastability(relation, col, "DATE");
          const best = asDate.ratio > asNumber.ratio ? { ...asDate, target: "DATE" as const } : { ...asNumber, target: "DOUBLE" as const };
          if (best.ratio > 0.8) {
            checks[col] = { target: best.target, failing: best.failing, ratio: best.ratio };
          }
        }
        const found: { column: string; group: CategoryGroup }[] = [];
        for (const col of textColumns.slice(0, 12)) {
          const g = await suggestCategoryGroups(relation, col);
          for (const item of g.slice(0, 3)) found.push({ column: col, group: item });
        }
        if (!cancelled) {
          setCastChecks(checks);
          setGroups(found);
        }
      } catch {
        if (!cancelled) {
          setCastChecks({});
          setGroups([]);
        }
      } finally {
        if (!cancelled) setAnalyzing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [relation, typeIssueColumns, textColumns]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  async function openColumnPreview(step: CleanStep, column: string, title: string, description: string) {
    await run(async () => {
      const preview = await previewColumnChange(relation, step, column);
      setPending({
        step: { ...step, affectedRows: preview.affected || step.affectedRows },
        title,
        description,
        affected: preview.affected,
        samples: preview.samples,
      });
    });
  }

  async function openDedupePreview() {
    await run(async () => {
      const affected = await countDuplicates(relation);
      const rows = await duplicateSample(relation, allColumns.slice(0, 5));
      setPending({
        step: makeDedupeStep(affected),
        title: "إزالة الصفوف المكررة",
        description: "تُحذف النسخ الزائدة فقط عندما تتطابق كل الأعمدة، مع إبقاء نسخة واحدة من كل صف.",
        affected,
        rows,
      });
    });
  }

  async function openTrimPreview() {
    const step = makeTrimStep(allColumns, textColumns);
    await run(async () => {
      let affected = 0;
      const samples: { before: string; after: string }[] = [];
      for (const col of textColumns) {
        const p = await previewColumnChange(relation, step, col, 2);
        affected += p.affected;
        samples.push(...p.samples.map((s) => ({ before: `${col}: ${s.before}`, after: s.after })));
      }
      setPending({
        step: { ...step, affectedRows: affected, label: `تنظيف النصوص (${affected.toLocaleString("en-US")} قيمة)` },
        title: "توحيد المسافات في النصوص",
        description: "إزالة المسافات الزائدة من الأطراف وتحويل المسافات المتعددة الداخلية إلى مسافة واحدة.",
        affected,
        samples: samples.slice(0, 6),
      });
    });
  }

  async function confirmPending() {
    if (!pending) return;
    const next = [...steps, pending.step];
    await run(async () => {
      const info = await applySteps(next);
      onStepsChange(next);
      onApplied(info);
      setPending(null);
    });
  }

  async function undoFrom(index: number) {
    const next = steps.slice(0, index);
    await run(async () => {
      const info = await applySteps(next);
      onStepsChange(next);
      onApplied(info);
    });
  }

  return (
    <section className="clay rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="clay flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Brush className="size-5" strokeWidth={2} />
          </span>
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold leading-none">تنظيف البيانات</h2>
            <p className="text-xs leading-none text-muted-foreground">
              تنظيف غير تدميري: الملف الأصلي يبقى كما هو، وكل خطوة قابلة للتراجع.
            </p>
          </div>
        </div>
        {(busy || analyzing) && (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" strokeWidth={2} />
            جارٍ التحليل…
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* 1) التكرارات */}
        {health.duplicateRows > 0 && (
          <div className={CARD}>
            <SectionTitle icon={<Copy className="size-4" strokeWidth={2} />} title="الصفوف المكررة" />
            <p className="text-sm text-muted-foreground">
              يحتوي الجدول على{" "}
              <span className="font-mono text-foreground">
                {health.duplicateRows.toLocaleString("en-US")}
              </span>{" "}
              صفاً مكرراً بالكامل.
            </p>
            <Button disabled={busy} onClick={() => void openDedupePreview()} className="clay-press rounded-xl">
              إزالة الصفوف المكررة
            </Button>
          </div>
        )}

        {/* 2) تنظيف النصوص */}
        {textColumns.length > 0 && (
          <div className={CARD}>
            <SectionTitle icon={<Type className="size-4" strokeWidth={2} />} title="توحيد النصوص" />
            <p className="text-sm text-muted-foreground">
              تطبيق <span dir="ltr" className="font-mono">TRIM</span> وتوحيد المسافات على{" "}
              {textColumns.length.toLocaleString("en-US")} عمود نصي.
            </p>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void openTrimPreview()}
              className="clay-press rounded-xl"
            >
              تنظيف النصوص
            </Button>
          </div>
        )}

        {/* 3) تحويل الأنواع */}
        {Object.keys(castChecks).length > 0 && (
          <div className={CARD}>
            <SectionTitle
              icon={<ArrowLeftRight className="size-4" strokeWidth={2} />}
              title="تصحيح أنواع الأعمدة"
              hint="ثقة أعلى من 80%"
            />
            <div className="space-y-2">
              {Object.entries(castChecks).map(([col, c]) => (
                <div
                  key={col}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2"
                >
                  <div className="min-w-0 space-y-1">
                    <p dir="auto" className="truncate font-mono text-sm">{col}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(c.ratio * 100)}% قابلة للتحويل إلى {c.target === "DOUBLE" ? "رقم" : "تاريخ"} ·{" "}
                      {c.failing.toLocaleString("en-US")} قيمة ستصبح فارغة
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    className="clay-press rounded-lg"
                    onClick={() =>
                      void openColumnPreview(
                        makeCastStep(allColumns, col, c.target, c.failing),
                        col,
                        `تحويل «${col}»`,
                        `القيم غير القابلة للتحويل (${c.failing.toLocaleString("en-US")}) ستصبح فارغة (NULL).`,
                      )
                    }
                  >
                    تحويل
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4) ملء القيم المفقودة */}
        {missingColumns.length > 0 && (
          <div className={CARD}>
            <SectionTitle
              icon={<Layers className="size-4" strokeWidth={2} />}
              title="القيم المفقودة"
              hint="لا يُطبَّق شيء تلقائياً"
            />
            <div className="space-y-2">
              {missingColumns.map((c) => {
                const choice = fillChoice[c.name] ?? "none";
                return (
                  <div
                    key={c.name}
                    className="space-y-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p dir="auto" className="truncate font-mono text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.nullCount.toLocaleString("en-US")} قيمة مفقودة
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={choice}
                          onValueChange={(v) => setFillChoice((s) => ({ ...s, [c.name]: v }))}
                        >
                          <SelectTrigger className="h-9 w-48 rounded-lg bg-card text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">لا تفعل شيئاً</SelectItem>
                            <SelectItem value="auto">
                              {c.isNumeric ? "املأ بالوسيط" : "املأ بالقيمة الأكثر تكراراً"}
                            </SelectItem>
                            <SelectItem value="custom">املأ بقيمة ثابتة</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={busy || choice === "none"}
                          className="clay-press rounded-lg"
                          onClick={() =>
                            void run(async () => {
                              let value = fillCustom[c.name] ?? "";
                              if (choice === "auto") {
                                const s = await suggestFill(relation, c.name, c.type);
                                if (s.suggested === null) return;
                                value = s.suggested;
                              }
                              if (value === "") return;
                              await openColumnPreview(
                                makeFillStep(allColumns, c.name, c.type, value, c.nullCount),
                                c.name,
                                `ملء القيم المفقودة في «${c.name}»`,
                                `ستُملأ الخلايا الفارغة بالقيمة: ${value}`,
                              );
                            })
                          }
                        >
                          تطبيق
                        </Button>
                      </div>
                    </div>
                    {choice === "custom" && (
                      <Input
                        dir="auto"
                        placeholder="اكتب القيمة الثابتة…"
                        value={fillCustom[c.name] ?? ""}
                        onChange={(e) => setFillCustom((s) => ({ ...s, [c.name]: e.target.value }))}
                        className="h-9 rounded-lg font-mono text-xs"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5) توحيد الفئات المتشابهة */}
        {groups.length > 0 && (
          <div className={CARD}>
            <SectionTitle
              icon={<Sparkles className="size-4" strokeWidth={2} />}
              title="فئات متشابهة مقترحة للتوحيد"
              hint="مقارنة نصية محلية"
            />
            <div className="space-y-2">
              {groups.map(({ column, group }) => (
                <div
                  key={`${column}:${group.canonical}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2"
                >
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      في عمود <span className="font-mono text-foreground">{column}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {group.values.map((v) => (
                        <span
                          key={v.value}
                          dir="auto"
                          className="rounded-md border border-border/60 bg-card px-2 py-0.5 font-mono text-[11px]"
                        >
                          {v.value || "(فارغ)"} · {v.count}
                        </span>
                      ))}
                      <span className="text-xs text-muted-foreground">←</span>
                      <span
                        dir="auto"
                        className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary"
                      >
                        {group.canonical}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    className="clay-press rounded-lg"
                    onClick={() =>
                      void openColumnPreview(
                        makeMergeStep(allColumns, column, group),
                        column,
                        `توحيد الفئات في «${column}»`,
                        `ستُستبدل الصيغ المتشابهة بالقيمة «${group.canonical}».`,
                      )
                    }
                  >
                    توحيد
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* سجل التحويلات */}
      {steps.length > 0 && (
        <div className="mt-5 space-y-3 rounded-2xl border border-border/60 bg-background/30 px-4 py-4">
          <SectionTitle
            icon={<History className="size-4" strokeWidth={2} />}
            title="سجل عمليات التنظيف"
            hint="التراجع عن خطوة يلغي أيضاً كل الخطوات التي بعدها"
          />
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{i + 1}.</span>
                  <span dir="auto" className="truncate">{s.label}</span>
                  <CheckCircle2 className="size-4 shrink-0 text-primary" strokeWidth={2} />
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  className="clay-press shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() => void undoFrom(i)}
                >
                  <Undo2 className="size-4" strokeWidth={2} />
                  تراجع
                </Button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* معاينة قبل/بعد */}
      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="clay max-w-2xl rounded-2xl" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2 font-display">
              <Wand2 className="size-5 text-primary" strokeWidth={2} />
              {pending?.title}
            </DialogTitle>
            <DialogDescription className="text-right">{pending?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm">
              الصفوف/القيم المتأثرة:{" "}
              <span className="font-mono text-primary">
                {(pending?.affected ?? 0).toLocaleString("en-US")}
              </span>
            </p>

            {pending?.samples && pending.samples.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-border/60">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 font-medium">قبل</th>
                      <th className="px-3 py-2 font-medium">بعد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.samples.map((s, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td dir="auto" className="px-3 py-2 font-mono text-muted-foreground">{s.before}</td>
                        <td dir="auto" className="px-3 py-2 font-mono text-primary">{s.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pending?.rows && pending.rows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      {Object.keys(pending.rows[0]!).map((k) => (
                        <th key={k} dir="auto" className="whitespace-nowrap px-3 py-2 font-medium">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pending.rows.map((r, i) => (
                      <tr key={i} className="border-t border-border/50">
                        {Object.values(r).map((v, j) => (
                          <td key={j} dir="auto" className="whitespace-nowrap px-3 py-2 font-mono">
                            {v === null ? "—" : String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pending?.affected === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد صفوف متأثرة بهذه العملية.</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              disabled={busy || (pending?.affected ?? 0) === 0}
              className="clay-press rounded-xl"
              onClick={() => void confirmPending()}
            >
              {busy && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
              تأكيد وتطبيق
            </Button>
            <Button variant="ghost" className="rounded-xl" onClick={() => setPending(null)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}