import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";
import { createFileRoute } from "@tanstack/react-router";
import { CopyX, FileSpreadsheet, ScanSearch, ShieldCheck, type LucideIcon } from "@/components/icons";

export const TITLE = "تنظيف البيانات بالعربية: دليل عملي لملفات Excel وCSV | MIZYAi";
export const DESC = "تعلم تنظيف البيانات خطوة بخطوة: معالجة القيم المفقودة والتكرارات والتواريخ والنصوص العربية، مع الحفاظ على البيانات الأصلية ومراجعة أثر كل تعديل.";
const CANONICAL = "https://basira-data-viewer.lovable.app/guide/data-cleaning-arabic";

export const Route = createFileRoute("/guide/data-cleaning-arabic")({
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
      eyebrow="تنظيف البيانات بالعربية"
      eyebrowIcon={<ScanSearch className="size-3.5 text-primary" />}
      title="نظّف بيانات Excel وCSV قبل أن تثق في نتائج التحليل"
      intro="تنظيف البيانات ليس حذف كل ما يبدو غير طبيعي. إنه سلسلة قرارات موثّقة لفهم الأخطاء، وتحديد طريقة المعالجة المناسبة، ثم التحقق من أن التعديل لم يغيّر معنى البيانات."
      ctaTitle="ابدأ بفحص جودة ملفك"
      related={[
        { to: "/guide/data-quality-score", label: "كيف تقرأ درجة جودة البيانات؟" },
        { to: "/guide/missing-values", label: "معالجة القيم المفقودة" },
        { to: "/guide/remove-duplicates", label: "اكتشاف الصفوف المكررة" },
        { to: "/guide/data-types", label: "تحويل الأرقام المخزنة كنص إلى أرقام" },
        { to: "/guide/arabic-text-cleaning", label: "تنظيف النصوص العربية" },
        { to: "/guide/date-format", label: "توحيد صيغ التواريخ" },
      ]}
    >
      <GuideSection id="workflow" title="من أين تبدأ؟">
        <ol className="space-y-3">
          {[
            ["احتفظ بنسخة أصلية", "لا تبدأ بتعديل الملف الوحيد. احتفظ بالمصدر كما هو، واعمل على نسخة قابلة للمراجعة."],
            ["افهم بنية الجدول", "راجع أسماء الأعمدة، أنواع البيانات، عدد الصفوف، والوحدات المستخدمة قبل اختيار أي معالجة."],
            ["صنّف المشكلات", "افصل القيم المفقودة عن التكرار وأخطاء التنسيق والقيم غير المنطقية؛ فلكل مشكلة علاج مختلف."],
            ["طبّق أقل تعديل لازم", "اختر المعالجة التي تحافظ على أكبر قدر من المعلومات، وسجّل سببها والصفوف المتأثرة."],
            ["تحقق بعد التنظيف", "قارن عدد الصفوف والتوزيعات والقيم الأساسية قبل التعديل وبعده، وتأكد أن النتيجة منطقية."],
          ].map(([title, detail], i) => (
            <li key={title} className="flex gap-3 rounded-xl border border-border/50 bg-surface-1 p-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">{i + 1}</span>
              <div><h3 className="font-display text-sm font-bold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p></div>
            </li>
          ))}
        </ol>
      </GuideSection>
      <GuideSection id="problems" title="أشهر مشكلات جودة البيانات">
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            [FileSpreadsheet, "القيم المفقودة", "قد تكون غير متاحة أو غير منطبقة أو لم تُسجّل. لا تستبدلها تلقائياً بالصفر."],
            [CopyX, "الصفوف المكررة", "ميّز بين تكرار الصف بالكامل وتكرار السجل وفق مفتاح مثل رقم المعاملة."],
            [ScanSearch, "التنسيق وأنواع الأعمدة", "قد تُقرأ الأرقام كنصوص أو تختلط صيغ التاريخ، فتتعطل المقارنات والحسابات."],
            [ShieldCheck, "القيم غير المنطقية", "افحص الحدود والوحدات والسياق؛ القيمة النادرة ليست بالضرورة خطأ."],
          ] as [LucideIcon, string, string][]).map(([Icon, title, detail]) => (
            <div key={title as string} className="rounded-xl border border-border/50 bg-surface-1 p-4">
              <Icon className="size-5 text-primary" />
              <h3 className="mt-2 font-display text-sm font-bold">{title as string}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail as string}</p>
            </div>
          ))}
        </div>
      </GuideSection>
      <GuideSection id="decisions" title="كيف تختار طريقة المعالجة؟">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead><tr className="border-b border-border"><th className="p-2">المشكلة</th><th className="p-2">أسئلة قبل المعالجة</th><th className="p-2">قرار محتمل</th></tr></thead>
            <tbody>
              <tr className="border-b border-border/50"><td className="p-2">قيمة مفقودة</td><td className="p-2">هل الغياب عشوائي؟ وهل الحقل أساسي؟</td><td className="p-2">إبقاء، استبعاد مبرر، أو تعويض مناسب</td></tr>
              <tr className="border-b border-border/50"><td className="p-2">تكرار</td><td className="p-2">ما تعريف السجل الفريد؟</td><td className="p-2">إزالة التكرار وفق مفتاح موثّق</td></tr>
              <tr className="border-b border-border/50"><td className="p-2">تاريخ غير موحّد</td><td className="p-2">ما ترتيب اليوم والشهر والمنطقة الزمنية؟</td><td className="p-2">تحويل موحّد مع حفظ القيمة الأصلية</td></tr>
              <tr><td className="p-2">قيمة متطرفة</td><td className="p-2">هل هي خطأ إدخال أم حالة حقيقية؟</td><td className="p-2">التحقق قبل التصحيح أو الاستبعاد</td></tr>
            </tbody>
          </table>
        </div>
      </GuideSection>
      <GuideSection id="audit" title="اجعل التنظيف قابلاً للمراجعة">
        <p className="text-sm leading-loose text-muted-foreground">سجّل اسم العمود، ونوع المشكلة، وعدد السجلات المتأثرة، والقاعدة المستخدمة، وتاريخ التنفيذ. لا تكتفِ بملف يبدو أنظف؛ يجب أن تستطيع تفسير ما تغيّر ولماذا.</p>
      </GuideSection>
      <GuideSection id="privacy" title="الخصوصية وسلامة البيانات">
        <p className="text-sm leading-loose text-muted-foreground">تجنب رفع البيانات الشخصية أو الحساسة إلى خدمات خارجية دون صلاحية واضحة. راجع أين تتم المعالجة وما الذي قد يُرسل عند استخدام ميزات الذكاء الاصطناعي، واحتفظ بنسخة أصلية آمنة.</p>
      </GuideSection>
      <GuideSection id="faq" title="أسئلة شائعة">
        <div className="space-y-4">
          <div><h3 className="font-display text-sm font-bold">هل أحذف كل الصفوف التي تحتوي على فراغات؟</h3><p className="text-sm leading-relaxed text-muted-foreground">لا. قد يؤدي ذلك إلى فقد معلومات وانحياز العينة. افهم سبب الفقد وأثره قبل اختيار المعالجة.</p></div>
          <div><h3 className="font-display text-sm font-bold">هل القيمة المتطرفة خطأ دائماً؟</h3><p className="text-sm leading-relaxed text-muted-foreground">لا. قد تمثل حالة صحيحة ومهمة؛ تحقق من المصدر والوحدات والسياق قبل تعديلها.</p></div>
          <div><h3 className="font-display text-sm font-bold">هل يكفي أن ترتفع درجة الجودة؟</h3><p className="text-sm leading-relaxed text-muted-foreground">لا. المؤشر يساعد على الفحص، لكنه لا يثبت صحة البيانات أو ملاءمتها لسؤال التحليل.</p></div>
        </div>
      </GuideSection>
    </GuideLayout>
  );
}
