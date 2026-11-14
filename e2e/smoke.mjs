/**
 * اختبار دخاني (e2e) لمسار: فتح الموقع → تحميل بيانات تجريبية → ظهور الأرقام.
 * يخدم ملفات DuckDB من node_modules بدل الـ CDN، فلا يحتاج إنترنت.
 *
 * التشغيل:
 *   npm i --no-save playwright && npx playwright install chromium
 *   npx vite dev --host 127.0.0.1 --port 5199 &
 *   BASE_URL=http://127.0.0.1:5199 node e2e/smoke.mjs
 */
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:5199";
const DIST = path.resolve("node_modules/@duckdb/duckdb-wasm/dist");
const CDN = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@duckdb\/duckdb-wasm@[^/]+\/dist\/(.+)$/;

let failed = 0;
function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`);
  if (!ok) failed++;
}

async function newPage(browser, viewport, { blockCdn = false } = {}) {
  const ctx = await browser.newContext({ viewport, locale: "ar" });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem("basira-tour-v1", "done");
    } catch {
      /* تجاهل */
    }
  });
  await page.route(CDN, async (route) => {
    if (blockCdn) return route.abort();
    const file = CDN.exec(route.request().url())[1];
    try {
      const body = await readFile(path.join(DIST, file));
      await route.fulfill({
        body,
        contentType: file.endsWith(".wasm") ? "application/wasm" : "text/javascript",
        headers: { "access-control-allow-origin": "*" },
      });
    } catch {
      await route.abort();
    }
  });
  // الخطوط الخارجية غير ضرورية للاختبار
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  return page;
}

const browser = await chromium.launch();
try {
  // 1) المسار الأساسي على الكمبيوتر
  {
    const page = await newPage(browser, { width: 1366, height: 800 });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByText("مبيعات متجر إلكتروني").first().click();
    await page.getByRole("button", { name: "سجل المصدر" }).click();
    // بعد انتهاء التسجيل تتحول الرئيسية إلى مساحة الاكتشاف
    const next = page.getByText("بياناتك أصبحت مساحة للاكتشاف.").first();
    await next.waitFor({ timeout: 90_000 }).catch(() => {});
    await page.screenshot({ path: process.env.SHOT ?? "/tmp/shot.png" });
    const discoveryVisible = await next.isVisible();
    if (!discoveryVisible) {
      const headings = await page.locator("h1").evaluateAll((nodes) =>
        nodes.map((node) => ({ text: node.textContent?.trim(), visible: !!(node as HTMLElement).offsetWidth })),
      );
      console.log("DEBUG discovery headings:", JSON.stringify(headings));
    }
    check("بعد التسجيل تظهر الرئيسية بحالة «بياناتك أصبحت مساحة للاكتشاف»", discoveryVisible);
    check(
      "عدد الصفوف المحمّلة 10,000 في بطاقة الإحصاء",
      await page.getByText(/^10,000$/).first().isVisible().catch(() => false),
    );
    await page.close();
  }

  // 2) الجوال: لا تمرير أفقي
  {
    const page = await newPage(browser, { width: 390, height: 844 });
    await page.goto(BASE, { waitUntil: "networkidle" });
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check("لا تمرير أفقي على الجوال", over <= 0, `overflow=${over}px`);
    await page.close();
  }

  // 3) فشل تحميل المحرك: رسالة واضحة بدل تعليق دائم
  {
    const page = await newPage(browser, { width: 1366, height: 800 }, { blockCdn: true });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByText("مبيعات متجر إلكتروني").first().click();
    await page.getByRole("button", { name: "سجل المصدر" }).click();
    const msg = page.getByText("تعذّر تحميل محرك التحليل").first();
    await msg.waitFor({ timeout: 30_000 }).catch(() => {});
    check("رسالة واضحة عند فشل تحميل المحرك", await msg.isVisible());
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
