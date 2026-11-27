import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { CloudAiConsentControl, useCloudAiConsent } from "@/lib/cloud-ai-consent.tsx";
import { metered } from "@/lib/ai-action";
import { suggestChartAlternatives } from "@/lib/chart-suggest.functions";
import {
  buildSuggestPayload,
  validateSuggestions,
  type ValidSuggestion,
} from "@/lib/chart-ai-suggest";
import type { ChartConfig, ChartPoint } from "@/lib/chart-studio";

interface Props {
  schema: { name: string; type: string }[];
  config: ChartConfig;
  points: ChartPoint[];
  onApply: (patch: ValidSuggestion["patch"], title: string) => void;
}

/** اقتراحات AI اختيارية: لا إرسال إلا بعد موافقة منفصلة وضغط صريح، والحمولة معروضة مسبقاً. */
export function ChartAiSuggest({ schema, config, points, onApply }: Props) {
  const ask = useServerFn(suggestChartAlternatives);
  const { cloudAiConsent, setCloudAiConsent } = useCloudAiConsent();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ValidSuggestion[] | null>(null);
  const payload = buildSuggestPayload({ schema }, config, points);

  async function run() {
    if (busy || !cloudAiConsent || points.length === 0) return;
    setBusy(true);
    setError(null);
    setItems(null);
    try {
      const res = (await metered(ask)({ data: { ...payload, cloudAiConsent: true } as never })) as
        { ok: true; suggestions: unknown[] } | { ok: false; error: string };
      if (!res.ok) return void setError(res.error);
      const valid = validateSuggestions({ suggestions: res.suggestions }, { schema });
      if (valid.length === 0) setError("لم يقترح النموذج رسماً صالحاً لهذه البيانات.");
      setItems(valid);
    } catch {
      setError("تعذّر طلب الاقتراحات الآن.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rounded-lg border border-white/10 px-3 py-2 text-xs">
      <summary className="cursor-pointer select-none text-muted-foreground">
        اقتراحات رسوم بالذكاء الاصطناعي (اختيارية)
      </summary>
      <div className="mt-2 space-y-2">
        <CloudAiConsentControl checked={cloudAiConsent} onChange={setCloudAiConsent} />
        <details className="text-[11px] text-muted-foreground">
          <summary className="cursor-pointer">ما الذي سيُرسل بالضبط؟</summary>
          <p className="mt-1 leading-relaxed">
            أسماء الأعمدة وأنواعها، إعداد الرسم الحالي، وحتى {payload.points.length} نقطة مجمّعة من
            أصل {payload.totalPoints}. لا صفوف خام ولا الملف كاملاً.
          </p>
          <pre
            dir="ltr"
            className="mt-1 max-h-40 overflow-auto rounded bg-black/20 p-2 text-[10px]"
          >
            {JSON.stringify(payload, null, 2)}
          </pre>
        </details>
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          disabled={!cloudAiConsent || busy || points.length === 0}
          onClick={() => void run()}
        >
          {busy ? "جارٍ الطلب…" : "اطلب اقتراحات"}
        </Button>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {items && items.length > 0 && (
          <ul className="space-y-2">
            {items.map((s, i) => (
              <li key={i} className="rounded-md border border-white/10 p-2">
                <div className="font-semibold">{s.title}</div>
                <p className="text-muted-foreground">{s.why}</p>
                <p className="text-[10px] text-muted-foreground">
                  مبني على: {s.patch.kind}
                  {s.patch.x ? ` · ${s.patch.x}` : ""}
                  {s.patch.y ? ` × ${s.patch.y}` : ""}
                  {s.patch.agg ? ` (${s.patch.agg})` : ""}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => onApply(s.patch, s.title)}
                >
                  معاينة على الرسم (يمكن التراجع)
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
