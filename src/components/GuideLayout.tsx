import { Link } from "@tanstack/react-router";
import { ArrowLeft, UploadCloud, Sparkles } from "lucide-react";
import { BasiraLogo } from "@/components/BasiraLogo";

export function GuideSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-4">
      <h2 className="font-display text-xl font-bold leading-snug sm:text-2xl">{title}</h2>
      {children}
    </section>
  );
}

export function GuideLayout({
  eyebrow,
  eyebrowIcon,
  title,
  intro,
  children,
  ctaTitle = "جرّب التحليل الآن — ملفك يبقى عندك",
  ctaText = "ارفع ملف CSV أو XLSX وابدأ التحليل خلال ثوانٍ. لا تسجيل مطلوب، ولا يُرفع أي شيء لأي خادم.",
  related = [],
}: {
  eyebrow: string;
  eyebrowIcon?: React.ReactNode;
  title: string;
  intro: string;
  children: React.ReactNode;
  ctaTitle?: string;
  ctaText?: string;
  related?: { to: string; label: string }[];
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <BasiraLogo className="size-7" />
              <span className="font-display text-sm font-bold">بصيرة</span>
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <Link
              to="/guide"
              className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              كل الأدلة
            </Link>
          </div>
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
        <article className="space-y-10">
          <header className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-1 px-3 py-1 text-[11px] text-muted-foreground">
              {eyebrowIcon}
              {eyebrow}
            </span>
            <h1 className="font-display text-3xl font-bold leading-[1.35] tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{intro}</p>
          </header>

          {children}

          {related.length > 0 && (
            <nav className="space-y-2 rounded-2xl border border-border/50 bg-surface-1 p-5">
              <h2 className="font-display text-sm font-bold">أدلة ذات صلة</h2>
              <ul className="space-y-1.5">
                {related.map((r) => (
                  <li key={r.to}>
                    <Link
                      to={r.to as never}
                      className="text-xs text-primary underline-offset-4 transition-colors hover:underline"
                    >
                      {r.label} ←
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6 text-center">
            <Sparkles className="mx-auto size-6 text-primary" strokeWidth={2} />
            <h2 className="mt-3 font-display text-lg font-bold">{ctaTitle}</h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
              {ctaText}
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <UploadCloud className="size-4" strokeWidth={2} />
              افتح بصيرة وارفع ملفك
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
