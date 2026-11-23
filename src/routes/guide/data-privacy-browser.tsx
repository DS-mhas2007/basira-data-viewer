import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, CheckCircle2 } from "@/components/icons";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";
import { AnalyticsPrivacyControls } from "@/components/AnalyticsPrivacyControls";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/data-privacy-browser";
export const TITLE = "تحليل البيانات الحساسة داخل المتصفح: حدود الخصوصية والإرسال";
export const DESC =
  "افهم ما الذي يُعالج محلياً عند تحليل الملفات داخل المتصفح، وما البيانات التي قد تُرسل إلى مزوّد الذكاء الاصطناعي، وما تحليلات الاستخدام الاختيارية التي يسجلها MIZYAi.";

export const Route = createFileRoute("/guide/data-privacy-browser")({
  head: () => ({
    meta: [
      { title: "خصوصية البيانات الحساسة في أدوات التحليل داخل المتصفح — MIZYAi" },
      { name: "description", content: DESC },
      {
        property: "og:title",
        content: "خصوصية البيانات الحساسة في أدوات التحليل داخل المتصفح — MIZYAi",
      },
      {
        property: "og:description",
        content:
          "افهم ما الذي يُعالج محلياً عند تحليل الملفات داخل المتصفح، وما البيانات التي قد تُرسل إلى مزوّد الذكاء الاصطناعي، وكيف تقلّل مخاطر التعامل مع البيانات الحساسة.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "خصوصية البيانات الحساسة في أدوات التحليل داخل المتصفح — MIZYAi",
      },
      {
        name: "twitter:description",
        content:
          "افهم ما الذي يُعالج محلياً عند تحليل الملفات داخل المتصفح، وما البيانات التي قد تُرسل إلى مزوّد الذكاء الاصطناعي، وكيف تقلّل مخاطر التعامل مع البيانات الحساسة.",
      },
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
      eyebrow="دليل عملي · الخصوصية"
      eyebrowIcon={<ShieldCheck className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="قد تُعالج قراءة الملف والتنظيف والحسابات الأساسية داخل المتصفح دون رفع الملف الأصلي. لكن هذا لا يعني أن كل البيانات تبقى على جهازك: ميزات الذكاء الاصطناعي قد ترسل بيانات مشتقة إلى مزوّد النموذج، كما أن تحليلات استخدام الموقع اختيارية وتخضع لاختيارك."
      related={[
        {
          to: "/guide/arabic-csv-excel",
          label: "كيف تعمل قراءة ملفات CSV وExcel والتحليلات الأساسية محلياً",
        },
        {
          to: "/guide/ask-data-in-arabic",
          label: "ما الذي يحدث لبياناتك عند إرسال سؤال إلى الذكاء الاصطناعي",
        },
        { to: "/guide/fix-arabic-encoding", label: "إصلاح ترميز CSV قبل مشاركة الملف أو تحليله" },
      ]}
    >
      <GuideSection id="how" title="ما معنى «المعالجة داخل المتصفح»؟">
        <p className={P}>
          في مسار التحليل الأساسي، يُقرأ الملف ويُعالج داخل تبويب المتصفح على جهازك؛ لذلك لا يحتاج
          الملف الأصلي إلى الرفع كي تعمل عمليات الفحص والتنظيف والحسابات والرسوم المحلية. هذا الوصف
          لا يشمل كل الميزات: عند استخدام الذكاء الاصطناعي قد تُرسل بيانات مشتقة إلى مزوّد النموذج،
          كما هو موضح أدناه.
        </p>
      </GuideSection>

      <GuideSection id="verify" title="تحقّق بنفسك: سجل الشبكة">
        <p className={P}>
          يوفّر زر «سجل الخصوصية» عرضاً مساعداً لطلبات fetch وXMLHttpRequest وsendBeacon التي تمر
          عبر الصفحة، مع الوجهة وحجم جسم الطلب دون محتواه. قارن أحجام الطلبات المرصودة بحجم الملف،
          لكن لا تعتبر غياب طلب كبير دليلاً قاطعاً على عدم الإرسال: السجل لا يغطي كل قنوات الشبكة
          التي قد يديرها المتصفح، ولا يرصد الاتصالات الصادرة من خادم MIZYAi إلى مزوّد النموذج؛ وقد
          تختلف طريقة الاتصال بين الميزات.
        </p>
      </GuideSection>

      <GuideSection id="analytics" title="تحليلات استخدام الموقع الاختيارية">
        <p className={P}>
          لا تبدأ تحليلات الزيارات قبل موافقتك. الغرض منها فهم استخدام الصفحات والميزات وتحسين
          MIZYAi. عند السماح، نسجل وقت الزيارة ومسار الصفحة ونطاق الإحالة ونوع الجهاز والمتصفح
          ومعلومات موقع تقريبية من مزود الاستضافة، مع معرّف عشوائي للزائر والجلسة. إذا كنت مسجلاً
          للدخول قد ترتبط الزيارة بحسابك. لا نخزّن عنوان IP أو ملفاتك، ونستثني لوحة الإدارة وصفحات
          المصادقة وواجهات API. تُحذف سجلات الزيارة الأقدم من 180 يوماً عند تنفيذ التنظيف الدوري.
          إشارتا DNT وGPC في متصفحك توقفان التتبع، ويمكنك تغيير اختيارك هنا في أي وقت.
        </p>
        <div className="mt-4">
          <AnalyticsPrivacyControls />
        </div>
      </GuideSection>

      <GuideSection id="ai" title="وماذا عن أسئلة الذكاء الاصطناعي؟">
        <p className={P}>
          عند طرح سؤال بالعربية قد يُرسل السؤال وأسماء الأعمدة وأنواعها وعينة محدودة من الصفوف إلى
          الخادم ثم مزوّد النموذج. وقد تُرسل نتائج الاستعلامات في مسارات المحادثة أو توليد الملخصات؛
          وتقتصر معاينة نتيجة أداة SQL في المحادثة على 30 صفاً. في محادثة «اسأل MIZYAi»، خيار «لا
          تحفظ محادثتي» يوقف تخزين الرسائل في حسابك فقط، ولا يمنع إرسال السؤال ونتائج الأدوات
          اللازمة إلى مزوّد النموذج. تُنفّذ حسابات SQL على البيانات داخل المتصفح، لكن ذلك لا يعني أن
          كل الاتصالات أو الميزات محلية. لا تستخدم بيانات شخصية أو صحية حساسة مع ميزات الذكاء
          الاصطناعي؛ واستخدم بيانات مجهولة الهوية أو اصطناعية عند الحاجة إلى التجربة.
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
            <h3 className="font-display text-sm font-bold">
              هل المعالجة داخل المتصفح تعني أن كل الميزات تعمل دون إنترنت؟
            </h3>
            <p className="mt-1 text-sm leading-loose text-muted-foreground">
              ليس بالضرورة. قد تعمل قراءة الملف والحسابات المحلية بعد تحميل التطبيق، بينما تحتاج
              ميزات مثل الذكاء الاصطناعي أو تسجيل الدخول إلى اتصال بالإنترنت.
            </p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">
              هل يُرسل الملف الأصلي عند استخدام الذكاء الاصطناعي؟
            </h3>
            <p className="mt-1 text-sm leading-loose text-muted-foreground">
              تُرسل بيانات مشتقة مثل السؤال وبنية الأعمدة وعينة محدودة من القيم إلى الخادم ومزوّد
              النموذج بحسب الميزة المستخدمة. وتُنفّذ الاستعلامات على البيانات داخل المتصفح. لا يكفي
              سجل الطلبات وحده لإثبات غياب كل أشكال الإرسال؛ راجع مسار كل ميزة ولا تستخدم بيانات
              حساسة دون ضوابط معتمدة.
            </p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">
              هل يمكنني تحليل بيانات المرضى أو العملاء؟
            </h3>
            <p className="mt-1 text-sm leading-loose text-muted-foreground">
              لا تستخدم بيانات شخصية أو صحية حساسة إلا بعد التأكد من وجود أساس قانوني وموافقة مناسبة
              وضوابط أمنية وسياسة معتمدة. الخيار الأكثر أماناً هو استخدام بيانات مجهولة الهوية أو
              اصطناعية، وتعطيل ميزات الإرسال الخارجي عند التعامل مع بيانات حساسة.
            </p>
          </div>
        </div>
      </GuideSection>
    </GuideLayout>
  );
}
