import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { Languages, CheckCircle2 } from "lucide-react";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/fix-arabic-encoding";
const TITLE = "حل مشكلة الحروف العربية المتكسّرة في ملفات CSV";
const DESC =
  "تظهر الحروف العربية كرموز عند فتح CSV؟ تعرّف على أسباب مشكلة الترميز، والفرق بين UTF-8 وWindows-1256، وخطوات إصلاح الملف في Excel وGoogle Sheets.";

export const Route = createFileRoute("/guide/fix-arabic-encoding")({
  head: () => ({
    meta: [
      { title: "إصلاح ترميز CSV العربي: حل مشكلة الحروف المتكسّرة — MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "إصلاح ترميز CSV العربي: حل مشكلة الحروف المتكسّرة — MIZYAi" },
      { property: "og:description", content: "تظهر الحروف العربية كرموز عند فتح CSV؟ تعرّف على أسباب مشكلة الترميز، والفرق بين UTF-8 وWindows-1256، وخطوات إصلاح الملف في Excel وGoogle Sheets." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "إصلاح ترميز CSV العربي: حل مشكلة الحروف المتكسّرة — MIZYAi" },
      { name: "twitter:description", content: "تظهر الحروف العربية كرموز عند فتح CSV؟ تعرّف على أسباب مشكلة الترميز، والفرق بين UTF-8 وWindows-1256، وخطوات إصلاح الملف في Excel وGoogle Sheets." },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      guideBreadcrumb(TITLE, CANONICAL),
      guideArticle(TITLE, DESC, CANONICAL),
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: TITLE,
          inLanguage: "ar",
          url: CANONICAL,
          description: DESC,
          step: [
            { "@type": "HowToStep", name: "تعرّف على الترميز الأصلي للملف" },
            { "@type": "HowToStep", name: "أعد فتح الملف بترميز Windows-1256 أو UTF-8" },
            { "@type": "HowToStep", name: "احفظ نسخة بترميز UTF-8 مع BOM" },
            { "@type": "HowToStep", name: "تحقّق من الأرقام والفواصل بعد التحويل" },
          ],
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
      eyebrow="دليل عملي · الترميز العربي"
      eyebrowIcon={<Languages className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="تفتح ملف CSV فيه أسماء ومدن عربية، فتجد رموزاً مثل ãäÇÁÉ بدل النص. المشكلة ليست في ملفك بل في الترميز الذي يُقرأ به. هذا الدليل يشرح السبب وأربع طرق مجرّبة للإصلاح."
      related={[
        { to: "/guide/arabic-csv-excel", label: "تحليل ملف CSV عربي وفتحه داخل المتصفح بعد إصلاح الترميز" },
        { to: "/guide/csv-vs-excel", label: "اختيار CSV أو Excel وفهم اختلاف الترميز بين الصيغ" },
        { to: "/guide/data-privacy-browser", label: "معرفة ما يُعالج محلياً وما قد يُرسل عند استخدام AI" },
      ]}
    >
      <GuideSection id="why" title="لماذا تتكسّر الحروف أصلاً؟">
        <p className={P}>
          ملف CSV نص خام لا يحمل معلومة عن ترميزه. حين يحفظ Excel على ويندوز ملفاً بصيغة «CSV
          (Comma delimited)» فهو غالباً يستخدم ترميز{" "}
          <span dir="ltr" className="font-mono text-foreground/90">Windows-1256</span> الخاص
          بالعربية، بينما تفترض معظم الأدوات الحديثة{" "}
          <span dir="ltr" className="font-mono text-foreground/90">UTF-8</span>. كل بايت يُفسَّر
          بجدول خاطئ، فتظهر الرموز الغريبة. الملف سليم — القراءة هي الخاطئة.
        </p>
      </GuideSection>

      <GuideSection id="fixes" title="أربع طرق للإصلاح">
        <ol className="space-y-3">
          {[
            {
              t: "في Excel: استخدم «من نص/CSV» بدل الفتح المباشر",
              d: "تبويب Data ← Get Data ← From Text/CSV، ثم اختر File Origin: Unicode (UTF-8) أو Arabic (Windows-1256) وشاهد المعاينة تتصحح قبل الاستيراد.",
            },
            {
              t: "في Google Sheets: استورد بدل النسخ",
              d: "File ← Import ← Upload، وفعّل خيار كشف الترميز التلقائي. Sheets يعالج UTF-8 افتراضياً ويصلح أغلب الملفات.",
            },
            {
              t: "احفظ نسخة بترميز UTF-8 مع BOM",
              d: "افتح الملف في Notepad واختر Save As ← Encoding: UTF-8 with BOM. هذه العلامة تخبر Excel صراحةً بالترميز فلا يخمّن.",
            },
            {
              t: "تجاوز المشكلة: اترك الأداة تكتشف الترميز",
              d: "MIZYAi تفحص أول بايتات الملف وتستنتج الترميز والفاصل تلقائياً، وتتيح لك تبديلهما يدوياً إن لزم — دون حفظ نسخ وسيطة.",
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

      <GuideSection id="after" title="ما الذي يجب فحصه بعد الإصلاح؟">
        <ul className="space-y-2">
          {[
            "الفاصل: بعض الأنظمة العربية تحفظ CSV بفاصلة منقوطة ( ; ) لا بفاصلة.",
            "الأرقام العربية (٠١٢٣) تحتاج تطبيعاً لتصبح قابلة للجمع والمتوسط.",
            "التواريخ الغامضة مثل 01/02/2025 قد تُقرأ يوم/شهر أو شهر/يوم — وحّد الصيغة.",
            "المسافات غير المرئية في نهايات النصوص العربية تفسد التجميع حسب الفئة.",
          ].map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2} />
              {f}
            </li>
          ))}
        </ul>
      </GuideSection>

          <GuideSection id="faq" title="أسئلة شائعة">
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-sm font-bold">لماذا تظهر العربية بشكل مثل Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">هذا غالباً خلل فك ترميز (Mojibake): تمت قراءة بايتات UTF-8 على أنها ترميز آخر أو العكس. جرّب استيراد الملف مع اختيار UTF-8 أولاً، ثم Windows-1256 إذا لم تظهر المعاينة صحيحة.</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-bold">هل UTF-8 هو نفسه Windows-1256؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">لا. كلاهما يرمّز النصوص لكنهما يستخدمان خرائط بايتات مختلفة. اختيار الترميز الصحيح يعتمد على الطريقة التي حُفظ بها الملف، وليس على لغة نظام التشغيل وحدها.</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-bold">هل إضافة BOM تصلح كل ملفات CSV العربية؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">لا. علامة BOM تساعد بعض البرامج، ومنها إصدارات Excel، على اكتشاف UTF-8 عند الفتح. لكنها لا تصلح ملفاً حُفظ أصلاً بترميز آخر أو نصاً تالفاً؛ تحقّق من المعاينة قبل حفظ نسخة جديدة.</p>
              </div>
            </div>
          </GuideSection>
    </GuideLayout>
  );
}
