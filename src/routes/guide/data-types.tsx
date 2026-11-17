import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { Hash, CheckCircle2 } from "lucide-react";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/data-types";
const TITLE = "تحويل الأرقام المخزنة كنص في Excel وCSV إلى أرقام";
const DESC =
  "لماذا لا تُحسب الأرقام في Excel وCSV؟ تعرّف على الأرقام المخزنة كنص، وفواصل الآلاف والكسور، وتحويل نوع العمود مع فحص القيم غير القابلة للتحويل.";

export const Route = createFileRoute("/guide/data-types")({
  head: () => ({
    meta: [
      { title: "تحويل الأرقام المخزنة كنص في Excel وCSV — MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "إصلاح الأرقام المخزنة كنص في Excel وCSV — MIZYAi" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "تحويل الأرقام المخزنة كنص — MIZYAi" },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [guideBreadcrumb(TITLE, CANONICAL), guideArticle(TITLE, DESC, CANONICAL)],
  }),
  component: Page,
});

const P = "text-sm leading-loose text-muted-foreground";

function Page() {
  return (
    <GuideLayout
      eyebrow="دليل عملي · أنواع البيانات"
      eyebrowIcon={<Hash className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="قد تبدو القيمة 1250 رقماً للعين، لكن الملف قد يخزنها كنص. عندها قد تفشل عمليات الجمع والمتوسط والترتيب الرقمي. الحل ليس تحويل كل عمود إلى رقم بلا فحص؛ ابدأ بتحديد نوعه ومعنى قيمه."
      related={[
        { to: "/guide/arabic-csv-excel", label: "فتح وتحليل ملف CSV عربي وExcel" },
        { to: "/guide/fix-arabic-encoding", label: "إصلاح ترميز النصوص العربية في CSV" },
        { to: "/guide/data-dictionary", label: "استخدام قاموس البيانات لفهم الأعمدة" },
        { to: "/guide/arabic-text-cleaning", label: "تنظيف النصوص العربية والمسافات الخفية" },
      ]}
    >
      <GuideSection id="symptoms" title="علامات أن الرقم مخزّن كنص">
        <ul className="space-y-2">
          {[
            "ترتيب القيم أبجدياً: 1، 10، 100، 2 بدلاً من الترتيب العددي.",
            "فشل SUM أو AVERAGE في تضمين بعض الخلايا.",
            "ظهور مثلث تنبيه أو محاذاة مختلفة في بعض إصدارات Excel.",
            "احتواء العمود على قيم رقمية مع كلمات مثل غير معروف أو شرطة أو رمز عملة.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />{item}
            </li>
          ))}
        </ul>
      </GuideSection>

      <GuideSection id="causes" title="أسباب شائعة في الملفات العربية">
        <p className={P}>
          قد تستخدم الملفات الفاصلة العشرية العربية أو الغربية، أو فواصل آلاف، أو أرقاماً هندية مثل
          ١٢٣، أو مسافات غير مرئية. وقد تحتوي القيمة على رمز عملة أو نسبة مئوية. كل حالة تحتاج تفسيراً
          قبل التحويل؛ إزالة الرموز عشوائياً قد تغيّر معنى القيمة.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full text-right text-xs">
            <thead className="bg-surface-1 text-muted-foreground">
              <tr><th className="p-3">القيمة الظاهرة</th><th className="p-3">ما يجب فحصه</th></tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr><td className="p-3 font-mono">"1,250"</td><td className="p-3">هل الفاصلة لفصل الآلاف؟</td></tr>
              <tr><td className="p-3 font-mono">"12.5%"</td><td className="p-3">هل تريد 12.5 أم 0.125؟</td></tr>
              <tr><td className="p-3 font-mono">"١٢٣٫٥"</td><td className="p-3">هل الأرقام والفاصل عربيان؟</td></tr>
              <tr><td className="p-3 font-mono">"—"</td><td className="p-3">هل تمثل قيمة مفقودة أم صفراً؟</td></tr>
            </tbody>
          </table>
        </div>
      </GuideSection>

      <GuideSection id="convert" title="خطوات التحويل دون إفساد البيانات">
        <ol className="space-y-2">
          {[
            "حدد العمود الذي يفترض أن يكون رقمياً، وافحص عينة من القيم المختلفة.",
            "وحّد الفواصل والمسافات والرموز وفق تنسيق المصدر، ولا تفترض معنى الفاصلة.",
            "احسب عدد القيم القابلة للتحويل وعدد القيم التي ستفشل.",
            "حوّل العمود إلى نوع رقمي بعد مراجعة القيم غير الصالحة.",
            "قارن الحد الأدنى والأقصى والمجموع قبل التحويل وبعده لاكتشاف تغيّر غير متوقع.",
          ].map((item, i) => (
            <li key={item} className="flex gap-3 text-xs leading-relaxed text-muted-foreground">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono font-bold text-primary">{i + 1}</span>{item}
            </li>
          ))}
        </ol>
        <p className={P}>
          في MIZYAi تُفحص قابلية تحويل العمود أولاً، وتُعرض القيم المتأثرة في معاينة قبل تطبيق خطوة
          التحويل. اترك أعمدة المعرّفات وأرقام الهواتف والرموز البريدية نصية إذا كانت الأصفار البادئة
          جزءاً من معناها.
        </p>
      </GuideSection>

      <GuideSection id="faq" title="أسئلة شائعة">
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-sm font-bold">هل أحوّل رقم الهوية إلى نوع رقمي؟</h3>
            <p className={P}>غالباً لا. رقم الهوية معرّف وليس كمية قابلة للجمع، وقد يحتوي أصفاراً في بدايته. احتفظ به كنص ما لم توجد حاجة تقنية موثقة.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">لماذا لا يتحول العمود كله رغم أن أغلبه أرقام؟</h3>
            <p className={P}>قد توجد كلمات أو رموز أو تواريخ أو فواصل غير متسقة. افحص القيم الفاشلة بدلاً من تحويلها تلقائياً إلى صفر.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل تغيير تنسيق الخلية في Excel يكفي؟</h3>
            <p className={P}>ليس دائماً. تغيير العرض لا يحوّل بالضرورة النص المخزّن إلى قيمة رقمية. تحقق من النوع الفعلي بإجراء عملية حسابية أو بفحص بيانات العمود.</p>
          </div>
        </div>
      </GuideSection>
    </GuideLayout>
  );
}
