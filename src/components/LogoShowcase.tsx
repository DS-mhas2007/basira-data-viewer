import { LOGO_DIRECTIONS } from "./BasiraLogo";

/** معاينة مؤقتة لاتجاهات الشعار الثلاثة — تُزال بعد اختيار الاتجاه النهائي. */
export function LogoShowcase() {
  return (
    <section className="rise-in space-y-4 rounded-xl border border-border/70 bg-card/60 p-5 shadow-[var(--shadow-panel)]">
      <div className="space-y-1">
        <h2 className="font-display text-lg font-bold">اتجاهات الشعار المقترحة</h2>
        <p className="text-sm text-muted-foreground">
          ثلاثة مفاهيم مختلفة تماماً — اختر واحداً لاعتماده في الهيدر والـ favicon.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {LOGO_DIRECTIONS.map(({ key, name, desc, Comp }) => (
          <div
            key={key}
            className="card-lift flex flex-col items-center gap-4 rounded-xl border border-border/70 bg-[#010A19] px-5 py-8 text-center hover:border-primary/40"
          >
            <Comp className="size-24" id={`show-${key}`} />
            <div className="flex items-center gap-2.5">
              <Comp className="size-8" id={`show-sm-${key}`} />
              <span className="font-display text-xl font-extrabold tracking-tight">بصيرة</span>
            </div>
            <div className="space-y-1">
              <p className="font-mono text-xs text-primary">{name}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
