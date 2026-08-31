import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpLeft, BookOpen, Sparkles, UploadCloud } from "lucide-react";
import { BasiraLogo } from "@/components/BasiraLogo";
import { GUIDES } from "@/lib/guides";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide";

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
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
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

      <main className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <header className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-1 px-3 py-1.5 text-[11px] text-muted-foreground">
            <BookOpen className="size-3.5 text-primary" strokeWidth={2} />
            مكتبة الأدلة — {GUIDES.length.toLocaleString("en-US")} شروحات عملية
          </span>
          <h1 className="mx-auto mt-5 max-w-2xl font-display text-3xl font-bold leading-[1.35] tracking-tight sm:text-4xl">
            أدلة عربية لتحليل ملفات <span dir="ltr" className="font-mono">Excel</span> و{" "}
            <span dir="ltr" className="font-mono">CSV</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            شروحات مبنية على مشاكل حقيقية يواجهها من يعمل ببيانات عربية: ترميز متكسّر، أرقام غير
            قابلة للحساب، وتقارير تستهلك ساعات. كل دليل يشرح المشكلة والحل خطوة بخطوة.
          </p>
        </header>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {GUIDES.map((g) => (
            <li key={g.to} className="first:sm:col-span-2">
              <Link
                to={g.to as never}
                className="group flex h-full flex-col rounded-2xl border border-border/50 bg-surface-1 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
                    <g.icon className="size-5" strokeWidth={2} />
                  </div>
                  <ArrowUpLeft
                    className="size-4 text-muted-foreground/50 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                    strokeWidth={2}
                  />
                </div>
                <h2 className="mt-4 font-display text-sm font-bold leading-snug sm:text-base">
                  {g.title}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{g.desc}</p>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10 rounded-2xl border border-primary/25 bg-primary/5 p-6 text-center">
          <Sparkles className="mx-auto size-6 text-primary" strokeWidth={2} />
          <h2 className="mt-3 font-display text-lg font-bold">جرّب ما قرأته فوراً</h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
            كل ما في هذه الأدلة يعمل داخل بصيرة مباشرة — ارفع ملفك وابدأ خلال ثوانٍ، دون تسجيل ودون
            مغادرة بياناتك لجهازك.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <UploadCloud className="size-4" strokeWidth={2} />
            افتح بصيرة وارفع ملفك
          </Link>
        </div>
      </main>
    </div>
  );
}
