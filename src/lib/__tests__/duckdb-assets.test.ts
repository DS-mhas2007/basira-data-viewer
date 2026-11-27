import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dir = "public/duckdb";
const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8")) as {
  version: string;
  size: number;
  sha256: string;
  parts: string[];
};

describe("self-hosted duckdb assets", () => {
  it("matches the installed package version", () => {
    const pkg = JSON.parse(readFileSync("node_modules/@duckdb/duckdb-wasm/package.json", "utf8"));
    expect(manifest.version).toBe(pkg.version);
  });
  it("keeps every file under the static-host limit", () => {
    for (const p of manifest.parts)
      expect(statSync(`${dir}/${p}`).size).toBeLessThan(20 * 1024 * 1024);
  });
  it("parts concatenate to the declared size and hash", () => {
    const all = Buffer.concat(manifest.parts.map((p) => readFileSync(`${dir}/${p}`)));
    expect(all.length).toBe(manifest.size);
    expect(createHash("sha256").update(all).digest("hex")).toBe(manifest.sha256);
  });
  it("ships the worker", () => expect(existsSync(`${dir}/duckdb-browser-eh.worker.js`)).toBe(true));
});
