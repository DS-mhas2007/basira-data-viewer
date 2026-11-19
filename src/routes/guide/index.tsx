import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ArrowLeft, ArrowUpLeft, BookOpen, Search, Sparkles, UploadCloud } from "@/components/icons";
import { BasiraLogo } from "@/components/BasiraLogo";
import { GUIDE_GROUPS, GUIDES } from "@/lib/guides";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide";

export const Route = createFileRoute("/guide/")({
  head: () => ({
    meta: [
      { title: "أدلة تحليل البيانات وتنظيف Excel وCSV بالعربية — MIZYAi" },
      {
        name: "description",
        content:
          "أدلة عربية لتنظيف ملفات CSV وExcel، وفحص القيم المتطرفة، وتحليل الارتباط والسلاسل الزمنية، وتعلّم SQL وقراءة الرسوم البيانية.",
      },
      { property: "og:title", content: "أدلة MIZYAi — تنظيف البيانات وتحليل Excel وCSV" },
      {
        property: "og:description",
        content: "تعلّم تنظيف ملفات Excel وCSV، وتحليل العلاقات والاتجاهات الزمنية، واستخدام SQL وقراءة الرسوم البيانية.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "أدلة MIZYAi — تحليل البيانات وتنظيف الملفات" },
      {
        name: "twitter:description",
        content: "شروحات عملية بالعربية لتنظيف البيانات وتحليل الارتباط والسلاسل الزمنية وSQL وقراءة الرسوم.",
      },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": CANONICAL,
          name: "أدلة MIZYAi",
          inLanguage: "ar",
          url: CANONICAL,
          isPartOf: { "@id": "https://basira-data-viewer.lovable.app/#website" },
          breadcrumb: {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "MIZYAi", item: "https://basira-data-viewer.lovable.app/" },
              { "@type": "ListItem", position: 2, name: "أدلة MIZYAi", item: CANONICAL },
            ],
          },
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: GUIDES.length,
            itemListElement: GUIDES.map((guide, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: guide.title,
              url: `https://basira-data-viewer.lovable.app${guide.to}`,
            })),
          },
        }),
      },
    ],
  }),
  component: GuideIndex,
});

function GuideIndex() {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ar");
  const filteredGroups = GUIDE_GROUPS
    .map((group) => ({
      ...group,
      guides: group.guides.filter((guide) =>
        `${guide.title} ${guide.desc}`.toLocaleLowerCase("ar").includes(normalizedQuery),
      ),
    }))
    .filter((group) => group.guides.length > 0);
  const resultCount = filteredGroups.reduce((total, group) => total + group.guides.length, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <BasiraLogo className="size-7" />
            <span className="font-display text-sm font-bold">MIZYAi</span>
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
            شروحات عملية تبدأ من استيراد الملفات وتنظيفها، ثم تنتقل إلى الإحصاء والارتباط والقيم المتطرفة والسلاسل الزمنية وSQL وقراءة الرسوم البيانية. كل دليل يشرح المشكلة وطريقة التعامل معها وحدود الاستنتاج.
          </p>
        </header>

        <div className="mx-auto mt-8 max-w-xl">
          <label htmlFor="guide-search" className="sr-only">ابحث في الأدلة</label>
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={2} />
            <input
              id="guide-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="ابحث عن CSV أو القيم المتطرفة أو الارتباط أو SQL أو السلاسل الزمنية..."
              className="min-h-12 w-full rounded-2xl border border-border/60 bg-surface-1 py-3 pe-10 ps-4 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground" aria-live="polite">
            يعرض {resultCount.toLocaleString("en-US")} من {GUIDES.length.toLocaleString("en-US")} أدلة
          </p>
        </div>

        <nav aria-label="تصنيفات الأدلة" className="mt-6 flex flex-wrap justify-center gap-2">
          {filteredGroups.map((group) => (
            <a
              key={group.id}
              href={`#${group.id}`}
              className="rounded-full border border-border/60 bg-surface-1 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {group.title}
            </a>
          ))}
        </nav>

        {filteredGroups.length > 0 ? (
          <div className="mt-10 space-y-12">
            {filteredGroups.map((group) => (
            <section key={group.id} id={group.id} aria-labelledby={`${group.id}-heading`} className="scroll-mt-24">
              <div className="mb-4 border-b border-border/50 pb-3">
                <h2 id={`${group.id}-heading`} className="font-display text-xl font-bold">{group.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{group.description}</p>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {group.guides.map((g) => (
                  <li key={g.to}>
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
                      <h3 className="mt-4 font-display text-sm font-bold leading-snug sm:text-base">
                        {g.title}
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{g.desc}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
            ))}
          </div>
        ) : (
          <div role="status" className="mt-10 rounded-2xl border border-dashed border-border/60 bg-surface-1/60 px-6 py-12 text-center">
            <Search className="mx-auto size-6 text-muted-foreground" strokeWidth={1.8} />
            <h2 className="mt-3 font-display text-base font-bold">لم نعثر على دليل مطابق</h2>
            <p className="mt-2 text-sm text-muted-foreground">جرّب كلمات أقصر مثل CSV أو Excel أو الترميز أو الخصوصية.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setSearchQuery("")} className="mt-4">
              عرض كل الأدلة
            </Button>
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-primary/25 bg-primary/5 p-6 text-center">
          <Sparkles className="mx-auto size-6 text-primary" strokeWidth={2} />
          <h2 className="mt-3 font-display text-lg font-bold">جرّب ما قرأته فوراً</h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
            يمكنك تطبيق خطوات الأدلة داخل MIZYAi. تتم قراءة الملفات والتحليلات الأساسية محلياً في
            المتصفح، بينما ميزات الذكاء الاصطناعي اختيارية وقد ترسل السؤال وعينة محدودة من البيانات
            إلى مزوّد النموذج؛ راجع دليل الخصوصية قبل استخدامها مع بيانات حسّاسة.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <UploadCloud className="size-4" strokeWidth={2} />
            افتح MIZYAi وارفع ملفك
          </Link>
        </div>
      </main>
    </div>
  );
}
