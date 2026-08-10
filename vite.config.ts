// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

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

export default defineConfig({
  vite: {
    plugins: [duckdbServerStub()],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
