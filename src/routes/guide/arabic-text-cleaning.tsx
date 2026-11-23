import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { Languages, CheckCircle2 } from "@/components/icons";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/arabic-text-cleaning";
export const TITLE = "تنظيف النصوص العربية في Excel وCSV: المسافات والحروف والأرقام";
export const DESC =
  "عالج المسافات الخفية والتطويل واختلاف أشكال الألف والياء والأرقام العربية في ملفات Excel وCSV، مع الحفاظ على النص الأصلي والمعنى.";

export const Route = createFileRoute("/guide/arabic-text-cleaning")({
  head: () => ({
    meta: [
      { title: "تنظيف النصوص العربية في Excel وCSV | MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "تنظيف النصوص العربية في Excel وCSV | MIZYAi" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "تنظيف النصوص العربية في Excel وCSV | MIZYAi" },
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
      eyebrow="دليل عملي · تنظيف النصوص العربية"
      eyebrowIcon={<Languages className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="قد تبدو كلمتا «القاهرة» و«القاهرة » متطابقتين، لكن مسافة غير مرئية قد تجعلهما فئتين مختلفتين عند التجميع. تنظيف النص العربي يحتاج قواعد واضحة؛ فالتطبيع العشوائي قد يدمج كلمات مختلفة أو يغيّر قيمة الاسم الأصلي."
      related={[
        { to: "/guide/fix-arabic-encoding", label: "إصلاح ترميز الحروف العربية في CSV" },
        { to: "/guide/remove-duplicates", label: "كشف التكرار بعد توحيد النصوص" },
        { to: "/guide/data-types", label: "معالجة الأرقام المخزنة كنص" },
      ]}
    >
      <GuideSection id="spaces" title="ابدأ بالمسافات والمحارف الخفية">
        <p className={P}>افحص المسافات في بداية النص ونهايته، والمسافات المتكررة، والمسافة غير القابلة للكسر (Non-breaking Space)، ومحارف الاتجاه أو التحكم التي قد لا تظهر بوضوح. هذه الاختلافات تؤثر في المطابقة والتجميع وإزالة التكرار.</p>
        <p className={P}>في Excel يمكن البدء بدالة TRIM لإزالة المسافات الزائدة المعتادة، لكن بعض المحارف غير المرئية تحتاج استبدالاً صريحاً أو معالجة مخصصة. احتفظ بعمود أصلي ولا تطبق التعديل فوق المصدر.</p>
      </GuideSection>

      <GuideSection id="normalization" title="توحيد الحروف العربية: ما الذي يجوز وما الذي يحتاج حذراً؟">
        <p className={P}>قد تختلف كتابة الألف (أ، إ، آ، ا)، أو الياء والألف المقصورة (ي، ى)، أو التاء المربوطة والهاء (ة، ه)، كما يظهر التطويل (ـ) والتشكيل في بعض المصادر. يمكن إنشاء مفتاح بحث موحّد لإزالة بعض الفروق الشكلية، لكن لا تغيّر الاسم المعروض أو السجل الأصلي تلقائياً.</p>
        <p className={P}>توحيد ة مع ه أو حذف الهمزات قد يدمج أسماء مختلفة في بعض السياقات. قرر قواعد التطبيع وفق المجال، واحتفظ دائماً بالنص الأصلي وعمود normalized_key منفصل للمقارنة.</p>
      </GuideSection>

      <GuideSection id="digits" title="الأرقام العربية والفواصل وعلامات الترقيم">
        <ul className="space-y-2">{["حدد ما إذا كانت الأرقام هندية عربية (١٢٣) أم غربية (123)، ثم وحّدها في عمود رقمي مخصص عند الحاجة.","افحص الفواصل العشرية وفواصل الآلاف قبل التحويل إلى أرقام.","وحّد أشكال علامات الترقيم فقط عندما لا تحمل معنى في الحقل.","لا تزل الرموز من أرقام الهواتف أو المعرفات أو الرموز البريدية دون فهم وظيفتها."].map((item) => (<li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />{item}</li>))}</ul>
      </GuideSection>

      <GuideSection id="workflow" title="خطوات تنظيف قابلة للتراجع">
        <ul className="space-y-2">{["احتفظ بنسخة من العمود الأصلي.","احصر الاختلافات باستخدام القيم المميزة وعينات من كل فئة.","اكتب قواعد التطبيع صراحة، وطبّقها على عمود مشتق.","قارن عدد الفئات قبل التنظيف وبعده، وراجع القيم التي اندمجت.","اختبر عينة يدوياً ثم وثّق القواعد وإصدارها."].map((item) => (<li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />{item}</li>))}</ul>
        <p className={P}>لا يعني توحيد النصوص أن كل اختلاف إملائي خطأ. أسماء الأشخاص والأماكن تحتاج مراجعة سياقية، خصوصاً عندما تكون البيانات مرجعاً قانونياً أو صحياً.</p>
      </GuideSection>

      <GuideSection id="faq" title="أسئلة شائعة">
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-sm font-bold">هل أوحّد أ وإ وآ إلى ا دائماً؟</h3>
            <p className={P}>يمكن أن يكون ذلك مناسباً لمفتاح بحث أو تجميع محدد، لكنه ليس قاعدة عامة لكل النصوص. احتفظ بالقيمة الأصلية وراجع أثر الدمج.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">لماذا لا تتطابق كلمتان متشابهتان في Excel؟</h3>
            <p className={P}>قد تختلفان بمسافة خفية أو محرف Unicode أو شكل حرف. افحص المحارف والقيم الفعلية، لا المظهر فقط.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل حذف التشكيل والتطويل آمن؟</h3>
            <p className={P}>غالباً يفيد في بعض مهام المطابقة، لكن طبّقه على نسخة مشتقة واختبر أثره وفق نوع النص والغرض.</p>
          </div>
        </div>
      </GuideSection>

    </GuideLayout>
  );
}
