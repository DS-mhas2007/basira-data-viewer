import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { FileDiff, CheckCircle2 } from "lucide-react";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/csv-vs-excel";
const TITLE = "الفرق بين CSV و Excel: أيهما تختار لبياناتك العربية؟";
const DESC =
  "قارن بين CSV وExcel من حيث الترميز والصيغ وتعدد الأوراق والحجم. اختر الصيغة المناسبة لبياناتك العربية وتجنب أخطاء الاستيراد.";

export const Route = createFileRoute("/guide/csv-vs-excel")({
  head: () => ({
    meta: [
      { title: "الفرق بين CSV وExcel: مقارنة عملية للبيانات العربية — MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "الفرق بين CSV وExcel: مقارنة عملية للبيانات العربية — MIZYAi" },
      { property: "og:description", content: "قارن بين CSV وExcel من حيث الترميز والصيغ وتعدد الأوراق والحجم. اختر الصيغة المناسبة لبياناتك العربية وتجنب أخطاء الاستيراد." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "الفرق بين CSV وExcel: مقارنة عملية للبيانات العربية — MIZYAi" },
      { name: "twitter:description", content: "قارن بين CSV وExcel من حيث الترميز والصيغ وتعدد الأوراق والحجم. اختر الصيغة المناسبة لبياناتك العربية وتجنب أخطاء الاستيراد." },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      guideBreadcrumb(TITLE, CANONICAL),
      guideArticle(TITLE, DESC, CANONICAL),
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
              d: "CSV لا يفرض ترميزاً واحداً على كل الملفات؛ لذلك قد تظهر العربية متكسّرة إذا فُتح الملف بترميز مختلف عن ترميز التصدير. أما XLSX فيخزّن النصوص بصيغة Unicode ضمن بنية Office Open XML، ما يقلّل مشكلات الترميز عند تبادله مع البرامج المتوافقة، لكنه لا يمنع أخطاء الاستيراد والتحويل.",
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

      <GuideSection id="example" title="مثال عملي: كيف يحميك اختيار الصيغة؟">
        <p className={P}>
          تخيّل أن لديك سجل طلبات بهذه القيم:
        </p>
        <div className="overflow-x-auto rounded-xl border border-border/60 bg-surface-1 p-3">
          <table className="w-full min-w-[320px] text-right text-xs">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="p-2">رقم الطلب</th>
                <th className="p-2">التاريخ</th>
                <th className="p-2">المدينة</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 font-mono" dir="ltr">00125</td>
                <td className="p-2 font-mono" dir="ltr">03/04/2026</td>
                <td className="p-2">غزة</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="mt-3 space-y-2">
          <li className="text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">رقم الطلب:</strong> قد يحوّله Excel إلى 125 إذا خمّنه رقماً؛ استورده كنص كي لا تفقد الأصفار البادئة.
          </li>
          <li className="text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">التاريخ:</strong> القيمة 03/04/2026 ملتبسة بين 3 أبريل و4 مارس؛ استخدم تنسيقاً واضحاً مثل 2026-04-03 واتفق على تفسيره مع النظام المستقبِل.
          </li>
          <li className="text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">المدينة:</strong> تحقّق من ترميز UTF-8 عند الاستيراد، ولا تعتمد على فتح الملف بالنقر المزدوج إذا ظهرت الحروف بشكل غير صحيح.
          </li>
        </ul>
        <p className={P}>
          الخلاصة: CSV مناسب للتبادل والتحليل الآلي عندما تضبط الترميز والفاصل وأنواع الأعمدة. أما XLSX فيناسب العمل الذي يحتاج أوراقاً متعددة وتنسيقات وأنواع خلايا محفوظة.
        </p>
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
            "صدّر CSV بترميز UTF-8؛ ويمكن إضافة BOM إذا كان جمهورك يفتح الملف مباشرة في إصدارات Excel التي تحتاجه للتعرّف التلقائي على UTF-8، ثم اختبر الملف في البرنامج المستهدف.",
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

          <GuideSection id="faq" title="أسئلة شائعة">
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-sm font-bold">هل CSV يدعم أكثر من ورقة عمل؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">لا. CSV يمثل جدولاً نصياً واحداً. إذا احتجت أوراقاً متعددة أو تنسيقات وصيغ Excel، فاستخدم XLSX أو صدّر كل جدول إلى ملف CSV مستقل.</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-bold">أي صيغة أفضل للبيانات العربية؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">XLSX غالباً أسهل للتبادل مع مستخدمي Excel لأنه يحتفظ بالنصوص والأنواع والتنسيقات. ويمكن استخدام CSV بأمان أيضاً إذا ضُبط الترميز والفاصل وتحققت من طريقة فتحه.</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-bold">لماذا تتغير التواريخ أو الأرقام بعد فتح CSV؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">CSV لا يخزن نوع الخلية؛ البرنامج الذي يفتحه يخمّن هل القيمة تاريخ أو رقم أو نص. استخدم الاستيراد مع تحديد أنواع الأعمدة، واحتفظ بمعرّفات مثل أرقام الهواتف والرموز البريدية كنصوص.</p>
              </div>
            </div>
          </GuideSection>
    </GuideLayout>
  );
}
