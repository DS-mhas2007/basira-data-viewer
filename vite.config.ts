// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Keep duckdb-wasm isolated in its own chunk. When it gets merged with shared
// vendor code (tslib), its browser-only top-level `Worker` access is evaluated
// during SSR and crashes the published page with "Worker is not defined".
const duckdbChunking = {
  rollupOptions: {
    output: {
      advancedChunks: {
        groups: [
          {
            name: "duckdb-wasm",
            test: /[\\/]node_modules[\\/]@duckdb[\\/]duckdb-wasm[\\/]/,
            priority: 1000,
          },
        ],
      },
    },
  },
};

export default defineConfig({
  vite: {
    build: duckdbChunking,
    environments: {
      client: { build: duckdbChunking },
      ssr: { build: duckdbChunking },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
