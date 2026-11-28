import { themeInitScript } from "@/lib/theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import tokensCss from "../styles/tokens.css?url";
import glassCss from "@/styles/theme-glass.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { QuotaDialog } from "@/components/QuotaDialog";
import { PwaLayer } from "@/components/PwaLayer";
import { siteIdentity } from "@/lib/seo";
import { installNetworkLedger } from "@/lib/network-ledger";
import { startProjectSyncWorker } from "@/lib/mizya-sync-queue";
import { VisitTracker } from "@/components/VisitTracker";

installNetworkLedger();

function NotFoundComponent() {
  return (
    <main
      lang="ar"
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-background px-4"
    >
      <div className="max-w-md text-center">
        <p className="font-mono text-7xl font-bold text-primary">404</p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">الصفحة غير موجودة</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          يبدو أن الرابط غير صحيح أو أن الصفحة نُقلت. يمكنك العودة إلى المنصة أو تصفّح الأدلة.
        </p>
        <nav aria-label="روابط مفيدة" className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            العودة إلى MIZYAi
          </Link>
          <Link
            to="/guide"
            className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            تصفّح الأدلة
          </Link>
        </nav>
      </div>
    </main>
  );
}

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Unable to preload CSS/i;
const RELOAD_FLAG = "mizyai:chunk-reload-at";

/** بعد نشر جديد قد يطلب المتصفح ملفاً قديماً غير موجود: نمسح كاش عامل الخدمة ونعيد التحميل مرة واحدة. */
async function recoverFromStaleChunks(): Promise<boolean> {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_FLAG) ?? 0);
    if (Date.now() - last < 60_000) return false;
    window.sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    return false;
  }
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.allSettled((regs ?? []).map((r) => r.unregister()));
    const keys = await window.caches?.keys?.();
    await Promise.allSettled((keys ?? []).map((k) => window.caches.delete(k)));
  } catch {
    // لا يمنع إعادة التحميل
  }
  window.location.reload();
  return true;
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const detail = String((error as { message?: unknown } | null)?.message ?? error ?? "").slice(
    0,
    400,
  );
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    if (CHUNK_ERROR_RE.test(detail)) void recoverFromStaleChunks();
  }, [error, detail]);

  const configMissing = /Missing Supabase environment/i.test(
    String((error as { message?: unknown } | null)?.message ?? ""),
  );

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {configMissing ? "إعدادات الخدمة غير مكتملة" : "تعذّر تحميل هذه الصفحة"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {configMissing
            ? "لم تصل إعدادات الاتصال بقاعدة البيانات إلى هذا الإصدار. أعد نشر المشروع (Publish) من Lovable ثم حدّث الصفحة."
            : "حدث خطأ من جهتنا. جرّب تحديث الصفحة أو العودة إلى الرئيسية."}
        </p>
        {detail && (
          <details className="mt-3 text-start text-[11px] text-muted-foreground">
            <summary className="cursor-pointer text-center">تفاصيل الخطأ (للدعم)</summary>
            <pre
              dir="ltr"
              className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-black/20 p-2"
            >
              {detail}
            </pre>
          </details>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            إعادة المحاولة
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        name: "google-site-verification",
        content: "PyfVCMZe_g9YkymoMUnYgZXwTqlmm2VB70Djcb5pe8Q",
      },

      { property: "og:site_name", content: "MIZYAi" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:image",
        content: "https://basira-data-viewer.lovable.app/brand/og-image.png",
      },
      { property: "og:image:alt", content: "MIZYAi — منصة تحليل البيانات العربية" },
      { property: "og:image:type", content: "image/png" },
      {
        name: "twitter:image",
        content: "https://basira-data-viewer.lovable.app/brand/og-image.png",
      },
      { name: "twitter:image:alt", content: "MIZYAi — منصة تحليل البيانات العربية" },
      { property: "og:locale", content: "ar" },
      { name: "theme-color", content: "#FAF8F1" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "MIZYAi" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    scripts: [siteIdentity()],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&family=Tajawal:wght@300;400;500;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: "/fonts/changa.css",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "stylesheet",
        href: tokensCss,
      },
      {
        rel: "stylesheet",
        href: glassCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png?v=glass" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon-180.png?v=glass" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-theme="glass" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body>
        <svg
          className="mz-ig-defs"
          width="0"
          height="0"
          aria-hidden="true"
          focusable="false"
          style={{ position: "absolute" }}
        >
          <defs>
            {(["teal", "lav", "amber", "rose", "slate"] as const).map((id) => (
              <linearGradient
                key={id}
                id={`mz-ig-${id}`}
                gradientUnits="userSpaceOnUse"
                x1="2"
                y1="2"
                x2="22"
                y2="22"
              >
                <stop offset="0%" />
                <stop offset="55%" />
                <stop offset="100%" />
              </linearGradient>
            ))}
          </defs>
        </svg>

        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => startProjectSyncWorker(), []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <VisitTracker />
      <Outlet />
      <PwaLayer />
      <QuotaDialog />
      <Toaster position="bottom-center" dir="rtl" richColors closeButton />
    </QueryClientProvider>
  );
}
