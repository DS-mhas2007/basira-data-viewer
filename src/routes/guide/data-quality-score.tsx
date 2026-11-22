import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { Gauge, CheckCircle2 } from "@/components/icons";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/data-quality-score";
const TITLE = "فحص جودة البيانات في Excel وCSV: قراءة الدرجة من 100";
const DESC =
  "افحص القيم المفقودة والتكرار الكامل وعدم اتساق أنواع الأعمدة في ملف Excel أو CSV، وافهم ما تعنيه الدرجة من 100 وما لا يقيسه المؤشر.";

export const Route = createFileRoute("/guide/data-quality-score")({
  head: () => ({
    meta: [
      { title: "فحص جودة البيانات في Excel وCSV | MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "فحص جودة البيانات في Excel وCSV | MIZYAi" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "فحص جودة البيانات في Excel وCSV | MIZYAi" },
      { name: "twitter:description", content: DESC },
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
      eyebrow="دليل عملي · جودة البيانات"
      eyebrowIcon={<Gauge className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="درجة جودة البيانات في MIZYAi مؤشر من 100 يُحسب من ثلاثة فحوص محددة: نسبة الخلايا المفقودة، ونسبة الصفوف المكررة بالكامل، ونسبة الأعمدة التي يظهر فيها عدم اتساق نوع البيانات. لا يقيس المؤشر وحده صحة القيم أو القيم الشاذة أو التكرار حسب مفتاح."
      related={[
        { to: "/guide/remove-duplicates", label: "إزالة الصفوف المكررة بالكامل" },
        { to: "/guide/data-cleaning-arabic", label: "خطوات تنظيف البيانات بعد الفحص" },
        { to: "/guide/arabic-csv-excel", label: "تحليل ملف CSV عربي وفحصه قبل بدء العمل" },
        { to: "/guide/ask-data-in-arabic", label: "تحويل سؤال تحليلي إلى استعلام يمكن مراجعته" },
      
        { to: "/guide/missing-values", label: "معالجة القيم المفقودة دون تعويض عشوائي" },
        { to: "/guide/data-dictionary", label: "فهم أنواع الأعمدة واكتمالها قبل التحليل" },
        { to: "/guide/outlier-detection", label: "فحص القيم المتطرفة خارج مؤشر الجودة" },
      ]}
    >
      <GuideSection id="axes" title="ما الذي يدخل فعلياً في الدرجة؟">
        <ul className="space-y-3">
          {[
            {
              t: "القيم المفقودة — وزن أقصى 40 نقطة",
              d: "تُحسب نسبة الخلايا الفارغة من إجمالي خلايا الجدول، ويُخصم منها ما يصل إلى 40 نقطة بحسب النسبة.",
            },
            {
              t: "الصفوف المكررة بالكامل — وزن أقصى 30 نقطة",
              d: "يُقارن كل صف بجميع الأعمدة. تكرار رقم طلب مع اختلاف بقية الأعمدة لا يدخل في هذا الخصم تلقائياً.",
            },
            {
              t: "عدم اتساق نوع العمود — وزن أقصى 30 نقطة",
              d: "يرصد الفحص العمود النصي الذي تبدو 70% أو أكثر من قيمه أرقاماً، لكنه يحتوي أيضاً قيماً نصية غير رقمية.",
            },
          ].map((s) => (
            <li key={s.t} className="rounded-xl border border-border/50 bg-surface-1 p-4">
              <h3 className="font-display text-sm font-bold">{s.t}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ul>
        <p className={P}>
          تُحسب الدرجة بطرح الخصومات الثلاث من 100 ثم تقريب الناتج إلى أقرب عدد صحيح، مع حد أدنى صفر.
          تُعرض الأعمدة ذات القيمة الثابتة كملاحظة تشخيصية، لكنها لا تخصم نقاطاً من الدرجة.
        </p>
      </GuideSection>

      <GuideSection id="read" title="كيف تقرأ درجة جودة البيانات وما حدودها؟">
        <p className={P}>
          وفق تصنيف MIZYAi: من 80 إلى 100 «جيد»، ومن 50 إلى 79 «يحتاج انتباهاً»، وأقل من 50 «ضعيف».
          هذه حدود تشغيلية للمؤشر وليست معياراً علمياً عاماً أو ضماناً لصلاحية البيانات.
          راجع قائمة المشكلات وقواعد المجال قبل اتخاذ قرار.
        </p>
        <p className={P}>
          الفحص الحالي لا يكتشف القيم الشاذة إحصائياً، ولا يتحقق من صحة القيم وفق قواعد العمل،
          ولا يكتشف التكرار على مفتاح جزئي. افحص هذه الجوانب بشكل مستقل عند الحاجة.
        </p>
      </GuideSection>

      <GuideSection id="clean" title="تنظيف غير تدميري: القاعدة الذهبية">
        <p className={P}>
          لا تعدّل ملفك الأصلي أبداً. الأسلوب الصحيح هو بناء طبقة تنظيف فوق البيانات (عرض
          منطقي) تطبّق خطوات مثل حذف المكررات وتوحيد النصوص وتطبيع الأرقام، مع إمكانية التراجع عن
          أي خطوة ورؤية أثرها على الدرجة فوراً.
        </p>
        <ul className="space-y-2">
          {[
            "وثّق كل خطوة تنظيف حتى يستطيع غيرك إعادة إنتاج النتيجة.",
            "لا تملأ الفراغات بصفر تلقائياً — الصفر قيمة، والفراغ غياب معلومة.",
            "وحّد كتابة النصوص العربية (الألف والهمزة والتاء المربوطة) قبل التجميع حسب الفئة.",
            "أعد قياس الدرجة بعد التنظيف وأرفقها في التقرير كدليل على الجاهزية.",
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
                <h3 className="font-display text-sm font-bold">ما أهم أبعاد جودة البيانات؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">الأبعاد الشائعة تشمل الاكتمال، والتفرّد، والاتساق، والصحة أو المعقولية. قد تحتاج أيضاً إلى قياس الدقة والحداثة بحسب مجال البيانات والغرض من التحليل.</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-bold">هل درجة جودة 90 من 100 تعني أن البيانات صحيحة؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">لا. الدرجة مؤشر تلخيصي يعتمد على الفحوصات والأوزان المستخدمة، ولا تثبت صحة كل قيمة أو خلو البيانات من التحيّز. راجع تفاصيل المخالفات وقواعد المجال قبل اتخاذ قرار.</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-bold">هل أعوّض كل الخلايا الفارغة بالصفر؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">لا. الصفر قيمة فعلية بينما الفراغ قد يعني أن المعلومة غير متاحة أو لم تُسجّل. حدّد معنى النقص أولاً، ثم اختر الحذف أو التعويض أو الإبقاء وفق طبيعة المتغير والتحليل.</p>
              </div>
            </div>
          </GuideSection>
    </GuideLayout>
  );
}
