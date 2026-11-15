// فحص إمكانية الوصول (axe-core) على الصفحات الرئيسية — يفشل عند مخالفة critical/serious فقط.
// التشغيل: AXE_PATH=/path/to/axe.min.js BASE_URL=http://127.0.0.1:5199 node e2e/a11y.mjs
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:5199";
const AXE = await readFile(process.env.AXE_PATH ?? "node_modules/axe-core/axe.min.js", "utf8");
const DIST = path.resolve("node_modules/@duckdb/duckdb-wasm/dist");
const CDN = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@duckdb\/duckdb-wasm@[^/]+\/dist\/(.+)$/;

const browser = await chromium.launch();
let failed = 0;

async function run(label, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem("basira-tour-v1", "done");
    } catch {}
  });
  await page.route(CDN, async (r) => {
    const n = CDN.exec(r.request().url())[1];
    r.fulfill({
      body: await readFile(path.join(DIST, n)),
      contentType: n.endsWith(".wasm") ? "application/wasm" : "text/javascript",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());

  async function scan(name) {
    await page.evaluate(AXE);
    const res = await page.evaluate(() =>
      axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "best-practice"] }),
    );
    const bad = res.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    const minor = res.violations.length - bad.length;
    console.log(`${bad.length ? "FAIL" : "PASS"}  a11y ${label}/${name}${minor ? `  (+${minor} minor)` : ""}`);
    for (const v of bad) {
      failed++;
      console.log(`  [${v.impact}] ${v.id} x${v.nodes.length} — ${v.help}`);
      for (const n of v.nodes.slice(0, 3)) console.log(`     ${n.target.join(" ")}`);
    }
  }

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await scan("home");
  await page.getByText("مبيعات متجر إلكتروني").first().click();
  await page.getByRole("button", { name: "سجل المصدر" }).click({ timeout: 30000 }).catch(() => {});
  await page.getByText("بياناتك أصبحت مساحة للاكتشاف.").first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(1000);
  await scan("discovery");
  if (viewport.width > 700) {
    for (const name of ["جودة البيانات", "التحليل"]) {
      await page.getByText(name, { exact: true }).first().click();
      await page.waitForTimeout(1500);
      await scan(name);
    }
  }
  await ctx.close();
}

await run("desktop", { width: 1366, height: 900 });
await run("mobile", { width: 390, height: 844 });
await browser.close();
process.exit(failed ? 1 : 0);
