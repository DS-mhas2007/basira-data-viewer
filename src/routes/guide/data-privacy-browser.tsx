import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/data-privacy-browser";
const TITLE = "تحليل بيانات حسّاسة دون رفعها لأي خادم";
const DESC =
  "تعرّف على تحليل البيانات داخل المتصفح دون رفع الملف، وما الذي يبقى محلياً وما قد يُرسل عند استخدام ميزات الذكاء الاصطناعي، خصوصاً مع البيانات الحساسة.";

export const Route = createFileRoute("/guide/data-privacy-browser")({
  head: () => ({
    meta: [
      { title: "تحليل البيانات دون رفع الملف: الخصوصية والمعالجة المحلية — MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "تحليل البيانات دون رفع الملف: الخصوصية والمعالجة المحلية — MIZYAi" },
      { property: "og:description", content: "تعرّف على تحليل البيانات داخل المتصفح دون رفع الملف، وما الذي يبقى محلياً وما قد يُرسل عند استخدام ميزات الذكاء الاصطناعي، خصوصاً مع البيانات الحساسة." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "تحليل البيانات دون رفع الملف: الخصوصية والمعالجة المحلية — MIZYAi" },
      { name: "twitter:description", content: "تعرّف على تحليل البيانات داخل المتصفح دون رفع الملف، وما الذي يبقى محلياً وما قد يُرسل عند استخدام ميزات الذكاء الاصطناعي، خصوصاً مع البيانات الحساسة." },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      guideBreadcrumb(TITLE, CANONICAL),
      guideArticle(TITLE, DESC, CANONICAL),
    ],
  }),
  component: Page,
});

const P = "text-sm leading-loose text-muted-foreground";

function Page() {
  return (
    <GuideLayout
      eyebrow="دليل عملي · الخصوصية"
      eyebrowIcon={<ShieldCheck className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="كثير من الملفات لا يجوز رفعها أصلاً: رواتب، سجلات مرضى، بيانات عملاء. المعالجة داخل المتصفح تحلّ المعادلة — تحليل كامل دون أن يغادر الملف جهازك."
      related={[
        { to: "/guide/arabic-csv-excel", label: "تحليل ملفات Excel و CSV بالعربية دون رفعها" },
        { to: "/guide/ask-data-in-arabic", label: "اسأل بياناتك بالعربية بإجابة موثّقة" },
      ]}
    >
      <GuideSection id="how" title="ما معنى «المعالجة داخل المتصفح»؟">
        <p className={P}>
          بدل إرسال الملف إلى خادم يحلّله ثم يعيد النتيجة، يُقرأ الملف ويُحلّل بمحرك يعمل داخل
          تبويب المتصفح على جهازك. الحسابات والتجميعات والرسوم كلها تُنفَّذ محلياً، ولا يُرسل عبر
          الشبكة سوى ما تطلبه أنت صراحة.
        </p>
      </GuideSection>

      <GuideSection id="verify" title="تحقّق بنفسك: سجل الشبكة">
        <p className={P}>
          لا تكتفِ بالوعود. في أسفل الشريط الجانبي زر «ملفك لا يُرفع — تحقّق بنفسك» يفتح سجلاً
          بكل طلب خرج من الصفحة منذ فتحتها: وجهته وحجمه، دون محتواه. ارفع ملفك ثم افتح السجل
          وقارن حجم ما خرج بحجم ملفك — لن تجد طلباً يقارب حجم ملفك، وإن استخدمت ميزات الذكاء
          الاصطناعي ظهر كل طلب منها بوضوح.
        </p>
      </GuideSection>

      <GuideSection id="ai" title="وماذا عن أسئلة الذكاء الاصطناعي؟">
        <p className={P}>
          عند طرح سؤال بالعربية يُرسل إلى مزوّد النموذج: سؤالك، وأسماء الأعمدة وأنواعها، وعيّنة
          صغيرة (نحو 8 صفوف) تساعده على فهم شكل القيم. أما في محادثة «اسأل MIZYAi» فيرى النموذج
          أيضاً نتائج الاستعلامات التي ينفّذها، وتُحفظ المحادثة في حسابك ما لم تفعّل مفتاح «لا تحفظ محادثتي». الملف الأصلي لا يُرفع،
          والحسابات تُنفَّذ محلياً. إن كانت بياناتك حساسة، فلا تستخدم ميزات الذكاء الاصطناعي
          معها، وستبقى بقية المنصة (الفحص والتنظيف والرسوم) محلية بالكامل.
        </p>
      </GuideSection>

      <GuideSection id="checklist" title="قائمة تحقق قبل استخدام أي أداة">
        <ul className="space-y-2">
          {[
            "هل يُرفع الملف إلى خادم؟ اطلب إجابة صريحة، لا عبارة «بياناتك آمنة».",
            "ما الذي يُرسل تحديداً عند استخدام ميزات الذكاء الاصطناعي؟",
            "هل تُخزَّن نسخة من الملف؟ ولكم من الوقت؟",
            "هل يمكنك العمل دون اتصال بالإنترنت؟ هذا أوضح دليل على المعالجة المحلية.",
            "هل تستطيع تصدير النتائج والاستعلامات لمراجعتها خارج الأداة؟",
          ].map((f) => (
            <li
              key={f}
              className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
            >
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2} />
              {f}
            </li>
          ))}
        </ul>
      </GuideSection>

          <GuideSection id="faq" title="أسئلة شائعة">
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-sm font-bold">هل المعالجة داخل المتصفح تعني أن كل الميزات تعمل دون إنترنت؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">ليس بالضرورة. قد تعمل قراءة الملف والحسابات المحلية بعد تحميل التطبيق، بينما تحتاج ميزات مثل الذكاء الاصطناعي أو تسجيل الدخول إلى اتصال بالإنترنت.</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-bold">هل يُرسل الملف الأصلي عند استخدام الذكاء الاصطناعي؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">بحسب وصف المنصة، لا يُرفع الملف الأصلي، لكن قد تُرسل بيانات مشتقة مثل السؤال وأسماء الأعمدة وعينة صغيرة من القيم ونتائج الاستعلامات. لذلك لا تعتبر استخدام AI معالجة محلية بالكامل.</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-bold">هل يمكنني تحليل بيانات المرضى أو العملاء؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">لا تستخدم بيانات شخصية أو صحية حساسة إلا بعد التأكد من وجود أساس قانوني وموافقة مناسبة وضوابط أمنية وسياسة معتمدة. الخيار الأكثر أماناً هو استخدام بيانات مجهولة الهوية أو اصطناعية، وتعطيل ميزات الإرسال الخارجي عند التعامل مع بيانات حساسة.</p>
              </div>
            </div>
          </GuideSection>
    </GuideLayout>
  );
}
