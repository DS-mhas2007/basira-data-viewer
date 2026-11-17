import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, CheckCircle2 } from "lucide-react";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/outlier-detection";
const TITLE = "القيم المتطرفة في البيانات: كيف تكتشفها دون حذفها عشوائياً؟";
const DESC =
  "تعرّف على القيم المتطرفة في Excel وCSV، وطريقة المدى الربيعي IQR ودرجة Z، ومتى تكون القيمة النادرة صحيحة ولا ينبغي حذفها.";

export const Route = createFileRoute("/guide/outlier-detection")({
  head: () => ({
    meta: [
      { title: "القيم المتطرفة: اكتشافها وتفسيرها | MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "القيم المتطرفة: اكتشافها وتفسيرها | MIZYAi" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "القيم المتطرفة: اكتشافها وتفسيرها | MIZYAi" },
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
      eyebrow="دليل عملي · فحص القيم"
      eyebrowIcon={<Activity className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="القيمة المتطرفة (Outlier) هي مشاهدة بعيدة عن النمط العام، لكنها ليست خطأً بالضرورة. قد تمثل حالة نادرة صحيحة، أو خطأ إدخال، أو اختلافاً في وحدة القياس. الهدف ليس حذف كل قيمة بعيدة، بل اكتشافها ثم تفسيرها قبل اتخاذ قرار."
      related={[
        { to: "/guide/descriptive-statistics", label: "فهم المتوسط والوسيط والتوزيع" },
        { to: "/guide/data-quality-score", label: "معرفة ما تقيسه درجة جودة البيانات" },
        { to: "/guide/missing-values", label: "التعامل مع القيم المفقودة قبل التحليل" },
      ]}
    >
      <GuideSection id="methods" title="طريقتان شائعتان لاكتشاف القيم البعيدة">
        <p className={P}>المدى الربيعي (IQR): رتّب القيم واحسب الربع الأول Q1 والربع الثالث Q3، ثم احسب IQR = Q3 − Q1. تُعلَّم القيم الأقل من Q1 − 1.5×IQR أو الأعلى من Q3 + 1.5×IQR على أنها مرشحة للفحص، لا أخطاء مؤكدة.</p>
        <p className={P}>درجة Z: تقيس بُعد القيمة عن المتوسط بوحدات الانحراف المعياري: Z = (x − mean) / SD. قد تكون قاعدة |Z| > 3 إشارة أولية في بعض التوزيعات، لكنها أقل ملاءمة عندما يكون التوزيع ملتويًا أو العينة صغيرة أو القيم شديدة التأثير.</p>
        <p className={P}>لا توجد عتبة واحدة تصلح لكل المجالات. حد إنذار طبي أو مالي أو صناعي يجب أن يستند إلى معرفة المجال وتكلفة الخطأ، لا إلى قاعدة إحصائية عامة فقط.</p>
      </GuideSection>

      <GuideSection id="workflow" title="سير عمل آمن قبل حذف أي قيمة">
        <ul className="space-y-2">{["تحقق من الوحدة والنطاق الممكن: هل القيمة 5000 ريال أم 5000 هللة؟","ارجع إلى السجل الأصلي أو مصدر القياس إن أمكن، وابحث عن خطأ فاصلة أو صفر زائد.","قارن القيمة داخل مجموعتها المناسبة؛ فقد تكون مرتفعة إجمالاً لكنها طبيعية لفئة معينة.","قارن المتوسط والوسيط والمدرج التكراري قبل المعالجة وبعدها.","وثّق القرار: إبقاء، تصحيح من المصدر، استبعاد مبرر، أو تحليل حساسية يعرض النتائج بالطريقتين."].map((item) => (<li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />{item}</li>))}</ul>
      </GuideSection>

      <GuideSection id="example" title="مثال: قيمة مرتفعة لا تعني أنها خاطئة">
        <p className={P}>افترض أن مبالغ الطلبات هي 12، 14، 15، 16، 180. قد تكون 180 خطأ إدخال، وقد تكون طلبية جملة حقيقية. حذفها يغيّر متوسط المبيعات ويخفي شريحة مهمة من العملاء. افحص رقم الطلب والمنتج والعملة والسياق قبل الاستبعاد.</p>
        <p className={P}>في MIZYAi يمكنك الاستفادة من ملخصات الأعمدة الرقمية مثل الحد الأدنى والأقصى والمتوسط والوسيط والمدرج التكراري لفهم التوزيع. لكن درجة جودة البيانات الحالية لا تتضمن كشفاً آلياً للقيم المتطرفة؛ لا تفسّرها على أنها فحص Outlier.</p>
      </GuideSection>

      <GuideSection id="faq" title="أسئلة شائعة">
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-sm font-bold">هل أحذف كل قيمة تتجاوز 1.5×IQR؟</h3>
            <p className={P}>لا. هذه قاعدة لتحديد القيم المرشحة للفحص فقط. افحص صحة السجل وسياقه وأثر الاستبعاد قبل الحذف.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل الوسيط أفضل من المتوسط مع القيم المتطرفة؟</h3>
            <p className={P}>غالباً يكون الوسيط أكثر مقاومة للقيم البعيدة، لكن اعرض المقياسين وافحص التوزيع لأن كل واحد يجيب عن جانب مختلف.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل اكتشاف القيمة المتطرفة يثبت وجود خطأ؟</h3>
            <p className={P}>لا. هو إشارة إحصائية إلى مشاهدة غير معتادة، وليس حكماً على صحة البيانات أو سببها.</p>
          </div>
        </div>
      </GuideSection>

    </GuideLayout>
  );
}
