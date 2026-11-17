import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { GitBranch, CheckCircle2 } from "lucide-react";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/correlation-analysis";
const TITLE = "تحليل الارتباط بين المتغيرات: ماذا تعني قيمة Correlation؟";
const DESC =
  "افهم معامل ارتباط Pearson وSpearman، وقراءة القيم من ‎-1 إلى ‎+1، والفرق بين الارتباط والسببية عند تحليل البيانات.";

export const Route = createFileRoute("/guide/correlation-analysis")({
  head: () => ({
    meta: [
      { title: "تحليل الارتباط: Pearson وSpearman | MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "تحليل الارتباط: Pearson وSpearman | MIZYAi" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "تحليل الارتباط: Pearson وSpearman | MIZYAi" },
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
      eyebrow="دليل عملي · العلاقات بين المتغيرات"
      eyebrowIcon={<GitBranch className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="يساعد تحليل الارتباط (Correlation Analysis) على وصف اتجاه وقوة العلاقة بين متغيرين. لكنه لا يثبت أن أحدهما يسبب الآخر؛ فقد تفسر العلاقةَ عوامل ثالثة، أو تكون نتيجة اختيار العينة أو طريقة القياس."
      related={[
        { to: "/guide/descriptive-statistics", label: "مراجعة المتوسط والتوزيع قبل تحليل العلاقة" },
        { to: "/guide/outlier-detection", label: "فحص القيم المتطرفة التي قد تؤثر في الارتباط" },
        { to: "/guide/data-dictionary", label: "تحديد معنى المتغيرات ووحداتها" },
      ]}
    >
      <GuideSection id="read" title="كيف تقرأ معامل الارتباط؟">
        <p className={P}>تتراوح قيمة معامل الارتباط بين −1 و+1. الإشارة الموجبة تعني أن القيم تميل إلى الارتفاع معاً، والسالبة تعني أن ارتفاع أحد المتغيرين يرتبط بانخفاض الآخر، أما القيمة القريبة من الصفر فتعني غياب علاقة خطية واضحة وفق هذا المقياس.</p>
        <p className={P}>القوة لا تُقرأ من الإشارة وحدها. ارتباط +0.85 قوي موجب، و−0.85 قوي سالب، لكن تفسير ما يعد قوياً يعتمد على المجال وجودة القياس وحجم العينة. لا تحوّل الحدود الإرشادية إلى قانون ثابت.</p>
      </GuideSection>

      <GuideSection id="pearson-spearman" title="Pearson أم Spearman؟">
        <p className={P}>Pearson: يقيس قوة واتجاه العلاقة الخطية بين متغيرين رقميين. يتأثر بالقيم المتطرفة، وقد يكون مضللاً إذا كانت العلاقة غير خطية.</p>
        <p className={P}>Spearman: يعتمد على رتب القيم، ويقيس علاقة رتيبة (Monotonic)؛ أي إن أحد المتغيرين يميل إلى الزيادة أو النقصان مع الآخر، حتى لو لم تكن العلاقة خطية تماماً. لا يعني ذلك أنه يكتشف كل أشكال العلاقات.</p>
        <p className={P}>ارسم المتغيرين في Scatter Plot أولاً. قد تكشف السحابة علاقة منحنية أو مجموعات فرعية لا يلخصها معامل واحد.</p>
      </GuideSection>

      <GuideSection id="pitfalls" title="أخطاء تفسيرية يجب تجنبها">
        <ul className="space-y-2">{["الخلط بين الارتباط والسببية؛ قد يكون هناك متغير مربك (Confounder).","تجاهل القيم المتطرفة أو أخطاء الوحدات التي قد تغيّر قيمة Pearson.","حساب معامل واحد لمجموعات مختلفة ثم تجاهل اختلاف العلاقة داخل كل مجموعة.","اعتبار الارتباط القريب من الصفر دليلاً على عدم وجود أي علاقة؛ فقد تكون العلاقة غير خطية.","إهمال القيم المفقودة أو اختيار عينة تجعل العلاقة تبدو أقوى أو أضعف."].map((item) => (<li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />{item}</li>))}</ul>
        <p className={P}>مثال: قد يرتبط استهلاك المثلجات بحالات ضربة الشمس، لكن الطقس الحار عامل ثالث يرفع كليهما. لا نستنتج أن المثلجات تسبب ضربة الشمس من الارتباط وحده.</p>
      </GuideSection>

      <GuideSection id="faq" title="أسئلة شائعة">
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-sm font-bold">هل الارتباط 0.9 يعني أن العلاقة سببية؟</h3>
            <p className={P}>لا. يعني وجود ارتباط قوي وفق المقياس المستخدم، لكنه لا يحدد اتجاه السببية ولا يستبعد العوامل المربكة.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">متى أستخدم Spearman؟</h3>
            <p className={P}>عندما تكون العلاقة متوقعة أن تكون رتيبة لا خطية، أو عندما يكون استخدام الرتب أنسب لطبيعة القياس. افحص الرسم والبيانات قبل الاختيار.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل يمكن أن يكون الارتباط صفراً مع وجود علاقة؟</h3>
            <p className={P}>نعم. قد توجد علاقة منحنية أو نمط غير خطي لا يلتقطه معامل Pearson، لذلك لا تعتمد على رقم واحد دون تصور بصري.</p>
          </div>
        </div>
      </GuideSection>

    </GuideLayout>
  );
}
