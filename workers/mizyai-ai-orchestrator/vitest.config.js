import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const workerRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: workerRoot,
  test: {
    environment: "node",
    globals: true,
    setupFiles: [],
    include: ["./worker.test.js"],
  },
});
