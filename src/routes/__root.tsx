import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { PwaLayer } from "@/components/PwaLayer";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
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

      { title: "بصيرة — تحليل ملفات CSV و XLSX" },
      {
        name: "description",
        content: "بصيرة: اعرض واستكشف ملفات CSV و XLSX محلياً داخل متصفحك دون رفعها لأي خادم.",
      },
      { property: "og:title", content: "بصيرة — تحليل ملفات CSV و XLSX" },
      {
        property: "og:description",
        content: "ارفع ملف بيانات واستعرضه فوراً في جدول عربي RTL — كل شيء يحدث محلياً في متصفحك.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#010A19" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "بصيرة" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&family=Tajawal:wght@300;400;500;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon-180.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function FirstLoad({ children }: { children: ReactNode }) {
  // First-load sequence: brand -> shell -> skeleton -> content
  // Keep transitions short and non-blocking. Respect prefers-reduced-motion.
  const [phase, setPhase] = useState<'brand' | 'shell' | 'skeleton' | 'ready'>('brand');

  useEffect(() => {
    let mounted = true;
    // brand shows very briefly to communicate identity — do not delay user.
    const t1 = window.setTimeout(() => mounted && setPhase('shell'), 120);
    // shell -> skeleton transition: allow minimal time to paint layout
    const t2 = window.setTimeout(() => mounted && setPhase('skeleton'), 220);
    // skeleton -> ready: short timeout — app content may already be interactive.
    const t3 = window.setTimeout(() => mounted && setPhase('ready'), 420);
    return () => {
      mounted = false;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* Brand splash (non-blocking, dismisses quickly) */}
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-200 ${
          phase === 'brand' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="text-4xl font-extrabold tracking-tight text-offwhite">بصيرة</div>
          <div className="text-sm text-muted-foreground">Clarity · Intelligence · Trust</div>
        </div>
      </div>

      {/* Shell backdrop / skeleton layer */}
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-0 z-40 transition-opacity duration-200 ${
          phase === 'skeleton' ? 'opacity-60' : phase === 'brand' || phase === 'shell' ? 'opacity-90' : 'opacity-0'
        }`}
        style={{ background: 'linear-gradient(180deg, rgba(1,10,25,0.9), rgba(1,10,25,0.7))' }}
      />

      <div className={`min-h-screen transition-opacity duration-200 ${phase === 'ready' ? 'opacity-100' : 'opacity-95'} `}>
        {children}
      </div>
    </div>
  );
}

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {/* FirstLoad wraps the app to provide a short first-load sequence. */}
        <FirstLoad>{children}</FirstLoad>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <PwaLayer />
      <Toaster position="bottom-center" dir="rtl" richColors closeButton />
    </QueryClientProvider>
  );
}
