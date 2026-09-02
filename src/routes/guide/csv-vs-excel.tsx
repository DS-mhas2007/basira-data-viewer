import { createFileRoute } from "@tanstack/react-router";
import { FileDiff, CheckCircle2 } from "lucide-react";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/csv-vs-excel";
const TITLE = "الفرق بين CSV و Excel: أيهما تختار لبياناتك العربية؟";
const DESC =
  "مقارنة عملية بين ملفات CSV و XLSX للبيانات العربية: الترميز، الصيغ، تعدد الأوراق، الحجم، والأداء — ومتى تختار كل صيغة قبل التحليل.";

export const Route = createFileRoute("/guide/csv-vs-excel")({
  head: () => ({
    meta: [
      { title: `${TITLE} — بصيرة` },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          inLanguage: "ar",
          url: CANONICAL,
          description: DESC,
        }),
      },
    ],
  }),
  component: Page,
});

const P = "text-sm leading-loose text-muted-foreground";

function Page() {
  return (
    <GuideLayout
      eyebrow="دليل عملي · صيغ الملفات"
      eyebrowIcon={<FileDiff className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="الصيغة التي تصدّر بها بياناتك تحدد نصف مشاكلك لاحقاً: حروف متكسّرة، أرقام تتحول لنصوص، أو تواريخ تتبدّل. هذا الدليل يوضح الفرق عملياً ومتى تختار كل صيغة."
      related={[
        { to: "/guide/fix-arabic-encoding", label: "حل مشكلة الحروف العربية المتكسّرة في CSV" },
        { to: "/guide/data-quality-score", label: "درجة جودة البيانات: كيف تقيس نظافة ملفك" },
      ]}
    >
      <GuideSection id="diff" title="الفروق الجوهرية">
        <ul className="space-y-3">
          {[
            {
              t: "الترميز",
              d: "CSV ملف نصي بلا معلومة ترميز، لذلك تظهر الحروف العربية متكسّرة عند فتحه بترميز خاطئ. XLSX يخزّن النص بترميز موحّد داخلياً فلا تحدث هذه المشكلة.",
            },
            {
              t: "الأنواع والصيغ",
              d: "CSV يحفظ نصاً فقط: كل رقم وتاريخ يُعاد تخمين نوعه عند القراءة. XLSX يحفظ النوع والتنسيق والمعادلات.",
            },
            {
              t: "تعدد الأوراق",
              d: "CSV ورقة واحدة فقط. XLSX يدعم أوراقاً متعددة، ولهذا يجب اختيار الورقة الصحيحة قبل التحليل.",
            },
            {
              t: "الحجم والأداء",
              d: "CSV أخف وأسرع في القراءة للملفات الضخمة. XLSX أثقل لأنه أرشيف مضغوط يحوي تنسيقات وأنماطاً.",
            },
          ].map((s) => (
            <li key={s.t} className="rounded-xl border border-border/50 bg-surface-1 p-4">
              <h3 className="font-display text-sm font-bold">{s.t}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ul>
      </GuideSection>

      <GuideSection id="choose" title="متى تختار كل صيغة؟">
        <p className={P}>
          اختر XLSX عندما تكون البيانات عربية وتُشارك بين زملاء يفتحونها بـ Excel، أو عندما تحتاج
          أوراقاً متعددة وتنسيقاً. واختر CSV عندما يكون الملف ضخماً أو مخرجاً من نظام آخر أو
          مُعداً للاستيراد إلى قاعدة بيانات — بشرط تصديره بترميز UTF-8.
        </p>
      </GuideSection>

      <GuideSection id="rules" title="قواعد تصدير آمنة">
        <ul className="space-y-2">
          {[
            "صدّر CSV بترميز UTF-8 مع BOM حتى يفتحه Excel العربي بشكل صحيح.",
            "لا تدمج خلايا ولا تضع عناوين مزدوجة — صف عناوين واحد في الأعلى فقط.",
            "احذف صفوف المجاميع من الملف؛ احسبها في التحليل لا في المصدر.",
            "وحّد صيغة التاريخ قبل التصدير لتجنّب الخلط بين اليوم والشهر.",
          ].map((f) => (
            <li
              key={f}
              className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
            >
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2} />
              {f}
            </li>
          ))}
        </ul>
      </GuideSection>
    </GuideLayout>
  );
}
