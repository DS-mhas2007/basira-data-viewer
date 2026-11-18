import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, FileSpreadsheet, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";

const TITLE = "تحليل البيانات بالعربية: من ملف Excel إلى نتائج واضحة | MIZYAi";
const DESC = "حلّل ملفات Excel وCSV بالعربية داخل المتصفح: استيراد البيانات، فحص الجودة، الإحصاءات والرسوم، وطرح أسئلة على بياناتك مع توضيح حدود الخصوصية.";
const CANONICAL = "https://basira-data-viewer.lovable.app/guide/data-analysis-arabic";

export const Route = createFileRoute("/guide/data-analysis-arabic")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [guideArticle(TITLE, DESC, CANONICAL), guideBreadcrumb(TITLE, CANONICAL)],
  }),
  component: Page,
});

function Page() {
  return (
    <GuideLayout
      eyebrow="تحليل البيانات بالعربية"
      eyebrowIcon={<BarChart3 className="size-3.5 text-primary" />}
      title="حلّل ملف Excel أو CSV بالعربية — من البيانات إلى القرار"
      intro="بدلاً من التنقل بين أدوات كثيرة، ابدأ بملفك، افحص جودته، افهم أعمدته، ثم استكشف الإحصاءات والرسوم واسأل أسئلة تحليلية. MIZYAi مساحة تحليل عربية مع معالجة أساسية داخل المتصفح، وميزات AI اختيارية."
      ctaTitle="ابدأ بتحليل ملفك"
      related={[
        { to: "/guide/arabic-csv-excel", label: "دليل استيراد وتحليل CSV عربي وExcel" },
        { to: "/guide/data-quality-score", label: "فهم درجة جودة البيانات" },
        { to: "/guide/ask-data-in-arabic", label: "اسأل بياناتك بالعربية" },
        { to: "/guide/choose-chart", label: "اختيار الرسم البياني المناسب" },
      ]}
    >
      <GuideSection id="workflow" title="كيف تبدأ؟">
        <ol className="space-y-3">
          {[
            ["استيراد ملفك", "افتح ملف CSV أو XLSX، وتأكد من قراءة الأعمدة والقيم بصورة صحيحة."],
            ["فحص الجودة", "راجع القيم المفقودة، الصفوف المكررة، وأنواع الأعمدة قبل التحليل."],
            ["استكشاف البيانات", "افهم المقاييس الوصفية، التوزيعات، والعلاقات التي تستحق فحصاً إضافياً."],
            ["اسأل أو أنشئ رسماً", "استخدم السؤال التحليلي أو الرسوم لتوضيح النتائج، ثم راجع الأدلة والقيود."],
          ].map(([title, detail], i) => (
            <li key={title} className="flex gap-3 rounded-xl border border-border/50 bg-surface-1 p-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">{i + 1}</span>
              <div><h3 className="font-display text-sm font-bold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p></div>
            </li>
          ))}
        </ol>
      </GuideSection>
      <GuideSection id="capabilities" title="ما الذي يمكنك استكشافه؟">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            [FileSpreadsheet, "ملفات Excel وCSV", "قراءة الملفات وفحص بنية الجدول والأعمدة."],
            [ShieldCheck, "جودة البيانات", "كشف مشكلات الجودة ومراجعة اقتراحات التنظيف قبل اعتمادها."],
            [BarChart3, "الإحصاءات والرسوم", "استكشاف المقاييس والتوزيعات واختيار التصور المناسب."],
            [Sparkles, "الأسئلة باللغة العربية", "اطرح سؤالاً تحليلياً؛ راجع الاستعلام والدليل والنتيجة قبل اتخاذ قرار."],
          ].map(([icon, title, detail]) => {\n            const Icon = icon as LucideIcon;\n            return (
            <div key={title as string} className="rounded-xl border border-border/50 bg-surface-1 p-4">
              <Icon className="size-5 text-primary" />
              <h3 className="mt-2 font-display text-sm font-bold">{title as string}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail as string}</p>
            </div>
          ))}
        </div>
      </GuideSection>
      <GuideSection id="privacy" title="ماذا عن الخصوصية؟">
        <p className="text-sm leading-loose text-muted-foreground">التحليل الأساسي يجري داخل المتصفح. ميزات الذكاء الاصطناعي اختيارية وقد ترسل السؤال ووصف الأعمدة أو عينات محدودة ونتائج الاستعلامات إلى مزوّد النموذج. لا ترفع بيانات حساسة إلا بعد مراجعة ما ترسله الميزة وسياسة الخصوصية.</p>
      </GuideSection>
      <GuideSection id="limitations" title="استخدم النتائج بحكم تحليلي">
        <p className="text-sm leading-loose text-muted-foreground">الأدوات تساعد على الاستكشاف، لكنها لا تثبت السببية ولا تضمن أن البيانات تمثل الواقع. راجع حجم العينة، تعريف الأعمدة، جودة المصدر، وطريقة الحساب قبل مشاركة الاستنتاجات.</p>
      </GuideSection>
      <GuideSection id="faq" title="أسئلة شائعة">
        <div className="space-y-4">
          <div><h3 className="font-display text-sm font-bold">هل يدعم ملفات Excel وCSV؟</h3><p className="text-sm leading-relaxed text-muted-foreground">نعم، يمكن استيراد ملفات XLSX وCSV وبدء فحصها وتحليلها.</p></div>
          <div><h3 className="font-display text-sm font-bold">هل يجب أن أستخدم الذكاء الاصطناعي؟</h3><p className="text-sm leading-relaxed text-muted-foreground">لا، التحليل الأساسي وفحص البيانات متاحان دون الاعتماد على ميزات AI؛ وهي اختيارية.</p></div>
          <div><h3 className="font-display text-sm font-bold">هل يمكن الاعتماد على الإجابات آلياً؟</h3><p className="text-sm leading-relaxed text-muted-foreground">لا تعتمد عليها دون مراجعة؛ افحص الاستعلام والنتيجة والسياق وحدود البيانات.</p></div>
        </div>
      </GuideSection>
    </GuideLayout>
  );
}
