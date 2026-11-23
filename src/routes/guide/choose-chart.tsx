import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { ChartColumn, CheckCircle2 } from "@/components/icons";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/choose-chart";
export const TITLE = "اختيار الرسم البياني المناسب: أعمدة أم خط أم دائري؟";
export const DESC =
  "كيف تختار الرسم البياني المناسب للبيانات؟ قارن بين الأعمدة والخطوط والمساحة والدائري والمخطط المركب، وتجنب الرسوم المضللة.";

export const Route = createFileRoute("/guide/choose-chart")({
  head: () => ({
    meta: [
      { title: "اختيار الرسم البياني المناسب للبيانات — MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "كيف تختار الرسم البياني المناسب؟ — MIZYAi" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "اختيار الرسم البياني المناسب — MIZYAi" },
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
      eyebrow="دليل عملي · التصور البصري"
      eyebrowIcon={<ChartColumn className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="ابدأ بالسؤال لا بشكل الرسم. هل تريد مقارنة فئات، أو تتبع تغير عبر الزمن، أو إظهار تركيب الكل؟ اختيار الرسم الصحيح يجعل النمط واضحاً، بينما قد يخفي الاختيار الخاطئ الفروق أو يضخمها."
      related={[
        { to: "/guide/descriptive-statistics", label: "فهم المتوسط والوسيط والتوزيع قبل الرسم" },
        { to: "/guide/pivot-alternative", label: "إنشاء تجميعات وتقارير من ملفك" },
        { to: "/guide/data-dictionary", label: "تحديد نوع كل عمود ودوره التحليلي" },
        { to: "/guide/chart-interpretation", label: "كيف تقرأ الرسم البياني وتفسر نتائجه" },
        { to: "/guide/time-series-analysis", label: "تحليل الاتجاهات والتغيرات عبر الزمن" },
      ]}
    >
      <GuideSection id="types" title="أي رسم يناسب سؤالك؟">
        <div className="space-y-3">
          {[
            { t: "الأعمدة (Bar)", d: "قارن قيماً بين فئات مثل المبيعات حسب المنطقة. رتّب الفئات لتسهيل قراءة الأعلى والأدنى." },
            { t: "الخط (Line)", d: "اعرض التغير عبر الزمن عندما يكون ترتيب النقاط الزمنية مهماً، مثل الإيراد الشهري." },
            { t: "المساحة (Area)", d: "أظهر تطور الحجم عبر الزمن، لكن انتبه إلى التراكم والشفافية إذا قارنت أكثر من سلسلة." },
            { t: "الدائري (Pie)", d: "اعرض أجزاء من كل واحد عندما تكون الفئات قليلة ومجموعها ذا معنى. تجنبه مع فئات كثيرة أو قيم متقاربة." },
            { t: "المركب (Combo)", d: "اجمع نوعين من المقاييس عندما يخدمان سؤالاً واحداً، مع توضيح الوحدات والمحاور وعدم تضليل القارئ." },
          ].map((item) => (
            <div key={item.t} className="rounded-xl border border-border/50 bg-surface-1 p-4">
              <h3 className="font-display text-sm font-bold">{item.t}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.d}</p>
            </div>
          ))}
        </div>
      </GuideSection>

      <GuideSection id="aggregate" title="اختر طريقة التجميع بعناية">
        <p className={P}>
          قبل الرسم حدد ما الذي يمثله المحور الرأسي: مجموع (SUM)، متوسط (AVG)، عدد (COUNT)، أعلى
          قيمة (MAX)، أم أدنى قيمة (MIN). مجموع الرواتب مثلاً يجيب عن سؤال مختلف عن متوسط الراتب،
          وعدّ السجلات يختلف عن عدّ الأشخاص الفريدين إذا تكرر الشخص في أكثر من صف.
        </p>
        <p className={P}>
          إذا كان المحور الزمني تاريخاً، اختر مستوى التجميع المناسب: يومي أو أسبوعي أو شهري أو سنوي.
          لا تقارن أشهرًا غير مكتملة بفترات كاملة دون توضيح ذلك.
        </p>
      </GuideSection>

      <GuideSection id="mistakes" title="أخطاء شائعة تجعل الرسم مضللاً">
        <ul className="space-y-2">
          {[
            "استخدام الرسم الدائري لعشرات الفئات التي يصعب تمييزها.",
            "قطع محور الأعمدة بطريقة تضخم فرقاً صغيراً دون توضيح.",
            "جمع قيم بوحدات مختلفة على محور واحد.",
            "استخدام التاريخ كنص غير مرتب زمنياً.",
            "إظهار عدد السجلات على أنه عدد الأشخاص دون إزالة التكرار وفق مفتاح مناسب.",
            "إضافة ألوان وتأثيرات كثيرة لا تخدم الرسالة.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />{item}
            </li>
          ))}
        </ul>
        <p className={P}>
          يتيح استوديو الرسوم في MIZYAi إنشاء أعمدة وخطوط ومساحات ورسوم دائرية ومركبة، مع خيارات
          للتجميع والترتيب والتجميع الزمني. اختر المحاور والعملية الحسابية بعد التأكد من قاموس
          البيانات ونوع الأعمدة.
        </p>
      </GuideSection>

      <GuideSection id="faq" title="أسئلة شائعة">
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-sm font-bold">ما أفضل رسم لمقارنة المبيعات بين المدن؟</h3>
            <p className={P}>غالباً رسم الأعمدة، مع ترتيب المدن حسب القيمة وتحديد ما إذا كنت تعرض مجموع المبيعات أم متوسطها.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">ما أفضل رسم لعرض المبيعات شهرياً؟</h3>
            <p className={P}>رسم الخط غالباً مناسب لإظهار الاتجاه عبر الزمن، بشرط أن تكون التواريخ صحيحة ومرتبة وأن تكون الفترات قابلة للمقارنة.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل الرسم الدائري دائماً أسهل؟</h3>
            <p className={P}>لا. إذا زادت الفئات أو تقاربت النسب، يكون الرسم الشريطي أسهل للمقارنة الدقيقة.</p>
          </div>
        </div>
      </GuideSection>
    </GuideLayout>
  );
}
