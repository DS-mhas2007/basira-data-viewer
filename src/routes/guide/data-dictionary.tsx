import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, CheckCircle2 } from "@/components/icons";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/data-dictionary";
export const TITLE = "قاموس البيانات: كيف تفهم أعمدة ملف Excel وCSV؟";
export const DESC =
  "ما هو قاموس البيانات؟ تعرّف على أنواع الأعمدة وأدوارها ونسبة اكتمالها والقيم المميزة، وكيف تبني وصفاً واضحاً للملف قبل التحليل.";

export const Route = createFileRoute("/guide/data-dictionary")({
  head: () => ({
    meta: [
      { title: "قاموس البيانات: شرح أعمدة Excel وCSV — MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "قاموس البيانات لملفات Excel وCSV — MIZYAi" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "قاموس البيانات — MIZYAi" },
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
      eyebrow="دليل عملي · فهم البيانات"
      eyebrowIcon={<BookOpen className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="قبل أن تسأل ملفك أو تنشئ رسماً بيانياً، تحتاج إلى فهم ما يمثله كل عمود. قاموس البيانات يحوّل أسماء الأعمدة وأنواعها إلى وصف قابل للقراءة والمراجعة، ويقلل أخطاء اختيار المقياس أو التجميع."
      related={[
        { to: "/guide/data-types", label: "معرفة الأرقام المخزنة كنص وتصحيح نوعها" },
        { to: "/guide/ask-data-in-arabic", label: "صياغة سؤال تحليلي دقيق لبياناتك" },
        { to: "/guide/data-quality-score", label: "فحص جودة الأعمدة والصفوف" },
      ]}
    >
      <GuideSection id="definition" title="ما الذي يحتويه قاموس البيانات؟">
        <p className={P}>
          القاموس وصف منظم لكل متغير في مجموعة البيانات. قد يتضمن اسم العمود، ونوعه التقني،
          ودوره المتوقع، ونسبة القيم المكتملة، وعدد القيم المختلفة، وأمثلة من القيم، وملاحظات
          تساعد على تفسيره. وهو لا يستبدل وثائق المصدر أو تعريفات المجال.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full text-right text-xs">
            <thead className="bg-surface-1 text-muted-foreground">
              <tr><th className="p-3">العمود</th><th className="p-3">الدور المحتمل</th><th className="p-3">طريقة التعامل</th></tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr><td className="p-3 font-mono">customer_id</td><td className="p-3">معرّف</td><td className="p-3">للربط، لا للجمع</td></tr>
              <tr><td className="p-3 font-mono">order_date</td><td className="p-3">تاريخ</td><td className="p-3">لتحليل الاتجاه الزمني</td></tr>
              <tr><td className="p-3 font-mono">revenue</td><td className="p-3">مبلغ</td><td className="p-3">للجمع أو المتوسط</td></tr>
              <tr><td className="p-3 font-mono">region</td><td className="p-3">فئة</td><td className="p-3">للتجميع والمقارنة</td></tr>
            </tbody>
          </table>
        </div>
      </GuideSection>

      <GuideSection id="why" title="لماذا يسبق القاموس التحليل؟">
        <ul className="space-y-2">
          {[
            "يمنع جمع المعرّفات أو حساب متوسط لأرقام لا تمثل كمية.",
            "يكشف الأعمدة التي تحتوي قيماً مفقودة أو أنواعاً غير متناسقة.",
            "يساعد على تمييز الفئات المناسبة للتجميع عن النصوص الحرة عالية التنوع.",
            "يوفر تعريفاً مشتركاً للفريق ويجعل التحليل قابلاً للتسليم والمراجعة.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />{item}
            </li>
          ))}
        </ul>
      </GuideSection>

      <GuideSection id="build" title="خطوات بناء قاموس مفيد">
        <ol className="space-y-2">
          {[
            "ابدأ بأسماء الأعمدة وأنواعها كما وصلت من المصدر.",
            "اكتب تعريفاً بشرياً لكل عمود ووحدة القياس ومصدره إن عُرف.",
            "حدد الدور: معرّف، تاريخ، مبلغ، رقم، فئة، أو نص حر.",
            "أضف نسبة الاكتمال وعدد القيم المختلفة وعينة ممثلة.",
            "وثّق القيم المسموحة، وقواعد الترميز، وما تعنيه القيم الفارغة.",
            "راجع القاموس مع صاحب البيانات قبل استخدامه في قرار مهم.",
          ].map((item, i) => (
            <li key={item} className="flex gap-3 text-xs leading-relaxed text-muted-foreground">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono font-bold text-primary">{i + 1}</span>{item}
            </li>
          ))}
        </ol>
        <p className={P}>
          يوفر MIZYAi قاموساً آلياً يصف نوع العمود ودوره ونسبة اكتماله وعدد قيمه المميزة وأمثلة
          وملاحظات جودة، ويمكن تصديره بصيغ CSV وMarkdown. راجع التعريفات الآلية وعدّلها وفق معرفة
          المجال؛ فالاسم وحده لا يكشف دائماً المعنى الحقيقي للمتغير.
        </p>
      </GuideSection>

      <GuideSection id="faq" title="أسئلة شائعة">
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-sm font-bold">هل قاموس البيانات هو نفسه ملف البيانات؟</h3>
            <p className={P}>لا. ملف البيانات يحتوي السجلات، أما القاموس فيشرح بنية الأعمدة ومعانيها وأنواعها وقواعد تفسيرها.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل يستطيع البرنامج معرفة معنى كل عمود تلقائياً؟</h3>
            <p className={P}>يمكنه اقتراح دور اعتماداً على الاسم والنوع وتوزيع القيم، لكنه لا يعرف تعريف المجال أو وحدة القياس بدقة دون توثيق من صاحب البيانات.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">متى أشارك القاموس مع الفريق؟</h3>
            <p className={P}>شاركه قبل بدء التحليل، وحدّثه عند تغيير تعريف عمود أو طريقة جمعه أو وحدته حتى تبقى النتائج متسقة.</p>
          </div>
        </div>
      </GuideSection>
    </GuideLayout>
  );
}
