import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/data-privacy-browser";
const TITLE = "تحليل بيانات حسّاسة دون رفعها لأي خادم";
const DESC =
  "كيف تحلّل ملفات تحتوي بيانات موظفين أو عملاء أو مرضى داخل المتصفح فقط، وما الفرق بين المعالجة المحلية والسحابية، وما الذي يجب سؤاله لأي أداة تحليل قبل استخدامها.";

export const Route = createFileRoute("/guide/data-privacy-browser")({
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

      <GuideSection id="ai" title="وماذا عن أسئلة الذكاء الاصطناعي؟">
        <p className={P}>
          عند طرح سؤال بالعربية، ما يحتاجه النموذج هو وصف الأعمدة وأنواعها لصياغة استعلام — لا
          محتوى الصفوف. الاستعلام يعود ليُنفَّذ محلياً على بياناتك، فتحصل على الرقم مع الاستعلام
          الذي أنتجه. هذا الفصل بين «فهم السؤال» و«تنفيذ الحساب» هو جوهر التحليل الآمن.
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
    </GuideLayout>
  );
}
