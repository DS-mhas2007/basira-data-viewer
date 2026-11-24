import { useEffect, useMemo, useState } from "react";
import { BookText, Check, Loader2, Plus, Save, ShieldAlert } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  validateMetricDefinition,
  validateMetricRegistry,
  computeMetricSchemaFingerprint,
  computeMetricDefinitionFingerprint,
  type MetricDefinition,
  type MetricSchema,
} from "@/lib/metric-definition-registry";
import { loadProjectMetricDefinitions, saveProjectMetricDefinitions } from "@/lib/workspace-store";
import { getActiveCleanSteps } from "@/lib/cleaning";
import { computeTransformationFingerprint } from "@/lib/transformation-fingerprint";
import { compareCleaningExecutionAttestation } from "@/lib/cleaning-execution-attestation";
import { duckdb } from "@/lib/duckdb-service";
import { toast } from "sonner";

interface Props {
  projectId: string;
  projectName: string;
  datasetAlias?: string | null;
  schema: MetricSchema | null;
  contentFingerprint?: string | null;
  disabled?: boolean;
}

type DraftFields = {
  name: string;
  description: string;
  formula: string;
  sourceColumns: string;
  grain: string;
  filters: string;
  exclusions: string;
  unit: string;
  assumptions: string;
  limitations: string;
  sourceDataset: string;
  sourceVersion: string;
  domainKind: "numeric" | "categorical" | "date" | "boolean";
  domainMin: string;
  domainMax: string;
  allowedValues: string;
};

const EMPTY: DraftFields = {
  name: "", description: "", formula: "", sourceColumns: "", grain: "",
  filters: "", exclusions: "", unit: "", assumptions: "", limitations: "",
  sourceDataset: "", sourceVersion: "v1", domainKind: "numeric",
  domainMin: "", domainMax: "", allowedValues: "",
};

function splitList(value: string): string[] {
  return value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean);
}

function splitLines(value: string): string[] {
  return value.split(/\n/).map((item) => item.trim()).filter(Boolean);
}

function toFields(definition: MetricDefinition): DraftFields {
  return {
    name: definition.name,
    description: definition.description,
    formula: definition.formula,
    sourceColumns: definition.sourceColumns.join(", "),
    grain: definition.grain.join(", "),
    filters: definition.filters.join("\n"),
    exclusions: definition.exclusions.join("\n"),
    unit: definition.unit,
    assumptions: definition.assumptions.join("\n"),
    limitations: definition.limitations.join("\n"),
    sourceDataset: definition.source.dataset,
    sourceVersion: definition.source.version,
    domainKind: definition.expectedDomain.kind,
    domainMin: definition.expectedDomain.min === undefined ? "" : String(definition.expectedDomain.min),
    domainMax: definition.expectedDomain.max === undefined ? "" : String(definition.expectedDomain.max),
    allowedValues: definition.expectedDomain.allowedValues?.join(", ") ?? "",
  };
}

export function MetricRegistryDialog({ projectId, projectName, datasetAlias, schema, contentFingerprint = null, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [definitions, setDefinitions] = useState<MetricDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState(() => `metric_${Math.random().toString(36).slice(2)}`);
  const [fields, setFields] = useState<DraftFields>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const selected = definitions.find((item) => item.id === selectedId) ?? null;
  const candidate: MetricDefinition | null = useMemo(() => {
    if (!fields.name.trim()) return null;
    return {
      id: selected?.id ?? draftId,
      name: fields.name.trim(),
      description: fields.description.trim(),
      formula: fields.formula.trim(),
      sourceColumns: splitList(fields.sourceColumns),
      grain: splitList(fields.grain),
      filters: splitLines(fields.filters),
      exclusions: splitLines(fields.exclusions),
      unit: fields.unit.trim(),
      expectedDomain: {
        kind: fields.domainKind,
        ...(fields.domainKind === "numeric" && fields.domainMin.trim() ? { min: Number(fields.domainMin) } : {}),
        ...(fields.domainKind === "numeric" && fields.domainMax.trim() ? { max: Number(fields.domainMax) } : {}),
        ...(fields.domainKind === "categorical" ? { allowedValues: splitList(fields.allowedValues) } : {}),
      },
      assumptions: splitLines(fields.assumptions),
      limitations: splitLines(fields.limitations),
      source: {
        dataset: fields.sourceDataset.trim() || datasetAlias?.trim() || projectName,
        version: fields.sourceVersion.trim() || "v1",
        ...(selected?.source.schemaFingerprint ? { schemaFingerprint: selected.source.schemaFingerprint } : {}),
        ...(selected?.source.contentFingerprint ? { contentFingerprint: selected.source.contentFingerprint } : {}),
        ...(selected?.source.definitionFingerprint ? { definitionFingerprint: selected.source.definitionFingerprint } : {}),
      },
      status: selected?.status ?? "draft",
      updatedAt: new Date().toISOString(),
    };
  }, [fields, projectName, datasetAlias, selected, draftId]);

  const validation = useMemo(() => {
    if (!candidate || !schema) return null;
    return validateMetricDefinition(candidate, schema);
  }, [candidate, schema]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setSelectedId(null);
    setDraftId(`metric_${Math.random().toString(36).slice(2)}`);
    setFields({ ...EMPTY, sourceDataset: datasetAlias ?? "" });
    void loadProjectMetricDefinitions(projectId).then((loaded) => {
      if (cancelled) return;
      setDefinitions(loaded ?? []);
    }).catch(() => {
      if (!cancelled) setLoadError(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, projectId, datasetAlias]);

  function beginNew() {
    setSelectedId(null);
    setDraftId(`metric_${Math.random().toString(36).slice(2)}`);
    setFields({ ...EMPTY, sourceDataset: datasetAlias ?? "" });
  }

  function edit(definition: MetricDefinition) {
    setSelectedId(definition.id);
    setFields(toFields(definition));
  }

  async function persist(next: MetricDefinition[]) {
    setSaving(true);
    try {
      const ok = await saveProjectMetricDefinitions(projectId, next);
      if (!ok) throw new Error("تعذّر حفظ سجل المقاييس محلياً.");
      setDefinitions(next);
      toast.success("تم حفظ سجل المقاييس لهذا المشروع");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر حفظ سجل المقاييس");
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    if (!candidate) return;
    if (schema) {
      const registryValidation = validateMetricRegistry(
        [...definitions.filter((item) => item.id !== candidate.id), candidate],
        schema,
      );
      const candidateValidation = registryValidation.at(-1);
      if (!candidateValidation?.valid) {
        toast.error(candidateValidation?.issues[0]?.message ?? "راجع حقول تعريف المقياس");
        return;
      }
    }
    await persist([...definitions.filter((item) => item.id !== candidate.id), { ...candidate, status: "draft" }]);
  }

  async function approve() {
    if (!candidate || !schema) {
      toast.error("حمّل بيانات المشروع أولاً حتى نتحقق من الأعمدة قبل الاعتماد.");
      return;
    }
    if (!contentFingerprint || !/^content-v1:sha256:[0-9a-f]{64}$/.test(contentFingerprint)) {
      toast.error("تعذّر إنشاء بصمة SHA-256 لمحتوى الورقة كاملة؛ انتظر اكتمال ختم البيانات ثم أعد الاعتماد.");
      return;
    }
    const schemaFingerprint = computeMetricSchemaFingerprint(schema);
    if (!schemaFingerprint) {
      toast.error("تعذّر إنشاء بصمة موثوقة للمخطط؛ تحقق من أسماء الأعمدة وأنواعها ثم أعد المحاولة.");
      return;
    }
    let transformationFingerprint: string;
    let outputFingerprint: string;
    try {
      transformationFingerprint = await computeTransformationFingerprint(contentFingerprint, getActiveCleanSteps());
      outputFingerprint = await duckdb.computeOutputFingerprint();
      const activeSource = duckdb.getActiveSourceIdentity();
      if (!activeSource || activeSource.alias !== datasetAlias) {
        toast.error("هوية المصدر النشط لا تطابق الورقة المحددة؛ أعد تفعيل المصدر قبل الاعتماد.");
        return;
      }
      const executionCheck = await compareCleaningExecutionAttestation({
        source: activeSource,
        steps: getActiveCleanSteps(),
        outputFingerprint,
      });
      if (executionCheck.status !== "aligned") {
        toast.error(executionCheck.reason);
        return;
      }
    } catch {
      toast.error("تعذّر إنشاء بصمة وصف التحويل أو بصمة الناتج الفعلي من DuckDB؛ لا يمكن اعتماد المقياس دون اكتمال الدليل.");
      return;
    }
    let definitionFingerprint: string;
    try {
      definitionFingerprint = await computeMetricDefinitionFingerprint(candidate);
    } catch {
      toast.error("تعذّر تثبيت بصمة تعريف المقياس؛ لا يمكن اعتماد تعريف دون لقطة SHA-256.");
      return;
    }
    const approvedCandidate: MetricDefinition = {
      ...candidate,
      source: {
        ...candidate.source,
        schemaFingerprint,
        contentFingerprint,
        transformationFingerprint,
        outputFingerprint,
        definitionFingerprint,
      },
      status: "approved",
    };
    const next = [...definitions.filter((item) => item.id !== candidate.id), approvedCandidate];
    const results = validateMetricRegistry(next, schema);
    const result = results.at(-1);
    if (!result?.valid) {
      toast.error(result?.issues[0]?.message ?? "لا يمكن اعتماد تعريف غير صالح");
      return;
    }
    await persist(next);
  }

  async function removeSelected() {
    if (!selected) return;
    await persist(definitions.filter((item) => item.id !== selected.id));
    beginNew();
  }

  const update = (key: keyof DraftFields, value: string) => setFields((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled || !projectId} className="h-9 gap-2">
          <BookText className="size-4" />
          سجل المقاييس
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>سجل المقاييس — {projectName}</DialogTitle>
          <DialogDescription>
            عرّف المعنى والصيغة والأعمدة والحبيبية. الاعتماد يثبت بصمات تعريف المقياس والمخطط والمحتوى ووصفة التنظيف والناتج الفعلي داخل DuckDB؛ المقاييس القديمة تحتاج إعادة اعتماد لتوليد الأدلة الجديدة.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> جارٍ تحميل تعريفات هذا المشروع…</div>
        ) : loadError ? (
          <div role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">تعذّر تحميل سجل المقاييس.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="space-y-2">
              <Button type="button" onClick={beginNew} variant="outline" className="w-full justify-start gap-2"><Plus className="size-4" /> تعريف جديد</Button>
              {definitions.length === 0 ? <p className="px-2 py-4 text-xs text-muted-foreground">لا توجد مقاييس محفوظة لهذا المشروع.</p> : definitions.map((item) => (
                <button key={item.id} type="button" onClick={() => edit(item)} className={`w-full rounded-xl border p-3 text-right transition-colors ${selectedId === item.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{item.status === "approved" && (!item.source.transformationFingerprint || !item.source.outputFingerprint) ? "يتطلب إعادة اعتماد" : item.status === "approved" ? "معتمد" : item.status === "deprecated" ? "متقاعد" : "مسودة"}</span>
                </button>
              ))}
            </aside>
            <section className="min-w-0 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs"><span>اسم المقياس</span><Input value={fields.name} onChange={(e) => update("name", e.target.value)} placeholder="مثلاً: إجمالي الإيرادات" /></label>
                <label className="space-y-1 text-xs"><span>الوحدة</span><Input value={fields.unit} onChange={(e) => update("unit", e.target.value)} placeholder="USD، عدد، %" /></label>
              </div>
              <label className="block space-y-1 text-xs"><span>المعنى التجاري / العلمي</span><Textarea value={fields.description} onChange={(e) => update("description", e.target.value)} rows={2} placeholder="ما الذي يقيسه هذا المؤشر تحديداً؟" /></label>
              <label className="block space-y-1 text-xs"><span>الصيغة (Expression)</span><Input dir="ltr" value={fields.formula} onChange={(e) => update("formula", e.target.value)} placeholder="SUM(revenue)" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs"><span>أعمدة المصدر — افصل بفاصلة</span><Input dir="ltr" value={fields.sourceColumns} onChange={(e) => update("sourceColumns", e.target.value)} placeholder="revenue" /></label>
                <label className="space-y-1 text-xs"><span>Grain — مستوى الحبيبية</span><Input dir="ltr" value={fields.grain} onChange={(e) => update("grain", e.target.value)} placeholder="month" /></label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs"><span>الفلاتر</span><Textarea value={fields.filters} onChange={(e) => update("filters", e.target.value)} rows={2} placeholder="كل شرط في سطر" /></label>
                <label className="space-y-1 text-xs"><span>الاستثناءات</span><Textarea value={fields.exclusions} onChange={(e) => update("exclusions", e.target.value)} rows={2} placeholder="كل استثناء في سطر" /></label>
                <label className="space-y-1 text-xs"><span>الافتراضات</span><Textarea value={fields.assumptions} onChange={(e) => update("assumptions", e.target.value)} rows={2} /></label>
                <label className="space-y-1 text-xs"><span>القيود</span><Textarea value={fields.limitations} onChange={(e) => update("limitations", e.target.value)} rows={2} /></label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs"><span>مجموعة البيانات المصدر</span><Input value={fields.sourceDataset} onChange={(e) => update("sourceDataset", e.target.value)} placeholder={datasetAlias ?? projectName} /></label>
                <label className="space-y-1 text-xs"><span>إصدار المصدر</span><Input dir="ltr" value={fields.sourceVersion} onChange={(e) => update("sourceVersion", e.target.value)} /></label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs"><span>نوع المجال المتوقع</span><select value={fields.domainKind} onChange={(e) => update("domainKind", e.target.value as DraftFields["domainKind"])} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="numeric">رقمي</option><option value="categorical">فئوي</option><option value="date">تاريخ</option><option value="boolean">منطقي</option></select></label>
                {fields.domainKind === "numeric" ? <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-xs"><span>الحد الأدنى (اختياري)</span><Input type="number" value={fields.domainMin} onChange={(e) => update("domainMin", e.target.value)} /></label><label className="space-y-1 text-xs"><span>الحد الأعلى (اختياري)</span><Input type="number" value={fields.domainMax} onChange={(e) => update("domainMax", e.target.value)} /></label></div> : fields.domainKind === "categorical" ? <label className="space-y-1 text-xs"><span>القيم المسموحة (اختياري)</span><Input value={fields.allowedValues} onChange={(e) => update("allowedValues", e.target.value)} placeholder="A, B, C" /></label> : null}
              </div>
              {candidate && (
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">
                  {schema ? validation?.valid ? <div className="space-y-1 text-emerald-600"><p className="flex items-center gap-2"><Check className="size-4" /> التعريف صالح وفق المخطط الحالي.</p><p className="text-muted-foreground">بصمة محتوى الورقة: {contentFingerprint ? "جاهزة — SHA-256 كامل" : "قيد الحساب أو غير متاحة؛ سيبقى الاعتماد معطلاً"}.</p></div> : <div className="space-y-1 text-destructive"><p className="flex items-center gap-2 font-medium"><ShieldAlert className="size-4" /> توجد مشكلات تمنع الاعتماد</p>{validation?.issues.map((issue, index) => <p key={index}>• {issue.message}</p>)}</div> : <p className="text-muted-foreground">ارفع ملفاً أو انتظر اكتمال فحص محتوى الورقة ومخططها. يمكنك حفظ مسودة، لكن لا يمكن اعتمادها دون الدليلين.</p>}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button type="button" onClick={() => void saveDraft()} disabled={!candidate || saving} variant="outline" className="gap-2"><Save className="size-4" /> حفظ مسودة</Button>
                <Button type="button" onClick={() => void approve()} disabled={!candidate || !schema || !contentFingerprint || !validation?.valid || saving} className="gap-2"><Check className="size-4" /> اعتماد التعريف</Button>
                {selected && <Button type="button" variant="ghost" onClick={() => void removeSelected()} disabled={saving} className="mr-auto text-destructive">حذف التعريف</Button>}
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
