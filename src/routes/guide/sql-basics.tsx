import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { Database, CheckCircle2 } from "@/components/icons";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/sql-basics";
export const TITLE = "أساسيات SQL لتحليل البيانات: SELECT وWHERE وGROUP BY";
export const DESC =
  "ابدأ بتحليل البيانات باستخدام SQL: تعلّم SELECT وWHERE وGROUP BY وORDER BY وCOUNT وAVG، وكيف تراجع الاستعلام قبل الوثوق بالنتيجة.";

export const Route = createFileRoute("/guide/sql-basics")({
  head: () => ({
    meta: [
      { title: "أساسيات SQL لتحليل البيانات | MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "أساسيات SQL لتحليل البيانات | MIZYAi" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "أساسيات SQL لتحليل البيانات | MIZYAi" },
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
      eyebrow="دليل عملي · SQL وتحليل البيانات"
      eyebrowIcon={<Database className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="SQL لغة للاستعلام عن البيانات المخزنة في الجداول. لا تحتاج إلى حفظ عشرات الأوامر لتبدأ؛ فهم SELECT وWHERE وGROUP BY يكفي لبناء كثير من الأسئلة التحليلية البسيطة، بشرط معرفة الأعمدة ومعنى كل صف."
      related={[
        { to: "/guide/ask-data-in-arabic", label: "تحويل سؤال عربي إلى SQL قابل للمراجعة" },
        { to: "/guide/data-dictionary", label: "فهم أسماء الأعمدة وأنواعها" },
        { to: "/guide/pivot-alternative", label: "مقارنة SQL بالتجميعات والجداول المحورية" },
      ]}
    >
      <GuideSection id="core" title="الأوامر الأساسية التي تحتاجها">
        <pre dir="ltr" className="overflow-x-auto rounded-xl border border-border/50 bg-surface-1 p-4 text-xs leading-relaxed"><code>SELECT city, AVG(order_total) AS avg_order
FROM orders
WHERE order_status = 'completed'
GROUP BY city
ORDER BY avg_order DESC;</code></pre>
        <p className={P}>SELECT يحدد الأعمدة أو المقاييس التي تريد عرضها. FROM يحدد الجدول. WHERE يرشّح الصفوف قبل التجميع. GROUP BY يجمع الصفوف حسب فئة، وORDER BY يرتب النتائج.</p>
        <p className={P}>في المثال نحسب متوسط قيمة الطلبات المكتملة لكل مدينة، ثم نرتب المدن من الأعلى إلى الأدنى. افهم وحدة order_total أولاً: هل هي عملة واحدة؟ وهل الطلب الواحد يمثل صفاً واحداً؟</p>
      </GuideSection>

      <GuideSection id="aggregates" title="دوال التجميع الشائعة">
        <ul className="space-y-2">{["COUNT(*) لعدّ الصفوف، وليس بالضرورة الأشخاص الفريدين.","COUNT(DISTINCT customer_id) لعدّ العملاء الفريدين عندما يكون هذا هو المطلوب.","SUM(amount) لحساب الإجمالي، وAVG(amount) لحساب المتوسط.","MIN وMAX لمعرفة أصغر وأكبر قيمة ضمن المجموعة."].map((item) => (<li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />{item}</li>))}</ul>
        <p className={P}>انتبه إلى NULL: لا يساوي الصفر، وكثير من دوال التجميع تتجاهله عند حساب المتوسط أو المجموع. افحص عدد القيم غير الفارغة حتى تفهم المقام المستخدم.</p>
      </GuideSection>

      <GuideSection id="review" title="قائمة مراجعة قبل اعتماد الاستعلام">
        <ul className="space-y-2">{["هل اسم الجدول والعمود صحيحان؟","هل شروط WHERE تشمل الفترة والفئات المطلوبة فقط؟","هل GROUP BY يطابق مستوى التحليل؟","هل COUNT يعدّ السجلات أم الكيانات الفريدة؟","هل NULL والقيم المكررة تغيّر النتيجة؟","هل تستطيع إعادة حساب رقم واحد يدوياً للتحقق؟"].map((item) => (<li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />{item}</li>))}</ul>
      </GuideSection>

      <GuideSection id="mizyai" title="كيف تستخدم SQL مع MIZYAi؟">
        <p className={P}>يمكنك كتابة سؤال تحليلي بالعربية، ثم مراجعة استعلام SQL المقترح والنتيجة المنفذة محلياً داخل المتصفح. اقرأ الاستعلام نفسه، وتأكد من الأعمدة وشروط التصفية والتجميع وعدد الصفوف المطابقة. لا تعتمد على الشرح النصي وحده.</p>
        <p className={P}>ميزة السؤال الذكي ترسل إلى مزوّد النموذج نص السؤال ووصف الأعمدة وعينة محدودة من البيانات بحسب مسار الاستخدام. لا تستخدمها مع بيانات شخصية أو سرية قبل مراجعة دليل الخصوصية.</p>
      </GuideSection>

      <GuideSection id="faq" title="أسئلة شائعة">
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-sm font-bold">ما الفرق بين WHERE وGROUP BY؟</h3>
            <p className={P}>WHERE يختار الصفوف التي تدخل التحليل، بينما GROUP BY يقسم الصفوف المختارة إلى مجموعات لحساب مقاييس لكل مجموعة.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل COUNT(*) يساوي عدد العملاء؟</h3>
            <p className={P}>ليس بالضرورة؛ إنه يعدّ الصفوف. إذا تكرر العميل في عدة صفوف، استخدم عدّاً مميزاً على معرّف العميل عندما يكون ذلك هو السؤال.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل NULL يساوي صفر؟</h3>
            <p className={P}>لا. NULL يعني أن القيمة غير متاحة أو غير معروفة في هذا السياق، أما الصفر فهو قيمة رقمية فعلية.</p>
          </div>
        </div>
      </GuideSection>

    </GuideLayout>
  );
}
