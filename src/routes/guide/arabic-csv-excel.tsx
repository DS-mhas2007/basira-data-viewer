import { guideArticle, guideBreadcrumb } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Lock,
  ShieldAlert,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { BasiraLogo } from "@/components/BasiraLogo";

const CANONICAL = "https://basira-data-viewer.lovable.app/guide/arabic-csv-excel";

export const Route = createFileRoute("/guide/arabic-csv-excel")({
  head: () => ({
    meta: [
      { title: "تحليل ملف CSV عربي وExcel داخل المتصفح | MIZYAi" },
      {
        name: "description",
        content:
          "تعرّف إلى طريقة تحليل ملف CSV عربي وملفات Excel داخل المتصفح، وإصلاح الترميز وفحص جودة البيانات. المعالجة الأساسية محلية، وميزات الذكاء الاصطناعي اختيارية وقد ترسل بيانات محدودة إلى مزوّد النموذج.",
      },
      { property: "og:title", content: "تحليل ملف CSV عربي وExcel داخل المتصفح | MIZYAi" },
      {
        property: "og:description",
        content:
          "طريقة عملية لقراءة وتنظيف وتحليل ملف CSV عربي وملفات Excel داخل المتصفح، مع حلول لمشاكل الترميز والأرقام العربية.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "تحليل ملف CSV عربي وExcel داخل المتصفح | MIZYAi" },
      {
        name: "twitter:description",
        content: "دليل عملي لتحليل ملف CSV عربي وملفات Excel داخل المتصفح، مع إصلاح الترميز وفحص جودة البيانات.",
      },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      guideBreadcrumb("كيف تحلّل ملف CSV عربي وملفات Excel داخل المتصفح؟", CANONICAL),
      guideArticle(
        "كيف تحلّل ملف CSV عربي وملفات Excel داخل المتصفح؟",
        "دليل عملي لتحليل ملفات البيانات العربية داخل المتصفح وإصلاح الترميز وفحص الجودة؛ المعالجة الأساسية محلية وميزات الذكاء الاصطناعي اختيارية وقد ترسل بيانات محدودة إلى مزوّد النموذج.",
        CANONICAL,
      ),
    ],
  }),
  component: GuidePage,
});

function Section({
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

function GuidePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
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

      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <article className="space-y-10">
          <header className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-1 px-3 py-1 text-[11px] text-muted-foreground">
              <FileSpreadsheet className="size-3.5 text-primary" strokeWidth={2} />
              دليل عملي · تحليل البيانات بالعربية
            </span>
            <h1 className="font-display text-3xl font-bold leading-[1.35] tracking-tight sm:text-4xl">
              كيف تحلّل ملف CSV عربي وملفات Excel داخل المتصفح؟
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              إذا كنت تتعامل مع ملف CSV عربي أو جدول Excel للاستبيانات أو المبيعات أو قوائم العملاء، فقد تواجه حروفاً متكسّرة أو أرقاماً غير مقروءة أو صعوبة في تحليل البيانات. يشرح هذا الدليل كيفية استيراد الملفات وقراءتها وفحص جودتها داخل المتصفح، مع توضيح ما تتم معالجته محلياً وما قد يُرسل عند تفعيل ميزات الذكاء الاصطناعي.
            </p>
          </header>

          <nav aria-label="مسار التنقل" className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-primary">MIZYAi</Link>
            <span aria-hidden="true">/</span>
            <Link to="/guide" className="hover:text-primary">أدلة MIZYAi</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">تحليل Excel و CSV بالعربية</span>
          </nav>

          <Section id="privacy" title="لماذا التحليل المحلي داخل المتصفح؟">
            <p className="text-sm leading-loose text-muted-foreground">
              عندما ترفع ملف CSV أو Excel لأي موقع تحليل تقليدي، فأنت تسلّم نسخة من بياناتك
              لخادم لا تعرفه. في MIZYAi، تُقرأ الملفات وتُعالَج بمحرك تحليل يعمل بالكامل داخل
              متصفحك (DuckDB-WASM)، فلا يغادر أي صف من بياناتك جهازك. يمكنك حتى فصل الإنترنت
              بعد تحميل الصفحة وستستمر الأداة بالعمل.
            </p>
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <Lock className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2} />
              <p className="text-xs leading-relaxed text-muted-foreground">
                للتحقق بنفسك، راقب تبويب Network في أدوات المطوّر أثناء استخدام التحليل الأساسي، ثم راقبه مرة أخرى عند تفعيل ميزات الذكاء الاصطناعي؛ قد تختلف الطلبات والبيانات المرسلة بين الحالتين.
              </p>
            </div>
          </Section>

          <Section id="steps" title="خطوات التحليل في ثلاث دقائق">
            <ol className="space-y-3">
              {[
                {
                  t: "ارفع الملف أو اسحبه",
                  d: "يدعم الملفات بصيغة CSV و XLSX، بما فيها ملفات Excel متعددة الأوراق — اختر الورقة التي تريد تحليلها.",
                },
                {
                  t: "راجع درجة جودة البيانات",
                  d: "تحصل فوراً على درجة من 100 تكشف الصفوف المكررة والخلايا الفارغة والأعمدة غير المتسقة، مع اقتراحات تنظيف غير تدميرية لا تعدّل ملفك الأصلي.",
                },
                {
                  t: "اسأل بالعربية",
                  d: "اكتب سؤالاً مثل «ما متوسط المبيعات حسب المنطقة؟» وتحصل على إجابة موثّقة بالاستعلام الذي نُفّذ وعدد الصفوف — لا إجابات مخترعة.",
                },
                {
                  t: "صدّر النتائج",
                  d: "تقارير PDF و PPTX و HTML بالعربية جاهزة للمشاركة مع فريقك أو الإدارة.",
                },
              ].map((s, i) => (
                <li
                  key={s.t}
                  className="flex gap-3 rounded-xl border border-border/50 bg-surface-1 p-4"
                >
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
          </Section>

          <Section id="encoding" title="حل مشكلة الحروف العربية المتكسّرة في CSV">
            <p className="text-sm leading-loose text-muted-foreground">
              أكثر مشكلة شائعة: تفتح ملف CSV فتظهر الحروف العربية كرموز غريبة مثل{" "}
              <span dir="ltr" className="font-mono text-foreground/90">ãäÇÁÉ</span>. السبب أن
              Excel القديم يحفظ CSV بترميز{" "}
              <span dir="ltr" className="font-mono text-foreground/90">Windows-1256</span> بدل{" "}
              <span dir="ltr" className="font-mono text-foreground/90">UTF-8</span>. MIZYAi تكتشف
              الترميز تلقائياً وتعرضه لك، وتتيح تبديله يدوياً عند الحاجة — فتظهر النصوص العربية
              سليمة دون أي برامج إضافية.
            </p>
            <ul className="space-y-2">
              {[
                "كشف تلقائي للترميز (UTF-8 / Windows-1256) مع إمكانية التبديل اليدوي.",
                "كشف فاصل الأعمدة تلقائياً: فاصلة أو فاصلة منقوطة أو TAB.",
                "تطبيع الأرقام العربية (٠١٢٣) والعملة والنسب المئوية لتصبح قابلة للحساب.",
                "تنبيه عند التواريخ الغامضة مثل 01/02/2025 التي قد تُقرأ بطريقتين.",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2} />
                  {f}
                </li>
              ))}
            </ul>
          </Section>

          <Section id="ai" title="اسأل بياناتك بالعربية — بثقة">
            <p className="text-sm leading-loose text-muted-foreground">
              المشكلة مع أدوات الذكاء الاصطناعي المعتادة أنها قد «تخترع» أرقاماً. في MIZYAi، كل
              إجابة تأتي مع بطاقة دليل تُظهر الاستعلام الفعلي الذي نُفّذ على بياناتك وعدد
              الصفوف المطابقة، ويمكنك تصدير الاستعلام نفسه بصيغة SQL أو Python لإعادة تشغيله
              بنفسك. الحسابات تُنفّذ محلياً، لكن استخدام الذكاء الاصطناعي قد يرسل سؤالك ووصف
              الأعمدة وعيّنة صغيرة من القيم ونتائج الاستعلامات؛ راجع دليل الخصوصية قبل استخدام
              بيانات حسّاسة.
            </p>
          </Section>

          <Section id="limits" title="حدود يجب أن تعرفها">
            <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-surface-1 p-4">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
              <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <li>الأداة مخصصة للتحليل الاستكشافي وليست بديلاً عن قواعد بيانات مؤسسية.</li>
                <li>الملفات الضخمة جداً محدودة بذاكرة جهازك — الملايين من الصفوف تحتاج أدوات خادمية.</li>
                <li>النتائج تعتمد على جودة بياناتك المدخلة؛ راجع درجة جودة البيانات قبل بناء القرارات.</li>
              </ul>
            </div>
          </Section>


          <Section id="faq" title="أسئلة شائعة">
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-sm font-bold">هل يمكن تحليل ملف Excel دون رفعه إلى خادم؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">نعم، تتم قراءة الملف وتشغيل التحليلات الأساسية محلياً داخل المتصفح باستخدام محرك DuckDB-WASM. لكن ميزات الذكاء الاصطناعي اختيارية وقد ترسل السؤال ووصف الأعمدة وعينة محدودة من القيم إلى مزوّد النموذج؛ لا تستخدمها مع بيانات حساسة قبل مراجعة سياسة الخصوصية.</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-bold">ما الفرق بين تحليل CSV وتحليل XLSX؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">CSV ملف نصي بورقة واحدة ولا يحتفظ عادةً بأنواع البيانات أو التنسيقات، بينما XLSX يدعم أوراقاً متعددة ويحتفظ بمعلومات أكثر عن الخلايا. اختر CSV للتبادل البسيط والملفات النصية، وXLSX عند الحاجة إلى أوراق متعددة أو تنسيقات Excel.</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-bold">كيف أصلح ظهور الحروف العربية كرموز؟</h3>
                <p className="mt-1 text-sm leading-loose text-muted-foreground">استورد الملف من داخل Excel عبر Data ثم From Text/CSV، وجرّب UTF-8 أو Windows-1256 حتى تظهر المعاينة صحيحة. بعد ذلك احفظ نسخة UTF-8، ولا تغيّر الترميز عشوائياً قبل التأكد من النص في المعاينة.</p>
              </div>
            </div>
          </Section>
          <nav aria-label="أدلة ذات صلة" className="space-y-3 border-t border-border/50 pt-6">
            <h2 className="font-display text-lg font-bold">أكمل التحليل بهذه الأدلة</h2>
            <ul className="space-y-3 text-sm">
              <li><Link to="/guide/fix-arabic-encoding" className="text-primary underline-offset-4 hover:underline">إصلاح الحروف العربية المتكسّرة في CSV</Link></li>
              <li><Link to="/guide/data-quality-score" className="text-primary underline-offset-4 hover:underline">قياس جودة البيانات قبل التحليل</Link></li>
              <li><Link to="/guide/remove-duplicates" className="text-primary underline-offset-4 hover:underline">إزالة الصفوف المكررة دون إتلاف الملف</Link></li>
              <li><Link to="/guide/csv-vs-excel" className="text-primary underline-offset-4 hover:underline">الفرق بين CSV و Excel واختيار الصيغة المناسبة</Link></li>
              <li><Link to="/guide/data-privacy-browser" className="text-primary underline-offset-4 hover:underline">خصوصية البيانات وما يُرسل عند استخدام الذكاء الاصطناعي</Link></li>
              <li><Link to="/guide" className="text-primary underline-offset-4 hover:underline">تصفّح جميع أدلة MIZYAi</Link></li>
            </ul>
          </nav>

          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6 text-center">
            <Sparkles className="mx-auto size-6 text-primary" strokeWidth={2} />
            <h2 className="mt-3 font-display text-lg font-bold">جرّب التحليل الآن — ملفك يبقى عندك</h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
              ارفع ملف CSV أو XLSX وابدأ التحليل المحلي خلال ثوانٍ دون رفع الملف الأصلي.
              خدمات الذكاء الاصطناعي اختيارية ولها متطلبات اتصال وخصوصية مختلفة.
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <UploadCloud className="size-4" strokeWidth={2} />
              افتح MIZYAi وارفع ملفك
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
