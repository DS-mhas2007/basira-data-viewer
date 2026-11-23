import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2 } from "@/components/icons";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/date-format";
export const TITLE = "تنسيق التاريخ في Excel وCSV: إصلاح DD/MM وMM/DD";
export const DESC =
  "تعلّم توحيد صيغ التاريخ في Excel وCSV، والتمييز بين يوم/شهر وسنة وشهر/يوم، ومعالجة التواريخ الغامضة قبل التحليل الزمني.";

export const Route = createFileRoute("/guide/date-format")({
  head: () => ({
    meta: [
      { title: "تنسيق التاريخ في Excel وCSV وإصلاح الصيغ — MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "إصلاح تنسيق التاريخ في Excel وCSV — MIZYAi" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "تنسيق التاريخ في Excel وCSV — MIZYAi" },
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
      eyebrow="دليل عملي · التواريخ"
      eyebrowIcon={<CalendarDays className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="التاريخ الذي يبدو واضحاً لشخص قد يكون غامضاً للبرنامج. عندما يختلط ترتيب اليوم والشهر، قد تُقرأ 03/04/2025 على أنها 3 أبريل أو 4 مارس. لا تبدأ التحليل الزمني قبل حسم هذا الالتباس."
      related={[
        { to: "/guide/data-types", label: "تحويل أنواع البيانات والأرقام المخزنة كنص" },
        { to: "/guide/arabic-csv-excel", label: "استيراد ملف CSV عربي وفحصه" },
        { to: "/guide/descriptive-statistics", label: "قراءة التوزيعات والاتجاهات في البيانات" },
        { to: "/guide/time-series-analysis", label: "تجهيز التواريخ لتحليل السلاسل الزمنية" },
      ]}
    >
      <GuideSection id="formats" title="لماذا تختلف صيغ التاريخ؟">
        <p className={P}>
          قد يأتي التاريخ بصيغة ISO مثل 2025-04-03، أو يوم/شهر/سنة مثل 03/04/2025، أو
          شهر/يوم/سنة، أو مع وقت. كما قد يُخزّن في CSV كنص، بينما يحوّله Excel عند الفتح وفق
          إعدادات المنطقة. لذلك لا تعتمد على شكل الخلية وحده.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full text-right text-xs">
            <thead className="bg-surface-1 text-muted-foreground">
              <tr><th className="p-3">النص</th><th className="p-3">المعنى المحتمل</th></tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr><td className="p-3 font-mono">2025-04-03</td><td className="p-3">3 أبريل 2025 بصيغة ISO</td></tr>
              <tr><td className="p-3 font-mono">13/04/2025</td><td className="p-3">13 أبريل عند ترتيب يوم/شهر</td></tr>
              <tr><td className="p-3 font-mono">03/04/2025</td><td className="p-3">غامض دون معرفة ترتيب المصدر</td></tr>
            </tbody>
          </table>
        </div>
      </GuideSection>

      <GuideSection id="resolve" title="كيف تحسم ترتيب اليوم والشهر؟">
        <ul className="space-y-2">
          {[
            "ارجع إلى نظام المصدر أو وثائق التصدير لمعرفة ترتيب التاريخ.",
            "ابحث عن قيمة مثل 19/04/2025؛ وجود يوم أكبر من 12 يرجّح ترتيب يوم/شهر.",
            "لا تستنتج ترتيب العمود من صف واحد إذا كانت كل الأيام بين 1 و12.",
            "إذا احتوى العمود صيغتين مختلفتين، افصل السجلات أو صحح المصدر قبل التوحيد.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />{item}
            </li>
          ))}
        </ul>
      </GuideSection>

      <GuideSection id="standardize" title="وحّد التاريخ إلى صيغة قابلة للفرز">
        <p className={P}>
          بعد تأكيد الترتيب، حوّل القيم المقروءة إلى صيغة معيارية مثل YYYY-MM-DD. افصل الوقت في
          عمود مستقل إذا كان مهماً للتحليل، واحتفظ بالقيمة الأصلية عند الشك. القيم التي لا يمكن
          تفسيرها يجب أن تبقى ظاهرة للمراجعة بدلاً من تحويلها إلى تاريخ خاطئ.
        </p>
        <p className={P}>
          في MIZYAi يمكن فحص الأعمدة التي تبدو كتاريخ، اختيار ترتيب يوم/شهر أو شهر/يوم عند وجود
          غموض، ثم معاينة التغييرات قبل توحيد الصيغ المقروءة. القيم التي لا تطابق الترتيب المختار
          تبقى كما هي ولا تُحوّل بصمت.
        </p>
      </GuideSection>

      <GuideSection id="faq" title="أسئلة شائعة">
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-sm font-bold">ما أفضل صيغة لتبادل التواريخ؟</h3>
            <p className={P}>صيغة ISO 8601 مثل 2025-04-03 تقلل الالتباس في التاريخ، ومع الوقت استخدم صيغة موحدة تتضمن المنطقة الزمنية عند الحاجة.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل Excel يغيّر التاريخ عند فتح CSV؟</h3>
            <p className={P}>قد يفسر النص تلقائياً وفق الإعدادات الإقليمية، لذلك استورد الملف وحدد نوع العمود وترتيبه بدلاً من النقر المزدوج عندما تكون الصيغة ملتبسة.</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">هل أستطيع جمع تواريخ مختلفة في عمود واحد؟</h3>
            <p className={P}>يمكن توحيد الصيغ إذا عُرف معنى كل قيمة. أما اختلاف التقويم أو المنطقة الزمنية أو ترتيب اليوم والشهر فيحتاج قراراً موثقاً قبل الدمج.</p>
          </div>
        </div>
      </GuideSection>
    </GuideLayout>
  );
}
