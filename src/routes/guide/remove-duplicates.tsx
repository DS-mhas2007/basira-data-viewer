import { createFileRoute } from "@tanstack/react-router";
import { CopyX, CheckCircle2 } from "lucide-react";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/remove-duplicates";
const TITLE = "إزالة الصفوف المكررة والفراغات دون إتلاف بياناتك";
const DESC =
  "خطوات عملية لاكتشاف الصفوف المكررة والخلايا الفارغة في ملفات Excel و CSV العربية، والفرق بين التكرار الكامل والتكرار على مفتاح، وكيف تنظّف بأسلوب قابل للتراجع.";

export const Route = createFileRoute("/guide/remove-duplicates")({
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
          "@type": "HowTo",
          name: TITLE,
          inLanguage: "ar",
          url: CANONICAL,
          description: DESC,
          step: [
            { "@type": "HowToStep", name: "اكتشف نوع التكرار" },
            { "@type": "HowToStep", name: "حدّد مفتاح الهوية" },
            { "@type": "HowToStep", name: "نظّف في طبقة منفصلة" },
            { "@type": "HowToStep", name: "أعد قياس الجودة" },
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
      eyebrow="دليل عملي · التنظيف"
      eyebrowIcon={<CopyX className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="أكثر سبب لأرقام مضخّمة في التقارير هو صفوف مكررة لم ينتبه لها أحد. الحل ليس حذفاً عشوائياً بل تمييز نوع التكرار ثم التنظيف بخطوات موثّقة يمكن التراجع عنها."
      related={[
        { to: "/guide/data-quality-score", label: "درجة جودة البيانات: كيف تقيس نظافة ملفك" },
        { to: "/guide/pivot-alternative", label: "بديل الجداول المحورية لتقارير عربية أسرع" },
      ]}
    >
      <GuideSection id="kinds" title="نوعان مختلفان من التكرار">
        <p className={P}>
          التكرار الكامل يعني صفّين متطابقين في كل الأعمدة، وغالباً سببه دمج ملفات أو تصدير
          مرّتين، وحذفه آمن. أما التكرار على مفتاح — مثل تكرار رقم الطلب أو رقم الهوية مع اختلاف
          بقية الأعمدة — فهو الأخطر لأنه يعني تحديثات متعددة للسجل نفسه، والحذف العشوائي هنا يفقدك
          آخر حالة صحيحة.
        </p>
      </GuideSection>

      <GuideSection id="steps" title="خطوات التنظيف">
        <ol className="space-y-3">
          {[
            {
              t: "١. احسب حجم المشكلة أولاً",
              d: "اعرف عدد الصفوف المكررة ونسبتها قبل أي حذف؛ إذا تجاوزت 20% فالمشكلة في مصدر التصدير لا في الملف.",
            },
            {
              t: "٢. حدّد مفتاح الهوية",
              d: "اختر العمود أو مجموعة الأعمدة التي تعرّف السجل فعلياً، واحتفظ بأحدث صف حسب التاريخ بدل الحذف العشوائي.",
            },
            {
              t: "٣. عالج الفراغات بوعي",
              d: "الفراغ ليس صفراً. احذف الصفوف التي يغيب فيها المفتاح، وأبقِ الباقي مع توثيق نسبة النقص لكل عمود.",
            },
            {
              t: "٤. نظّف في طبقة منفصلة",
              d: "طبّق الخطوات كطبقة فوق البيانات الأصلية حتى تستطيع التراجع ومقارنة النتيجة قبل وبعد.",
            },
          ].map((s) => (
            <li key={s.t} className="rounded-xl border border-border/50 bg-surface-1 p-4">
              <h3 className="font-display text-sm font-bold">{s.t}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
      </GuideSection>

      <GuideSection id="arabic" title="فخاخ خاصة بالنصوص العربية">
        <ul className="space-y-2">
          {[
            "«أحمد» و«احمد» يُعدّان قيمتين مختلفتين ما لم توحّد الهمزات قبل المقارنة.",
            "المسافات الزائدة في نهاية الاسم تنتج تكراراً خفياً لا تراه بالعين.",
            "الأرقام العربية (١٢٣) تختلف عن (123) في المقارنة — طبّعها أولاً.",
            "التاء المربوطة والهاء في نهاية الكلمة سبب شائع لانقسام الفئة إلى فئتين.",
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
