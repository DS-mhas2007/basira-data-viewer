/**
 * لوحة التنبيهات الذكية: قواعد مراقبة تُقيَّم محلياً بعد كل تغيير في البيانات.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  METRIC_LABELS,
  OPERATOR_LABELS,
  SEVERITY_LABELS,
  describeRule,
  evaluateRules,
  loadRules,
  needsColumn,
  newRuleId,
  saveRules,
  suggestRules,
  type AlertMetric,
  type AlertOperator,
  type AlertResult,
  type AlertRule,
  type AlertSeverity,
} from "@/lib/alerts";
import type { TableInfo } from "@/lib/duckdb-service";
import { playSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

interface Props {
  tableInfo: TableInfo | null;
  sourceKey: string;
}

const severityStyles: Record<AlertSeverity, string> = {
  info: "border-primary/40 bg-primary/10 text-primary",
  warning: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  critical: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function AlertsPanel({ tableInfo, sourceKey }: Props) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [results, setResults] = useState<AlertResult[]>([]);
  const [running, setRunning] = useState(false);
  const [draft, setDraft] = useState<AlertRule>(() => ({
    id: newRuleId(),
    name: "",
    metric: "row_count",
    operator: "<",
    threshold: 0,
    severity: "warning",
    enabled: true,
  }));

  useEffect(() => {
    setRules(loadRules());
  }, []);

  const persist = useCallback((next: AlertRule[]) => {
    setRules(next);
    saveRules(next);
  }, []);

  const run = useCallback(
    async (list: AlertRule[]) => {
      if (!tableInfo || list.length === 0) {
        setResults([]);
        return;
      }
      setRunning(true);
      try {
        const out = await evaluateRules(list, tableInfo);
        setResults(out);
        if (out.some((r) => r.triggered)) playSfx("tap");
      } finally {
        setRunning(false);
      }
    },
    [tableInfo],
  );

  useEffect(() => {
    void run(rules);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, rules, run]);

  const triggered = useMemo(() => results.filter((r) => r.triggered), [results]);
  const columns = tableInfo?.schema ?? [];

  function addDraft() {
    if (needsColumn(draft.metric) && !draft.column) {
      toast.error("اختر عموداً لهذا المقياس");
      return;
    }
    const rule: AlertRule = {
      ...draft,
      id: newRuleId(),
      name: draft.name.trim() || describeRule(draft),
    };
    persist([...rules, rule]);
    setDraft({ ...draft, id: newRuleId(), name: "" });
    toast.success("أُضيفت القاعدة");
  }

  function applySuggestions() {
    if (!tableInfo) return;
    const next = [...rules, ...suggestRules(tableInfo)];
    persist(next);
    toast.success("أُضيفت قواعد مقترحة حسب أعمدة ملفك");
  }

  return (
    <div className="space-y-4">
      {/* شريط الحالة */}
      <div
        className={cn(
          "clay flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3",
          triggered.length
            ? "border-destructive/40 bg-destructive/5"
            : "border-border/60 bg-card/60",
        )}
      >
        {triggered.length ? (
          <AlertTriangle className="size-5 text-destructive" strokeWidth={2} />
        ) : (
          <CheckCircle2 className="size-5 text-accent" strokeWidth={2} />
        )}
        <p className="text-sm font-medium">
          {rules.length === 0
            ? "لا توجد قواعد بعد — أضف قاعدة أو استخدم الاقتراحات"
            : triggered.length
              ? `${triggered.length} تنبيه نشط من ${rules.length} قاعدة`
              : `كل القواعد سليمة (${rules.length})`}
        </p>
        <div className="ms-auto flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!tableInfo}
            onClick={applySuggestions}
            className="clay-press gap-1.5 rounded-xl text-xs"
          >
            <Wand2 className="size-3.5" strokeWidth={2} />
            قواعد مقترحة
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!tableInfo || running}
            onClick={() => void run(rules)}
            className="clay-press gap-1.5 rounded-xl text-xs"
          >
            {running ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <RefreshCw className="size-3.5" strokeWidth={2} />
            )}
            إعادة الفحص
          </Button>
        </div>
      </div>

      {/* منشئ القاعدة */}
      <div className="clay space-y-3 rounded-2xl border border-border/60 bg-card/60 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <BellRing className="size-4 text-primary" strokeWidth={2} />
          قاعدة جديدة
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            value={draft.metric}
            onValueChange={(v) => setDraft((d) => ({ ...d, metric: v as AlertMetric }))}
          >
            <SelectTrigger className="rounded-xl text-xs">
              <SelectValue placeholder="المقياس" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(METRIC_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={draft.column ?? ""}
            disabled={!needsColumn(draft.metric)}
            onValueChange={(v) => setDraft((d) => ({ ...d, column: v }))}
          >
            <SelectTrigger className="rounded-xl text-xs">
              <SelectValue placeholder="العمود" />
            </SelectTrigger>
            <SelectContent>
              {columns.map((c) => (
                <SelectItem key={c.name} value={c.name} className="text-xs">
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={draft.operator}
            onValueChange={(v) => setDraft((d) => ({ ...d, operator: v as AlertOperator }))}
          >
            <SelectTrigger className="rounded-xl text-xs">
              <SelectValue placeholder="الشرط" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(OPERATOR_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            dir="ltr"
            value={draft.threshold}
            onChange={(e) => setDraft((d) => ({ ...d, threshold: Number(e.target.value) }))}
            className="rounded-xl font-mono text-xs"
            placeholder="القيمة"
          />

          <Select
            value={draft.severity}
            onValueChange={(v) => setDraft((d) => ({ ...d, severity: v as AlertSeverity }))}
          >
            <SelectTrigger className="rounded-xl text-xs">
              <SelectValue placeholder="الأهمية" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SEVERITY_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="اسم التنبيه (اختياري)"
            className="h-9 flex-1 rounded-xl text-xs"
          />
          <Button
            type="button"
            size="sm"
            disabled={!tableInfo}
            onClick={addDraft}
            className="clay-press gap-1.5 rounded-xl text-xs"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            إضافة
          </Button>
        </div>
      </div>

      {/* قائمة القواعد */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {results.map(({ rule, value, triggered: hit, error }) => (
            <motion.div
              key={rule.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={cn(
                "clay flex flex-wrap items-center gap-3 rounded-2xl border bg-card/60 px-4 py-3",
                hit ? severityStyles[rule.severity] : "border-border/60",
              )}
            >
              <Switch
                checked={rule.enabled}
                onCheckedChange={(on) =>
                  persist(rules.map((r) => (r.id === rule.id ? { ...r, enabled: on } : r)))
                }
              />
              <div className="min-w-0 flex-1">
                <p dir="auto" className="truncate text-sm font-medium text-foreground">
                  {rule.name}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{describeRule(rule)}</p>
              </div>
              <span className="font-mono text-sm">
                {error ? "—" : value === null ? "…" : value.toLocaleString("en-US")}
              </span>
              <span
                className={cn(
                  "rounded-lg px-2 py-1 text-[10px] font-semibold",
                  hit
                    ? "bg-destructive/15 text-destructive"
                    : rule.enabled
                      ? "bg-accent/15 text-accent"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {error ?? (!rule.enabled ? "معطّل" : hit ? SEVERITY_LABELS[rule.severity] : "سليم")}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => persist(rules.filter((r) => r.id !== rule.id))}
                className="size-8 rounded-lg text-muted-foreground hover:text-destructive"
                aria-label="حذف القاعدة"
              >
                <Trash2 className="size-4" strokeWidth={2} />
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
