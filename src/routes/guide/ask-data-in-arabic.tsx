import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare, CheckCircle2 } from "lucide-react";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/ask-data-in-arabic";
const TITLE = "اسأل بياناتك بالعربية: من السؤال إلى استعلام SQL موثّق";
const DESC =
  "كيف يحوّل الذكاء الاصطناعي سؤالك العربي إلى استعلام SQL على ملفك، ولماذا بطاقة الدليل التي تعرض الاستعلام وعدد الصفوف هي الفرق بين تحليل موثوق وأرقام مخترعة.";

export const Route = createFileRoute("/guide/ask-data-in-arabic")({
  head: () => ({
    meta: [
      { title: `${TITLE} — بصيرة` },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          inLanguage: "ar",
          url: CANONICAL,
          description: DESC,
        }),
      },
    ],
  }),
  component: Page,
});

const P = "text-sm leading-loose text-muted-foreground";

function Page() {
  return (
    <GuideLayout
      eyebrow="دليل عملي · الأسئلة الذكية"
      eyebrowIcon={<MessagesSquare className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="أدوات الدردشة العامة قد تعطيك رقماً يبدو مقنعاً بلا أي مصدر. الطريقة الآمنة أن يتحوّل سؤالك العربي إلى استعلام حقيقي يُنفَّذ على ملفك، ثم يُعرض عليك الاستعلام والنتيجة معاً."
      related={[
        { to: "/guide/data-quality-score", label: "درجة جودة البيانات: كيف تقيس نظافة ملفك" },
        { to: "/guide/pivot-alternative", label: "بديل الجداول المحورية لتقارير عربية أسرع" },
      ]}
    >
      <GuideSection id="pipeline" title="ماذا يحدث بعد أن تكتب سؤالك؟">
        <ol className="space-y-3">
          {[
            {
              t: "قراءة بنية الملف فقط",
              d: "يُرسل للنموذج وصف الأعمدة وأنواعها — لا الصفوف. بياناتك الفعلية تبقى في متصفحك.",
            },
            {
              t: "توليد استعلام SQL",
              d: "يترجم السؤال «ما متوسط المبيعات حسب المنطقة؟» إلى استعلام تجميع على العمود الصحيح.",
            },
            {
              t: "فحص أمني للاستعلام",
              d: "يُرفض أي استعلام يعدّل أو يحذف؛ القراءة فقط مسموحة.",
            },
            {
              t: "تنفيذ محلي وعرض الدليل",
              d: "يُنفَّذ الاستعلام داخل المتصفح وتظهر النتيجة مع نص الاستعلام وعدد الصفوف المطابقة.",
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

      <GuideSection id="questions" title="أسئلة تعطي نتائج جيدة">
        <ul className="space-y-2">
          {[
            "«ما متوسط قيمة الطلب حسب المدينة في آخر ثلاثة أشهر؟»",
            "«كم عدد المستجيبين الذين اختاروا (راضٍ جداً) مقسّمين حسب الفئة العمرية؟»",
            "«أعلى عشرة منتجات من حيث الإيراد، مع نسبتها من الإجمالي.»",
            "«هل هناك صفوف مكررة على رقم الهوية؟ اعرض عددها.»",
          ].map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2} />
              {f}
            </li>
          ))}
        </ul>
        <p className={P}>
          كلما ذكرت اسم العمود والفترة الزمنية ووحدة القياس، قلّ التخمين. وإذا كانت أسماء
          الأعمدة إنجليزية مختصرة، عرّف لها أسماء عربية مستعارة مرة واحدة لتُستخدم في كل سؤال
          لاحق.
        </p>
      </GuideSection>

      <GuideSection id="verify" title="كيف تتحقق من أي إجابة">
        <p className={P}>
          اقرأ الاستعلام المرفق: هل جمع العمود الصحيح؟ هل استبعد الصفوف الفارغة؟ هل الفترة
          الزمنية هي المقصودة؟ ثم صدّر الاستعلام بصيغة SQL أو Python وأعد تشغيله بنفسك. التحليل
          الذي لا يمكن إعادة إنتاجه ليس تحليلاً.
        </p>
      </GuideSection>
    </GuideLayout>
  );
}
