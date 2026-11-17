import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { Gauge, CheckCircle2 } from "lucide-react";
import { GuideLayout, GuideSection } from "@/components/GuideLayout";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/data-quality-score";
const TITLE = "درجة جودة البيانات: كيف تقيس نظافة ملفك من 100";
const DESC =
  "تعلّم قياس جودة البيانات عبر الاكتمال والتفرّد والاتساق والقيم الشاذة. افهم درجة الجودة وحدّد ما يجب تنظيفه قبل التحليل واتخاذ القرار.";

export const Route = createFileRoute("/guide/data-quality-score")({
  head: () => ({
    meta: [
      { title: "جودة البيانات: قياس النواقص والتكرار والقيم الشاذة — MIZYAi" },
      { name: "description", content: DESC },
      { property: "og:title", content: "جودة البيانات: قياس النواقص والتكرار والقيم الشاذة — MIZYAi" },
      { property: "og:description", content: "تعلّم قياس جودة البيانات عبر الاكتمال والتفرّد والاتساق والقيم الشاذة. افهم درجة الجودة وحدّد ما يجب تنظيفه قبل التحليل واتخاذ القرار." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "جودة البيانات: قياس النواقص والتكرار والقيم الشاذة — MIZYAi" },
      { name: "twitter:description", content: "تعلّم قياس جودة البيانات عبر الاكتمال والتفرّد والاتساق والقيم الشاذة. افهم درجة الجودة وحدّد ما يجب تنظيفه قبل التحليل واتخاذ القرار." },
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
      eyebrow="دليل عملي · جودة البيانات"
      eyebrowIcon={<Gauge className="size-3.5 text-primary" strokeWidth={2} />}
      title={TITLE}
      intro="قبل أي رسم بياني أو تقرير، السؤال الأهم: هل بياناتك تستحق الثقة؟ درجة جودة البيانات تختصر الجواب في رقم واحد مبني على فحوصات محددة يمكنك مراجعتها بنفسك."
      related={[
        { to: "/guide/fix-arabic-encoding", label: "حل مشكلة الحروف العربية المتكسّرة في CSV" },
        { to: "/guide/ask-data-in-arabic", label: "اسأل بياناتك بالعربية واحصل على استعلام موثّق" },
      ]}
    >
      <GuideSection id="axes" title="المحاور الأربعة للقياس">
        <ul className="space-y-3">
          {[
            {
              t: "الاكتمال",
              d: "نسبة الخلايا الفارغة في كل عمود. عمود فيه 40% فراغ لا يصلح للمتوسطات، وقد يصلح للتصنيف فقط.",
            },
            {
              t: "التفرّد",
              d: "الصفوف المكررة كلياً أو المكررة على مفتاح مثل رقم الطلب — أكثر سبب لتضخيم الأرقام في التقارير.",
            },
            {
              t: "الاتساق",
              d: "عمود يُفترض أنه رقمي لكنه يحوي نصوصاً («غير متوفر»، «١٢٠ ر.س»)، أو تواريخ بصيغ مختلطة.",
            },
            {
              t: "المعقولية",
              d: "قيم خارج المدى المنطقي: أعمار سالبة، نِسَب تتجاوز 100%، أو قفزات شاذة في المبيعات.",
            },
          ].map((s) => (
            <li key={s.t} className="rounded-xl border border-border/50 bg-surface-1 p-4">
              <h3 className="font-display text-sm font-bold">{s.t}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ul>
      </GuideSection>

      <GuideSection id="read" title="كيف تقرأ الدرجة؟">
        <p className={P}>
          الدرجة ليست حكماً نهائياً بل مؤشر أولوية: فوق 85 يمكنك التحليل مباشرة مع ملاحظات
          طفيفة، وبين 60 و85 تحتاج تنظيفاً موجّهاً قبل أي قرار، ودون 60 راجع مصدر البيانات نفسه —
          غالباً المشكلة في طريقة التصدير أو الدمج لا في التحليل. الأهم من الرقم هو قائمة
          الملاحظات التي أنتجته.
        </p>
      </GuideSection>

      <GuideSection id="clean" title="تنظيف غير تدميري: القاعدة الذهبية">
        <p className={P}>
          لا تعدّل ملفك الأصلي أبداً. الأسلوب الصحيح هو بناء طبقة تنظيف فوق البيانات (عرض
          منطقي) تطبّق خطوات مثل حذف المكررات وتوحيد النصوص وتطبيع الأرقام، مع إمكانية التراجع عن
          أي خطوة ورؤية أثرها على الدرجة فوراً.
        </p>
        <ul className="space-y-2">
          {[
            "وثّق كل خطوة تنظيف حتى يستطيع غيرك إعادة إنتاج النتيجة.",
            "لا تملأ الفراغات بصفر تلقائياً — الصفر قيمة، والفراغ غياب معلومة.",
            "وحّد كتابة النصوص العربية (الألف والهمزة والتاء المربوطة) قبل التجميع حسب الفئة.",
            "أعد قياس الدرجة بعد التنظيف وأرفقها في التقرير كدليل على الجاهزية.",
          ].map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2} />
              {f}
            </li>
          ))}
        </ul>
      </GuideSection>

          <GuideSection id="faq" title="أسئلة شائعة">
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-sm font-bold">ما أهم أبعاد جودة البيانات؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">الأبعاد الشائعة تشمل الاكتمال، والتفرّد، والاتساق، والصحة أو المعقولية. قد تحتاج أيضاً إلى قياس الدقة والحداثة بحسب مجال البيانات والغرض من التحليل.</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-bold">هل درجة جودة 90 من 100 تعني أن البيانات صحيحة؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">لا. الدرجة مؤشر تلخيصي يعتمد على الفحوصات والأوزان المستخدمة، ولا تثبت صحة كل قيمة أو خلو البيانات من التحيّز. راجع تفاصيل المخالفات وقواعد المجال قبل اتخاذ قرار.</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-bold">هل أعوّض كل الخلايا الفارغة بالصفر؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">لا. الصفر قيمة فعلية بينما الفراغ قد يعني أن المعلومة غير متاحة أو لم تُسجّل. حدّد معنى النقص أولاً، ثم اختر الحذف أو التعويض أو الإبقاء وفق طبيعة المتغير والتحليل.</p>
              </div>
            </div>
          </GuideSection>
    </GuideLayout>
  );
}
