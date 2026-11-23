import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, CheckCircle2 } from "@/components/icons";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/chart-interpretation";
export const TITLE = "كيف تقرأ الرسم البياني وتفسّر النتائج دون استنتاجات مضللة؟";
export const DESC =
  "تعلّم قراءة المحاور والوحدات والمقاييس وحجم العينة، واكتشاف الرسوم المضللة، والتمييز بين الاتجاه والارتباط والسببية.";

export const Route = createFileRoute("/guide/chart-interpretation")({
  head: () => ({
    meta: [
      { title: "كيف تقرأ الرسم البياني وتفسّر النتائج؟ | MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "كيف تقرأ الرسم البياني وتفسّر النتائج؟ | MIZYAi" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "كيف تقرأ الرسم البياني وتفسّر النتائج؟ | MIZYAi" },
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
      eyebrow="دليل عملي · قراءة النتائج"
      eyebrowIcon={<BarChart3 className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="الرسم البياني ليس النتيجة بحد ذاته؛ إنه طريقة لعرض البيانات. قبل أن تقول إن المبيعات ارتفعت أو أن فئة تتفوق على أخرى، افحص ما الذي يقيسه المحور، وكيف جُمعت القيم، ومن الذي تمثله العينة."
      related={[
        { to: "/guide/choose-chart", label: "اختيار الرسم البياني المناسب للسؤال" },
        { to: "/guide/descriptive-statistics", label: "فهم المتوسط والوسيط والتوزيع" },
        { to: "/guide/time-series-analysis", label: "قراءة الاتجاهات عبر الزمن" },
      ]}
    >
      <GuideSection id="read" title="اقرأ الرسم بالترتيب الصحيح">
        <ul className="space-y-2">{["اقرأ العنوان: ما السؤال الذي يحاول الرسم الإجابة عنه؟","افحص المحورين والوحدات؛ هل القيمة عدد أم نسبة أم متوسط؟","تحقق من مقياس المحور وبداية الصفر، خصوصاً في رسوم الأعمدة.","افهم التجميع: هل المعروض مجموع أم متوسط أم عدد سجلات؟","تحقق من الفترة الزمنية وحجم العينة ومصدر البيانات."].map((item) => (<li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />{item}</li>))}</ul>
      </GuideSection>

      <GuideSection id="patterns" title="ميّز بين النمط والتفسير">
        <p className={P}>الارتفاع عبر الزمن قد يكون اتجاهاً، لكنه قد ينتج أيضاً عن نمو حجم العينة أو تغيير طريقة التسجيل. الفرق بين مجموع المبيعات ومتوسط قيمة الطلب مهم: قد يرتفع الإجمالي لأن عدد الطلبات زاد، لا لأن قيمة الطلب الواحد تحسنت.</p>
        <p className={P}>وجود مجموعتين متقاربتين في المتوسط لا يعني أن توزيعهما متشابه. راجع التشتت والقيم المتطرفة، ولا تختزل البيانات إلى رقم واحد إذا كانت الفروق داخل المجموعات مهمة.</p>
      </GuideSection>

      <GuideSection id="misleading" title="علامات الرسم المضلل">
        <ul className="space-y-2">{["محور مقطوع يضخم فرقاً صغيراً دون توضيح.","استخدام نسبة مئوية دون بيان المقام أو حجم العينة.","مقارنة فترات غير متساوية أو أشهر غير مكتملة.","ألوان أو أحجام رموز توحي بترتيب لا تدعمه البيانات.","خلط وحدات مختلفة على محور واحد دون تفسير.","استنتاج السببية من مجرد تزامن خطين أو ارتفاعهما معاً."].map((item) => (<li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />{item}</li>))}</ul>
      </GuideSection>

      <GuideSection id="communicate" title="حوّل الملاحظة إلى استنتاج مسؤول">
        <p className={P}>اكتب النتيجة في ثلاث طبقات: (1) ما الذي يظهر في الرسم؟ (2) ما التفسير المحتمل؟ (3) ما البيانات أو الاختبار الإضافي الذي تحتاجه قبل اعتماد التفسير؟ مثال: «ارتفع عدد الطلبات في الربع الثاني» وصف؛ أما «الحملة سببت الارتفاع» فتحتاج تصميماً يختبر السببية.</p>
        <p className={P}>في MIZYAi يمكنك إنشاء الرسوم باستخدام أنواع وتجميعات مختلفة. راجع عملية التجميع والوحدات والفترات قبل تصدير الرسم إلى تقرير؛ فاختيار SUM بدلاً من AVG قد يغير الرسالة بالكامل.</p>
      </GuideSection>

      <GuideSection id="faq" title="أسئلة شائعة">
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-sm font-bold">هل يجب أن يبدأ محور الأعمدة من الصفر؟</h3>
            <p className={P}>في رسوم الأعمدة التي تقارن أطوالاً، البدء من الصفر هو الخيار الأكثر أماناً غالباً. إذا استخدمت مقياساً مقطوعاً فوضّح ذلك بوضوح.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل ارتفاع خطين معاً يعني أن أحدهما سبب الآخر؟</h3>
            <p className={P}>لا. قد يتأثران بعامل ثالث أو باتجاه زمني مشترك. الارتباط لا يثبت السببية.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">لماذا أحتاج إلى حجم العينة؟</h3>
            <p className={P}>لأن النسبة أو المتوسط المستند إلى عدد قليل من المشاهدات قد يكون متقلباً، ويجب تفسيره في ضوء طريقة أخذ العينة.</p>
          </div>
        </div>
      </GuideSection>

    </GuideLayout>
  );
}
