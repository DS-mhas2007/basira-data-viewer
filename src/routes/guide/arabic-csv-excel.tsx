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
      { title: "ملف CSV عربي: فتحه وتحليله وإصلاح ترميزه | MIZYAi" },
      {
        name: "description",
        content:
          "تعلّم فتح ملف CSV عربي في Excel وتحليله داخل المتصفح، وإصلاح ترميز UTF-8 وWindows-1256، وفحص جودة البيانات قبل الاعتماد على النتائج.",
      },
      { property: "og:title", content: "ملف CSV عربي: فتحه وتحليله وإصلاح ترميزه | MIZYAi" },
      {
        property: "og:description",
        content:
          "خطوات عملية لفتح ملف CSV عربي في Excel، وإصلاح الحروف المتكسّرة، ثم تحليل البيانات وفحص جودتها داخل المتصفح.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { property: "og:locale", content: "ar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ملف CSV عربي: فتحه وتحليله وإصلاح ترميزه | MIZYAi" },
      {
        name: "twitter:description",
        content: "دليل عملي لفتح ملف CSV عربي وتحليله في Excel والمتصفح، مع إصلاح الترميز وفحص جودة البيانات.",
      },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      guideBreadcrumb("كيف تفتح وتحلّل ملف CSV عربي في Excel وداخل المتصفح؟", CANONICAL),
      guideArticle(
        "كيف تفتح وتحلّل ملف CSV عربي في Excel وداخل المتصفح؟",
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
              كيف تفتح وتحلّل ملف CSV عربي في Excel وداخل المتصفح؟
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
            <span aria-current="page">تحليل ملف CSV عربي وExcel</span>
          </nav>

          <Section id="privacy" title="لماذا التحليل المحلي داخل المتصفح؟">
            <p className="text-sm leading-loose text-muted-foreground">
              عند استخدام أدوات التحليل السحابية قد تُرفع الملفات إلى خوادم خارج جهازك. في MIZYAi،
              تتم قراءة الملفات والتحليلات الأساسية بمحرك DuckDB-WASM داخل المتصفح. لكن هذا لا يعني
              أن كل ميزة تعمل دون اتصال أو أن كل البيانات تبقى محلية دائماً: عند تفعيل ميزات الذكاء
              الاصطناعي قد يُرسل السؤال ووصف الأعمدة وعينة محدودة من القيم ونتائج الاستعلامات إلى
              مزوّد النموذج. راجع دليل الخصوصية قبل استخدام بيانات حساسة.
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

          <Section id="open-csv" title="كيف تفتح ملف CSV عربي دون تشويه النص؟">
            <p className="text-sm leading-loose text-muted-foreground">
              إذا ظهرت أسماء المدن أو العملاء كرموز غير مفهومة، فلا تحفظ الملف فوق النسخة الأصلية قبل تصحيح طريقة القراءة. جرّب الخطوات التالية:
            </p>
            <ol className="space-y-3">
              <li className="rounded-xl border border-border/50 bg-surface-1 p-4">
                <h3 className="font-display text-sm font-bold">في Excel</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  افتح Data ثم From Text/CSV، واختر الملف. جرّب UTF-8 أو Windows-1256 في إعداد File Origin، ولا تضغط Load قبل أن تظهر العربية صحيحة في المعاينة. اختر الفاصل الصحيح مثل الفاصلة أو الفاصلة المنقوطة.
                </p>
              </li>
              <li className="rounded-xl border border-border/50 bg-surface-1 p-4">
                <h3 className="font-display text-sm font-bold">داخل MIZYAi</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  استورد ملف CSV ثم راجع معاينة الأعمدة والنص العربي قبل بدء التحليل. إذا لم تظهر الأحرف كما تتوقع، غيّر الترميز أو الفاصل يدوياً إن كانت الخيارات متاحة، ثم تحقّق من أسماء الأعمدة والقيم.
                </p>
              </li>
              <li className="rounded-xl border border-border/50 bg-surface-1 p-4">
                <h3 className="font-display text-sm font-bold">احتفظ بنسخة أصلية</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  بعد نجاح المعاينة، احفظ نسخة جديدة بترميز معلوم. لا تفترض أن تغيير الامتداد إلى CSV أو إضافة BOM وحدهما يصلحان ملفاً قُرئ بترميز خاطئ.
                </p>
              </li>
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
              بيانات حسّاسة. تحقّق من الاستعلام والنتيجة، ولا تتعامل مع شرح النموذج على أنه معصوم من الخطأ.
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
            <h2 className="font-display text-lg font-bold">تابع إلى الدليل المناسب لخطوتك التالية</h2>
            <ul className="space-y-3 text-sm">
              <li><Link to="/guide/fix-arabic-encoding" className="text-primary underline-offset-4 hover:underline">إصلاح ترميز CSV عندما تظهر الحروف العربية بصورة مشوّهة</Link></li>
              <li><Link to="/guide/csv-vs-excel" className="text-primary underline-offset-4 hover:underline">مقارنة CSV وExcel لاختيار الصيغة المناسبة لملفك</Link></li>
              <li><Link to="/guide/data-quality-score" className="text-primary underline-offset-4 hover:underline">قياس جودة البيانات واكتشاف مشكلات الملف قبل التحليل</Link></li>
              <li><Link to="/guide/data-privacy-browser" className="text-primary underline-offset-4 hover:underline">فهم حدود الخصوصية والبيانات التي قد تُرسل إلى مزوّد AI</Link></li>
              <li><Link to="/guide/data-types" className="text-primary underline-offset-4 hover:underline">إصلاح الأرقام المخزنة كنص قبل إجراء العمليات الحسابية</Link></li>
              <li><Link to="/guide/date-format" className="text-primary underline-offset-4 hover:underline">توحيد صيغ التاريخ قبل التحليل الزمني</Link></li>
              <li><Link to="/guide/missing-values" className="text-primary underline-offset-4 hover:underline">معالجة القيم المفقودة واختيار طريقة التعويض</Link></li>
            </ul>
          </nav>

          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6 text-center">
            <Sparkles className="mx-auto size-6 text-primary" strokeWidth={2} />
            <h2 className="mt-3 font-display text-lg font-bold">جرّب التحليل المحلي — مع توضيح حدود الخصوصية</h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
              استورد ملف CSV أو XLSX وابدأ التحليل الأساسي محلياً داخل المتصفح. ميزات الذكاء الاصطناعي اختيارية وقد تتطلب إرسال بيانات محدودة إلى مزوّد النموذج.
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
