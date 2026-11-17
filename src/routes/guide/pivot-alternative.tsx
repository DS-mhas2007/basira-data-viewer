import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { Table2, CheckCircle2 } from "lucide-react";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/pivot-alternative";
const TITLE = "بديل الجداول المحورية (Pivot Tables) لتقارير عربية أسرع";
const DESC =
  "اكتشف متى تتجاوز Pivot Tables في Excel، وكيف تنشئ تجميعات وتقارير عربية قابلة للتكرار والتصدير من ملفات CSV وXLSX.";

export const Route = createFileRoute("/guide/pivot-alternative")({
  head: () => ({
    meta: [
      { title: "بديل Pivot Table: إنشاء تقارير عربية تلقائياً — MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "بديل Pivot Table: إنشاء تقارير عربية تلقائياً — MIZYAi" },
      { property: "og:description", content: "اكتشف متى تتجاوز Pivot Tables في Excel، وكيف تنشئ تجميعات وتقارير عربية قابلة للتكرار والتصدير من ملفات CSV وXLSX." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "بديل Pivot Table: إنشاء تقارير عربية تلقائياً — MIZYAi" },
      { name: "twitter:description", content: "اكتشف متى تتجاوز Pivot Tables في Excel، وكيف تنشئ تجميعات وتقارير عربية قابلة للتكرار والتصدير من ملفات CSV وXLSX." },
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
      eyebrow="دليل عملي · التقارير"
      eyebrowIcon={<Table2 className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="بديل Pivot Table يصبح مفيداً عندما تكرر التجميعات والتقارير نفسها مع ملفات جديدة وتحتاج إلى خطوات قابلة لإعادة الاستخدام. أما التحليل الاستكشافي السريع أو التقرير البسيط فقد يظل Excel خياراً أفضل؛ يوضح الدليل متى تختار كل مسار."
      related={[
        { to: "/guide/ask-data-in-arabic", label: "طرح أسئلة بالعربية والحصول على استعلام SQL قابل للمراجعة" },
        { to: "/guide/arabic-csv-excel", label: "استيراد ملفات CSV وExcel العربية وتجهيزها للتحليل" },
        { to: "/guide/remove-duplicates", label: "إزالة التكرارات قبل بناء التجميعات والتقارير" },
      ]}
    >
      <GuideSection id="limits" title="أين تتعثر الجداول المحورية؟">
        <ul className="space-y-2">
          {[
            "إعادة البناء اليدوي مع كل ملف جديد، وتكرار نفس الأخطاء.",
            "الأرقام العربية والعملة تُقرأ كنص فلا تُجمَع أصلاً.",
            "اتجاه RTL والخطوط العربية يفسدان تنسيق التقرير عند التصدير.",
            "لا سجل يوضح كيف وصلت للرقم، فيصعب مراجعته لاحقاً.",
            "الملفات الكبيرة تُبطئ الجهاز وتجمّد التطبيق.",
          ].map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2} />
              {f}
            </li>
          ))}
        </ul>
      </GuideSection>

      <GuideSection id="workflow" title="سير عمل بديل في أربع خطوات">
        <ol className="space-y-3">
          {[
            {
              t: "ارفع الملف مرة واحدة",
              d: "CSV أو XLSX متعدد الأوراق، مع كشف تلقائي للترميز والفاصل وأنواع الأعمدة.",
            },
            {
              t: "ابدأ بملخصات الأعمدة",
              d: "استفد من الملخصات والمؤشرات المعروضة للأعمدة الرقمية والفئوية، ثم حدّد السؤال أو التجميع الذي تحتاجه.",
            },
            {
              t: "اطلب ما ينقصك بالعربية",
              d: "أي تقاطع إضافي (مثل الإيراد حسب المدينة والشهر) يُنفَّذ كاستعلام موثّق ويُثبَّت في اللوحة.",
            },
            {
              t: "صدّر تقريراً جاهزاً",
              d: "PDF أو PPTX أو HTML مستقل. تُضبط الواجهة باتجاه RTL ويُستخدم خط Tajawal في العرض، لكن افحص الملف على جهاز المستلم لأن توفر الخطوط يختلف.",
            },
          ].map((s, i) => (
            <li key={s.t} className="flex gap-3 rounded-xl border border-border/50 bg-surface-1 p-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 font-mono text-xs font-bold text-primary">
                {i + 1}
              </span>
              <div>
                <h3 className="font-display text-sm font-bold">{s.t}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </GuideSection>

      <GuideSection id="stay" title="متى تبقى مع Excel؟">
        <p className={P}>
          إذا كان الملف صغيراً والتقرير لمرة واحدة، أو تحتاج تحريراً يدوياً للخلايا وصيغاً
          مخصصة يراجعها فريقك داخل المصنف نفسه — فالجدول المحوري أسرع. الانتقال يستحق العناء حين
          تتكرر المهمة، أو تحتاج دليلاً قابلاً للمراجعة، أو تتعامل مع بيانات حساسة يجب ألا تغادر
          جهازك.
        </p>
      </GuideSection>

          <GuideSection id="faq" title="أسئلة شائعة">
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-sm font-bold">هل الجداول المحورية أفضل من أدوات التحليل الآلي؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">ليست هناك أداة أفضل دائماً. Pivot Tables مناسبة للاستكشاف السريع والتحرير اليدوي داخل Excel، بينما يفيد سير العمل الآلي عند تكرار التقارير أو الحاجة إلى خطوات قابلة لإعادة التنفيذ والتوثيق.</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-bold">متى أستخدم Pivot Table ومتى أختار بديلاً؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">استخدم الجدول المحوري عندما يكون الملف محدوداً والمهمة لمرة واحدة. فكّر في الأتمتة عندما يتكرر تحديث المصدر، أو تتعدد التقارير، أو تحتاج إلى توثيق الاستعلامات ومراجعة النتائج.</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-bold">هل يمكن تصدير التقرير بالعربية؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">تُضبط مخرجات التقرير باتجاه RTL ويُستخدم خط Tajawal في العرض، لكن PowerPoint وHTML قد يعتمدان على الخطوط المتاحة في جهاز العرض. افتح الملف الناتج وتحقق من اتصال الحروف قبل مشاركته.</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-bold">هل تصدير CSV وExcel يشمل كل الصفوف؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">يصدّر التطبيق أول 200,000 صف كحد وقائي. تقرير HTML يعرض حتى 200 صف في جدول كل استنتاج، بينما يعرض ملخص PowerPoint حتى 5 استنتاجات وصفحات التفاصيل حتى 10 عند تفعيلها، مع أول 12 نقطة في كل مخطط؛ تظهر تنبيهات عند وجود اختصار.</p>
              </div>
            </div>
          </GuideSection>
    </GuideLayout>
  );
}
