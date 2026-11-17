import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, CheckCircle2 } from "lucide-react";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/descriptive-statistics";
const TITLE = "الإحصاء الوصفي للبيانات: المتوسط والوسيط والتوزيع";
const DESC =
  "افهم المتوسط والوسيط والحدين الأدنى والأقصى والتوزيع التكراري، ومتى تستخدم كل مقياس عند تحليل ملفات Excel وCSV.";

export const Route = createFileRoute("/guide/descriptive-statistics")({
  head: () => ({
    meta: [
      { title: "الإحصاء الوصفي: المتوسط والوسيط والتوزيع — MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "شرح الإحصاء الوصفي للبيانات — MIZYAi" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "الإحصاء الوصفي للبيانات — MIZYAi" },
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
      eyebrow="دليل عملي · التحليل الإحصائي"
      eyebrowIcon={<BarChart3 className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="الإحصاء الوصفي هو نقطة البداية لفهم مجموعة البيانات: ما القيم المعتادة؟ ما مدى انتشارها؟ هل توجد فئات تهيمن على الجدول؟ لا يثبت الوصف سبباً ولا يضمن أن العينة تمثل المجتمع."
      related={[
        { to: "/guide/choose-chart", label: "اختيار الرسم البياني المناسب لعرض النتائج" },
        { to: "/guide/data-dictionary", label: "فهم الأعمدة وأدوار المتغيرات" },
        { to: "/guide/missing-values", label: "معالجة القيم المفقودة قبل حساب الإحصاءات" },
        { to: "/guide/outlier-detection", label: "اكتشاف القيم المتطرفة وفحصها قبل الاستبعاد" },
        { to: "/guide/correlation-analysis", label: "فهم الارتباط بين المتغيرات وحدود تفسيره" },
      ]}
    >
      <GuideSection id="measures" title="أهم مقاييس النزعة المركزية">
        <div className="space-y-3">
          {[
            { t: "المتوسط الحسابي (Mean)", d: "مجموع القيم مقسوماً على عددها. مفيد عندما لا تهيمن قيم متطرفة، لكنه يتأثر بها بقوة." },
            { t: "الوسيط (Median)", d: "القيمة التي تقع في منتصف البيانات بعد ترتيبها. غالباً ما يلخص مركز التوزيع بشكل أفضل عندما يكون التوزيع ملتويًا." },
            { t: "المنوال (Mode)", d: "القيمة أو الفئة الأكثر تكراراً. مفيد للبيانات الفئوية، وقد يوجد أكثر من منوال." },
          ].map((item) => (
            <div key={item.t} className="rounded-xl border border-border/50 bg-surface-1 p-4">
              <h3 className="font-display text-sm font-bold">{item.t}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.d}</p>
            </div>
          ))}
        </div>
      </GuideSection>

      <GuideSection id="spread" title="لا تكتفِ بمقياس واحد">
        <p className={P}>
          افحص الحد الأدنى والأقصى والمدى والتوزيع التكراري. قد يكون متوسط مجموعتين متساوياً بينما
          تختلف درجة التشتت بينهما. كما أن وجود قيمة قصوى بعيدة عن بقية القيم يستحق الفحص، لكنه لا
          يثبت وحده أنها خطأ.
        </p>
        <p className={P}>
          مثال: إذا كانت أزمنة الانتظار بالدقائق هي 4، 5، 5، 6، 40، فالمتوسط 12 والوسيط 5.
          القيمة 40 رفعت المتوسط، لذلك عرض المقياسين معاً يعطي صورة أوضح من المتوسط وحده.
        </p>
      </GuideSection>

      <GuideSection id="workflow" title="سير عمل وصفي قابل للمراجعة">
        <ol className="space-y-2">
          {[
            "تحقق من نوع العمود والوحدة، ولا تحسب متوسطاً لمعرّف أو رمز.",
            "افحص عدد القيم المفقودة قبل حساب المقاييس.",
            "اعرض المتوسط والوسيط والحدين الأدنى والأقصى معاً عند تحليل الأرقام.",
            "راجع التوزيع التكراري والقيم البعيدة، ولا تحذفها دون سبب موثق.",
            "قسّم النتائج حسب فئة أو فترة فقط عندما يكون التقسيم ذا معنى.",
          ].map((item, i) => (
            <li key={item} className="flex gap-3 text-xs leading-relaxed text-muted-foreground">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono font-bold text-primary">{i + 1}</span>{item}
            </li>
          ))}
        </ol>
        <p className={P}>
          يعرض توصيف MIZYAi للأعمدة الرقمية الحد الأدنى والأقصى والمتوسط والوسيط ومدرجاً تكرارياً،
          وللأعمدة الفئوية القيم الأكثر تكراراً، كما يمكنه عرض اتجاه زمني شهري للأعمدة المناسبة.
          لا تتضمن هذه البطاقة كل المقاييس الإحصائية الممكنة؛ اختر ما يلائم سؤالك.
        </p>
      </GuideSection>

      <GuideSection id="faq" title="أسئلة شائعة">
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-sm font-bold">متى أستخدم الوسيط بدلاً من المتوسط؟</h3>
            <p className={P}>عندما يكون التوزيع ملتويًا أو يحتوي قيماً متطرفة تؤثر بقوة على المتوسط. اعرض الاثنين عند الحاجة ولا تختر أحدهما دون النظر إلى التوزيع.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل الإحصاء الوصفي يثبت وجود علاقة سببية؟</h3>
            <p className={P}>لا. هو يلخص البيانات المرصودة. الاستدلال السببي يحتاج تصميماً وافتراضات وتحليلاً مختلفاً.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل القيمة المتطرفة خطأ دائماً؟</h3>
            <p className={P}>لا. قد تكون حالة صحيحة ونادرة، أو خطأ إدخال، أو اختلافاً في وحدة القياس. افحص المصدر والسياق قبل اتخاذ قرار.</p>
          </div>
        </div>
      </GuideSection>
    </GuideLayout>
  );
}
