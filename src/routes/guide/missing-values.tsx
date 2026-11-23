import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, CheckCircle2 } from "@/components/icons";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/missing-values";
export const TITLE = "القيم المفقودة في Excel وCSV: متى تحذفها ومتى تعوّضها؟";
export const DESC =
  "تعلّم اكتشاف الخلايا الفارغة في Excel وCSV، والاختيار بين الحذف والتعويض بالوسيط أو القيمة الأكثر تكراراً، مع تجنّب إدخال تحيّز إلى التحليل.";

export const Route = createFileRoute("/guide/missing-values")({
  head: () => ({
    meta: [
      { title: "القيم المفقودة في Excel وCSV: طرق المعالجة — MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "معالجة القيم المفقودة في Excel وCSV — MIZYAi" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "القيم المفقودة في Excel وCSV — MIZYAi" },
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
      eyebrow="دليل عملي · تنظيف البيانات"
      eyebrowIcon={<ClipboardList className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="وجود خلية فارغة لا يعني دائماً وجود خطأ. قد تكون القيمة غير مسجّلة، أو غير منطبقة، أو فُقدت أثناء جمع البيانات. لذلك ابدأ بفهم سبب النقص قبل اختيار طريقة المعالجة."
      related={[
        { to: "/guide/data-quality-score", label: "قياس جودة البيانات واكتشاف النواقص" },
        { to: "/guide/data-dictionary", label: "فهم نوع كل عمود ودوره قبل التنظيف" },
        { to: "/guide/data-types", label: "إصلاح أنواع البيانات والأرقام المخزنة كنص" },
      ]}
    >
      <GuideSection id="detect" title="كيف تكتشف القيم المفقودة؟">
        <p className={P}>
          افحص عدد الخلايا الفارغة ونسبتها في كل عمود، لا العدد الإجمالي فقط. قد يحتوي عمود صغير على
          نسبة نقص مرتفعة بينما يبدو الجدول كله مكتملاً. انتبه أيضاً إلى القيم التي تمثل الفراغ نصياً
          مثل N/A أو NA أو غير متوفر؛ فقد لا يتعرف عليها البرنامج كقيمة NULL تلقائياً.
        </p>
        <div className="rounded-xl border border-border/50 bg-surface-1 p-4">
          <p className="font-display text-sm font-bold">مثال سريع</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            إذا كان عمود العمر يحتوي 8 خلايا فارغة من أصل 100 صف، فنسبة النقص فيه 8%. هذه النسبة
            تصف حجم المشكلة، لكنها لا تخبرنا وحدها هل يجب حذف الصفوف أو تعويضها.
          </p>
        </div>
      </GuideSection>

      <GuideSection id="choose" title="اختر طريقة المعالجة حسب معنى العمود">
        <ul className="space-y-3">
          {[
            { t: "الحذف", d: "قد يكون مناسباً إذا كان عدد الصفوف الناقصة قليلاً، وكانت الصفوف غير أساسية، ولم يؤد الحذف إلى تحيّز العينة أو فقد فئة مهمة." },
            { t: "الوسيط للأرقام", d: "قد يكون خياراً عملياً للمتغيرات الرقمية الملتوية أو المتأثرة بالقيم المتطرفة؛ لكنه يقلل التباين وقد يخفي نمط النقص." },
            { t: "المتوسط للأرقام", d: "يتأثر بالقيم الكبيرة والصغيرة جداً، لذلك لا تستخدمه تلقائياً دون فحص التوزيع." },
            { t: "الأكثر تكراراً للفئات", d: "يمكن أن يناسب عموداً فئوياً بسيطاً، لكنه قد يضخم الفئة الأكثر شيوعاً ويغير نسب الفئات." },
            { t: "الإبقاء على الفراغ", d: "أفضل من تعويض غير مبرر عندما لا تعرف سبب النقص أو عندما يحمل غياب القيمة معنى مستقلاً." },
          ].map((item) => (
            <li key={item.t} className="rounded-xl border border-border/50 bg-surface-1 p-4">
              <h3 className="font-display text-sm font-bold">{item.t}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.d}</p>
            </li>
          ))}
        </ul>
      </GuideSection>

      <GuideSection id="workflow" title="سير عمل آمن قبل اعتماد التعديل">
        <ol className="space-y-2">
          {[
            "احتفظ بنسخة من الملف الأصلي وسجّل عدد الصفوف قبل التنظيف.",
            "افحص نسبة النقص لكل عمود، وقارنها بالفئات أو الفترات الزمنية.",
            "حدد ما إذا كان الفراغ يعني مجهولاً أم غير منطبق أم لم يُسجّل.",
            "جرّب طريقة المعالجة على معاينة، ثم قارن القيم قبل التعديل وبعده.",
            "أعد حساب المؤشرات والنتائج بعد التنظيف، ووثّق القرار في التقرير.",
          ].map((item, i) => (
            <li key={item} className="flex gap-3 text-xs leading-relaxed text-muted-foreground">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono font-bold text-primary">{i + 1}</span>
              {item}
            </li>
          ))}
        </ol>
        <p className={P}>
          في MIZYAi يمكنك اختيار عدم إجراء أي تعديل، أو التعويض بالوسيط للأعمدة الرقمية وبالقيمة الأكثر
          تكراراً للنصوص، أو إدخال قيمة مخصصة. تعرض الأداة معاينة للتغييرات قبل اعتماد خطوة التنظيف.
        </p>
      </GuideSection>

      <GuideSection id="faq" title="أسئلة شائعة">
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-sm font-bold">هل أملأ كل الخلايا الفارغة بصفر؟</h3>
            <p className={P}>لا. الصفر قيمة رقمية حقيقية، وقد يغيّر المتوسط والمجموع والنسب. استخدمه فقط عندما يعني الصفر فعلاً عدم وجود كمية أو نشاط وفق تعريف البيانات.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل الوسيط أفضل دائماً من المتوسط؟</h3>
            <p className={P}>لا. الاختيار يعتمد على شكل التوزيع، ومعنى المتغير، وآلية فقد القيم. لا توجد طريقة تعويض واحدة مناسبة لكل الأعمدة.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل التعويض يثبت أن البيانات أصبحت صحيحة؟</h3>
            <p className={P}>لا. التعويض قرار تحليلي قد يضيف افتراضات. احتفظ بعدد القيم التي عُوّضت ووثّق الطريقة، ثم اختبر أثرها على النتائج.</p>
          </div>
        </div>
      </GuideSection>
    </GuideLayout>
  );
}
