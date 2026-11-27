// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// duckdb-wasm is browser-only: its module scope touches `Worker`. In the server
// build it can end up merged into a shared vendor chunk that SSR imports, which
// crashes the published page with "ReferenceError: Worker is not defined".
// It is only ever loaded from the browser (src/lib/duckdb-browser.ts), so stub
// it out entirely for non-client builds.
const STUB_ID = "\0duckdb-wasm-server-stub";

function duckdbServerStub(): Plugin {
  return {
    name: "duckdb-wasm-server-stub",
    enforce: "pre",
    resolveId(id) {
      if (id === "@duckdb/duckdb-wasm" && this.environment?.name !== "client") {
        return STUB_ID;
      }
      return null;
    },
    load(id) {
      if (id !== STUB_ID) return null;
      return `const err = () => { throw new Error("duckdb-browser-only"); };
export const selectBundle = err;
export const getJsDelivrBundles = err;
export class VoidLogger {}
export class AsyncDuckDB {}
export default {};
`;
    },
  };
}

// قيم Supabase العامة (الرابط + المفتاح القابل للنشر publishable — تُضمَّن أصلاً في كل حزمة عميل).
// تُستخدم فقط إذا لم تُحقن VITE_SUPABASE_* وقت البناء (مثلاً بناء ناقص بعد نفاد رصيد Lovable)،
// فلا تنهار صفحة الدخول بشاشة بيضاء. أي قيمة حقيقية تُحقن تتغلّب عليها دائماً.
const SUPABASE_PUBLIC_FALLBACK = {
  VITE_SUPABASE_URL: "https://ioasnfijzadvlqurdbko.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ST65ooODcGQJkWuJyb0ygQ_nMkxQhnD",
} as const;

function supabasePublicFallback(): Plugin {
  return {
    name: "supabase-public-fallback",
    config(_config, { mode }) {
      const loaded = loadEnv(mode, process.cwd(), "VITE_");
      const define: Record<string, string> = {};
      for (const [name, value] of Object.entries(SUPABASE_PUBLIC_FALLBACK)) {
        if (!process.env[name] && !loaded[name]) {
          define[`import.meta.env.${name}`] = JSON.stringify(value);
        }
      }
      return Object.keys(define).length ? { define } : null;
    },
  };
}

export default defineConfig({
  vite: {
    // احتفظ بـVite dependency cache في مكان معروف داخل node_modules.
    // لا نستخدم force افتراضياً حتى لا نعيد bundling عند كل تشغيل.
    cacheDir: "node_modules/.vite",
    optimizeDeps: {
      // عند ظهور ملفات stale داخل .vite/deps شغّل الخادم مرة واحدة مع:
      // BASIRA_FORCE_VITE_OPTIMIZE=1 npm run dev -- --host 127.0.0.1 --port 5199
      force: process.env["BASIRA_FORCE_VITE_OPTIMIZE"] === "1",
      // TanStack Router يملك عدة entrypoints مترابطة؛ pre-bundling لها قد يترك
      // ملفات فرعية مفقودة بعد إعادة تشغيل Vite أو تغيير نسخة dependency.
      exclude: ["@tanstack/router-core", "@tanstack/history"],
    },
    plugins: [
      duckdbServerStub(),
      supabasePublicFallback(),
      // ملف الـ service worker يخص بناء العميل فقط، ويجب أن يُكتب حيث يخرج بناء العميل
      // (.output/public). افتراضياً كان يُكتب في dist/ فلا يُخدَّم، ويمسح dist/ فارغاً (precache = 0 ملف).
      ...VitePWA({
        outDir: ".output/public",
        registerType: "prompt",
        injectRegister: null,
        manifest: false,
        manifestFilename: "manifest.webmanifest",
        workbox: {
          // هيكل التطبيق فقط — لا تُخزَّن أي بيانات مستخدم.
          globPatterns: ["**/*.{js,css,html,svg,png,woff2,wasm}"],
          maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            // صفحات التطبيق تُرسم من السيرفر (SSR) فلا يوجد index.html ثابت في الـ precache.
            // NetworkFirst: دائماً أحدث نسخة عند الاتصال، وآخر نسخة محفوظة عند الانقطاع.
            // لا بيانات مستخدم في الـ HTML (البيانات تبقى في المتصفح).
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "basira-pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 20 },
              },
            },
            // محرك DuckDB المستضاف على المنصة (public/duckdb): أجزاء wasm + worker، يُحفظ بعد أول تحميل.
            {
              urlPattern: ({ url }) => url.pathname.startsWith("/duckdb/"),
              handler: "CacheFirst",
              options: {
                cacheName: "basira-duckdb-local",
                cacheableResponse: { statuses: [200] },
                expiration: { maxEntries: 8 },
              },
            },
            // محرك DuckDB (wasm + worker) يُحمَّل من jsDelivr: نحفظه بعد أول تحميل ليعمل دون اتصال.
            // الـ worker يُحمَّل بـ importScripts (no-cors) فيأتي opaque (status 0).
            {
              urlPattern: ({ url }) =>
                url.origin === "https://cdn.jsdelivr.net" &&
                url.pathname.includes("/@duckdb/duckdb-wasm"),
              handler: "CacheFirst",
              options: {
                cacheName: "basira-duckdb",
                cacheableResponse: { statuses: [0, 200] },
                expiration: { maxEntries: 8 },
              },
            },
            {
              urlPattern: ({ url }) => url.pathname.endsWith(".wasm"),
              handler: "CacheFirst",
              options: { cacheName: "basira-wasm", expiration: { maxEntries: 12 } },
            },
            {
              urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
              handler: "CacheFirst",
              options: { cacheName: "basira-fonts", expiration: { maxEntries: 24 } },
            },
          ],
        },
        devOptions: { enabled: false },
      }).map((plugin) => ({
        ...plugin,
        applyToEnvironment: (env: { name: string }) => env.name === "client",
      })),
    ],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
