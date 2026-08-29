import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen } from "lucide-react";
import { BasiraLogo } from "@/components/BasiraLogo";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide";

const GUIDES: { to: string; title: string; desc: string }[] = [
  {
    to: "/guide/arabic-csv-excel",
    title: "كيف تحلّل ملفات Excel و CSV بالعربية دون رفعها",
    desc: "تحليل محلي كامل داخل المتصفح مع حلول الترميز وجودة البيانات.",
  },
  {
    to: "/guide/fix-arabic-encoding",
    title: "حل مشكلة الحروف العربية المتكسّرة في ملفات CSV",
    desc: "لماذا تظهر ãäÇÁÉ بدل النص العربي، وكيف تصلحها في Excel و Google Sheets وبصيرة.",
  },
  {
    to: "/guide/data-quality-score",
    title: "درجة جودة البيانات: كيف تقيس نظافة ملفك من 100",
    desc: "المكررات، الفراغات، عدم اتساق الأنواع، والقيم الشاذة — وكيف تصلحها بلا تدمير.",
  },
  {
    to: "/guide/ask-data-in-arabic",
    title: "اسأل بياناتك بالعربية: من السؤال إلى استعلام SQL موثّق",
    desc: "كيف يحوّل الذكاء الاصطناعي سؤالك إلى استعلام، ولماذا بطاقة الدليل تمنع الأرقام المخترعة.",
  },
  {
    to: "/guide/pivot-alternative",
    title: "بديل الجداول المحورية (Pivot Tables) لتقارير عربية أسرع",
    desc: "من التجميع اليدوي في Excel إلى تقارير PDF و PPTX عربية جاهزة بنقرة.",
  },
];

export const Route = createFileRoute("/guide/")({
  head: () => ({
    meta: [
      { title: "أدلة بصيرة — تحليل البيانات العربية داخل المتصفح" },
      {
        name: "description",
        content:
          "مكتبة أدلة عربية عملية لتحليل ملفات Excel و CSV: إصلاح الترميز، قياس جودة البيانات، الأسئلة الذكية، وبدائل الجداول المحورية.",
      },
      { property: "og:title", content: "أدلة بصيرة — تحليل البيانات العربية" },
      {
        property: "og:description",
        content: "أدلة عربية عملية لتحليل ملفات Excel و CSV محلياً داخل المتصفح.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "أدلة بصيرة",
          inLanguage: "ar",
          url: CANONICAL,
        }),
      },
    ],
  }),
  component: GuideIndex,
});

function GuideIndex() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <BasiraLogo className="size-7" />
            <span className="font-display text-sm font-bold">بصيرة</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            جرّب الأداة مجاناً
            <ArrowLeft className="size-3.5" strokeWidth={2.25} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-1 px-3 py-1 text-[11px] text-muted-foreground">
          <BookOpen className="size-3.5 text-primary" strokeWidth={2} />
          مكتبة الأدلة
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold leading-[1.35] tracking-tight sm:text-4xl">
          أدلة عربية لتحليل ملفات Excel و CSV
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          شروحات عملية مبنية على مشاكل حقيقية يواجهها من يعمل ببيانات عربية: ترميز متكسّر، أرقام
          غير قابلة للحساب، تقارير تستهلك ساعات. كل دليل يشرح المشكلة وطريقة الحل خطوة بخطوة.
        </p>

        <ul className="mt-8 space-y-3">
          {GUIDES.map((g) => (
            <li key={g.to}>
              <Link
                to={g.to as never}
                className="block rounded-2xl border border-border/50 bg-surface-1 p-5 transition-colors hover:border-primary/40"
              >
                <h2 className="font-display text-sm font-bold sm:text-base">{g.title}</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{g.desc}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
