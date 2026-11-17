import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, CheckCircle2 } from "lucide-react";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/time-series-analysis";
const TITLE = "تحليل السلاسل الزمنية في Excel: الاتجاه والموسمية والتغير";
const DESC =
  "تعلّم تحليل البيانات عبر الزمن، وتوحيد التواريخ، وتجميع البيانات يومياً أو شهرياً، والتمييز بين الاتجاه والموسمية والتنبؤ.";

export const Route = createFileRoute("/guide/time-series-analysis")({
  head: () => ({
    meta: [
      { title: "تحليل السلاسل الزمنية في Excel: الاتجاه والموسمية والتغير — MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "تحليل السلاسل الزمنية في Excel: الاتجاه والموسمية والتغير — MIZYAi" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "تحليل السلاسل الزمنية في Excel: الاتجاه والموسمية والتغير — MIZYAi" },
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
      eyebrow="دليل عملي · التحليل الزمني"
      eyebrowIcon={<TrendingUp className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="السلسلة الزمنية (Time Series) هي قياسات مرتبة زمنياً، مثل المبيعات اليومية أو عدد الزيارات الشهرية. ترتيب الوقت جزء من معنى البيانات؛ لذلك قد يؤدي تاريخ مخزّن كنص أو فترات غير مكتملة إلى استنتاج خاطئ."
      related={[
        { to: "/guide/date-format", label: "إصلاح تنسيق التاريخ قبل التحليل" },
        { to: "/guide/choose-chart", label: "اختيار الرسم المناسب للاتجاهات الزمنية" },
        { to: "/guide/descriptive-statistics", label: "تلخيص القيم ومقارنة التوزيعات" },
      ]}
    >
      <GuideSection id="prepare" title="جهّز السلسلة الزمنية أولاً">
        <ul className="space-y-2">{["تأكد من أن عمود التاريخ يُقرأ كتاريخ فعلي لا كنص، واحسم ترتيب اليوم والشهر.","حدد وحدة الزمن: يوم، أسبوع، شهر، أو سنة، ولا تخلط بينها في المقارنة.","افحص التواريخ المكررة والفترات المفقودة، وحدد هل الغياب يعني صفراً أم عدم تسجيل.","وحّد تعريف المقياس ووحدته عبر الزمن؛ فلا تقارن إيراداً إجمالياً بعد الضريبة بآخر قبلها."].map((item) => (<li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />{item}</li>))}</ul>
      </GuideSection>

      <GuideSection id="patterns" title="ثلاثة أنماط أساسية">
        <p className={P}>الاتجاه (Trend): حركة طويلة الأجل صعوداً أو هبوطاً. قد يرتفع عدد العملاء تدريجياً عبر عدة أشهر حتى مع وجود تذبذب يومي.</p>
        <p className={P}>الموسمية (Seasonality): نمط يتكرر على فترات معروفة، مثل زيادة الطلب في شهر معين كل سنة. لا يمكن إثباتها من دورة واحدة قصيرة.</p>
        <p className={P}>التذبذب أو الصدمة (Noise / Shock): تغيرات قصيرة أو أحداث غير متكررة. اربط القفزات بالأحداث التشغيلية قبل تفسيرها.</p>
      </GuideSection>

      <GuideSection id="aggregation" title="التجميع الزمني قد يغيّر القصة">
        <p className={P}>قد يخفي التجميع الشهري قفزة حدثت في يوم واحد، بينما يجعل العرض اليومي الاتجاه العام صعب القراءة. اختر مستوى التجميع وفق السؤال، وقارن الفترات المتكافئة: شهر كامل مع شهر كامل، لا شهر مكتمل مع شهر جارٍ.</p>
        <p className={P}>في MIZYAi يدعم استوديو الرسوم تجميع البيانات الزمنية بمستويات مثل اليوم والأسبوع والشهر والسنة للأعمدة المناسبة. هذا استكشاف وتجميع للبيانات، وليس نموذج تنبؤ آلياً بالمستقبل.</p>
      </GuideSection>

      <GuideSection id="moving-average" title="استخدم المتوسط المتحرك بحذر">
        <p className={P}>المتوسط المتحرك (Moving Average) يلخص نافذة متجاورة من الفترات لتقليل التذبذب القصير. نافذة 7 أيام مثلاً تعرض متوسط كل يوم مع الأيام السبعة المحيطة أو السابقة بحسب التعريف المستخدم.</p>
        <p className={P}>كلما كبرت النافذة أصبح الخط أنعم، لكن قد تتأخر الاستجابة للتحولات الحقيقية. وثّق طول النافذة وطريقة التعامل مع بداية السلسلة والقيم المفقودة.</p>
      </GuideSection>

      <GuideSection id="faq" title="أسئلة شائعة">
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-sm font-bold">هل الرسم الخطي هو الأفضل دائماً للسلاسل الزمنية؟</h3>
            <p className={P}>غالباً يناسب الاتجاهات، لكن الأعمدة قد تكون أوضح لمقارنة فترات منفصلة، والمساحة قد تناسب الحجم التراكمي. يعتمد الاختيار على السؤال.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل التجميع الشهري يثبت وجود موسمية؟</h3>
            <p className={P}>لا. التجميع يعرض النمط، أما إثبات الموسمية فيحتاج تاريخاً كافياً وعدة دورات ومراعاة التغيرات الأخرى.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل MIZYAi يتنبأ بالمبيعات القادمة؟</h3>
            <p className={P}>الدليل يشرح التحليل الاستكشافي والتجميع الزمني المتاح في الرسوم؛ لا ينبغي اعتبار الرسم أو التجميع تنبؤاً آلياً.</p>
          </div>
        </div>
      </GuideSection>

    </GuideLayout>
  );
}
