import { createFileRoute } from "@tanstack/react-router";
import { Table2, CheckCircle2 } from "lucide-react";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/pivot-alternative";
const TITLE = "بديل الجداول المحورية (Pivot Tables) لتقارير عربية أسرع";
const DESC =
  "متى تكفي الجداول المحورية في Excel ومتى تصبح عبئاً، وكيف تنتقل إلى تجميع تلقائي وتقارير PDF و PPTX و HTML عربية جاهزة من ملف CSV أو XLSX.";

export const Route = createFileRoute("/guide/pivot-alternative")({
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
      eyebrow="دليل عملي · التقارير"
      eyebrowIcon={<Table2 className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="الجدول المحوري أداة ممتازة — حتى تتكرر المهمة كل أسبوع بملف جديد. عندها يتحوّل الوقت كله إلى إعادة بناء نفس التجميعات ونفس التنسيق. هذا الدليل يوضح متى تبقى مع Excel ومتى تنتقل لسير عمل آلي."
      related={[
        { to: "/guide/ask-data-in-arabic", label: "اسأل بياناتك بالعربية واحصل على استعلام موثّق" },
        { to: "/guide/arabic-csv-excel", label: "كيف تحلّل ملفات Excel و CSV بالعربية دون رفعها" },
      ]}
    >
      <GuideSection id="limits" title="أين تتعثر الجداول المحورية؟">
        <ul className="space-y-2">
          {[
            "إعادة البناء اليدوي مع كل ملف جديد، وتكرار نفس الأخطاء.",
            "الأرقام العربية والعملة تُقرأ كنص فلا تُجمَع أصلاً.",
            "اتجاه RTL والخطوط العربية يفسدان تنسيق التقرير عند التصدير.",
            "لا سجل يوضح كيف وصلت للرقم، فيصعب مراجعته لاحقاً.",
            "الملفات الكبيرة تُبطئ الجهاز وتجمّد التطبيق.",
          ].map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2} />
              {f}
            </li>
          ))}
        </ul>
      </GuideSection>

      <GuideSection id="workflow" title="سير عمل بديل في أربع خطوات">
        <ol className="space-y-3">
          {[
            {
              t: "ارفع الملف مرة واحدة",
              d: "CSV أو XLSX متعدد الأوراق، مع كشف تلقائي للترميز والفاصل وأنواع الأعمدة.",
            },
            {
              t: "دع التجميعات تُبنى تلقائياً",
              d: "ملخص بصري للأعمدة الرقمية والفئوية بدل سحب الحقول يدوياً في كل مرة.",
            },
            {
              t: "اطلب ما ينقصك بالعربية",
              d: "أي تقاطع إضافي (مثل الإيراد حسب المدينة والشهر) يُنفَّذ كاستعلام موثّق ويُثبَّت في اللوحة.",
            },
            {
              t: "صدّر تقريراً جاهزاً",
              d: "PDF أو PPTX أو HTML مستقل بخطوط عربية واتجاه RTL صحيح، بأسلوب تنفيذي أو تحليلي.",
            },
          ].map((s, i) => (
            <li key={s.t} className="flex gap-3 rounded-xl border border-border/50 bg-surface-1 p-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 font-mono text-xs font-bold text-primary">
                {i + 1}
              </span>
              <div>
                <h3 className="font-display text-sm font-bold">{s.t}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </GuideSection>

      <GuideSection id="stay" title="متى تبقى مع Excel؟">
        <p className={P}>
          إذا كان الملف صغيراً والتقرير لمرة واحدة، أو تحتاج تحريراً يدوياً للخلايا وصيغاً
          مخصصة يراجعها فريقك داخل المصنف نفسه — فالجدول المحوري أسرع. الانتقال يستحق العناء حين
          تتكرر المهمة، أو تحتاج دليلاً قابلاً للمراجعة، أو تتعامل مع بيانات حساسة يجب ألا تغادر
          جهازك.
        </p>
      </GuideSection>
    </GuideLayout>
  );
}
