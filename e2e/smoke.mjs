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

    // MIZYA project controls: create two projects and switch between them.
    const projectSelect = page.getByRole("combobox", { name: "المشروع النشط" });
    await projectSelect.waitFor({ timeout: 20_000 });
    check("مساحة المشاريع تظهر في الواجهة", await projectSelect.isVisible());
    await page.getByRole("textbox", { name: "اسم المشروع الجديد" }).fill("MIZYA E2E Project A");
    await page.getByRole("button", { name: "إنشاء" }).click();
    await projectSelect.selectOption({ label: "MIZYA E2E Project A" });
    const projectA = await projectSelect.inputValue();
    await page.getByRole("textbox", { name: "اسم المشروع الجديد" }).fill("MIZYA E2E Project B");
    await page.getByRole("button", { name: "إنشاء" }).click();
    await projectSelect.selectOption({ label: "MIZYA E2E Project B" });
    await projectSelect.selectOption(projectA);
    check("إنشاء المشاريع والتبديل بينها", await projectSelect.inputValue() === projectA);

    await page.getByText("مبيعات متجر إلكتروني").first().click();
    await page.getByRole("button", { name: "سجل المصدر" }).click();
    // بعد انتهاء التسجيل تتحول الرئيسية إلى مساحة الاكتشاف
    const next = page.getByText("بياناتك أصبحت مساحة للاكتشاف.").first();
    await next.waitFor({ timeout: 90_000 }).catch(() => {});
    await page.screenshot({ path: process.env.SHOT ?? "/tmp/shot.png" });
    const discoveryVisible = await next.isVisible();
    if (!discoveryVisible) {
      const headings = await page.locator("h1").evaluateAll((nodes) =>
        nodes.map((node) => ({ text: node.textContent?.trim(), visible: node.getBoundingClientRect().width > 0 })),
      );
      console.log("DEBUG discovery headings:", JSON.stringify(headings));
    }
    check("بعد التسجيل تظهر الرئيسية بحالة «بياناتك أصبحت مساحة للاكتشاف»", discoveryVisible);
    check(
      "عدد الصفوف المحمّلة 10,000 في بطاقة الإحصاء",
      await page.getByText(/^10,000$/).first().isVisible().catch(() => false),
    );

    // 1b) Upload a second independent CSV into project A.
    const secondCsv = Buffer.from(
      "order_id,customer_segment\nORD-00001,enterprise\nORD-00002,consumer\n",
      "utf8",
    );
    await page.locator('#basira-dropzone input[type="file"]').setInputFiles({
      name: "order_segments.csv",
      mimeType: "text/csv",
      buffer: secondCsv,
    });
    const aliasInput = page.locator(".fixed input").last();
    await aliasInput.waitFor({ timeout: 20_000 });
    await aliasInput.fill("order_segments");
    await page.getByRole("button", { name: "سجل المصدر" }).last().click();
    await page.getByRole("button", { name: "سجل المصدر" }).last().waitFor({ state: "detached", timeout: 30_000 }).catch(() => {});

    // Wait for the asynchronous parent callback to persist the second source descriptor.
    await page.waitForFunction(async (projectId) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("mizya-projects", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const manifest = await new Promise((resolve, reject) => {
        const request = db.transaction("projects", "readonly").objectStore("projects").get(projectId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return manifest?.sources?.length === 2;
    }, projectA, { timeout: 30_000 });

    // Read the local manifest to prove that both source descriptors are independent.
    const manifestState = await page.evaluate(async (projectId) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("mizya-projects", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const manifest = await new Promise((resolve, reject) => {
        const request = db.transaction("projects", "readonly").objectStore("projects").get(projectId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return { sources: manifest?.sources?.map((source) => source.name) ?? [] };
    }, projectA);
    check("حُفظ مصدران مستقلان في سجل المشروع", manifestState.sources.length === 2, JSON.stringify(manifestState));

    // Switch away and back; no source from A may remain visible inside B.
    await projectSelect.selectOption({ label: "MIZYA E2E Project B" });
    await page.waitForFunction(async () => {
      const module = await import("/src/lib/duckdb-service.ts");
      return (await module.duckdb.listSources()).length === 0;
    }, { timeout: 30_000 });
    const emptyProjectSources = await page.evaluate(async () => {
      const module = await import("/src/lib/duckdb-service.ts");
      return (await module.duckdb.listSources()).length;
    });
    check("لا تتسرّب مصادر المشروع A إلى المشروع B", emptyProjectSources === 0, `sources=${emptyProjectSources}`);

    await projectSelect.selectOption(projectA);
    await page.waitForFunction(async () => {
      const module = await import("/src/lib/duckdb-service.ts");
      return (await module.duckdb.listSources()).length === 2;
    }, { timeout: 60_000 });
    const joinResult = await page.evaluate(async (projectId) => {
      const module = await import("/src/lib/duckdb-service.ts");
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("mizya-projects", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const manifest = await new Promise((resolve, reject) => {
        const request = db.transaction("projects", "readonly").objectStore("projects").get(projectId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      const sourceIds = manifest?.sources?.map((source) => source.id) ?? [];
      const sources = await module.duckdb.listSources();
      const projectSources = sources.filter((source) =>
        sourceIds.some((id) => source.alias.startsWith(`${id}__`)),
      );
      const left = projectSources.find((source) =>
        source.info.rowCount === 10_000 && source.info.schema.some((column) => column.name === "order_id"),
      );
      const right = projectSources.find((source) =>
        source.info.rowCount === 2 && source.info.schema.some((column) => column.name === "customer_segment"),
      );
      if (!left || !right) return { sourceCount: projectSources.length, joined: false };
      const joined = await module.duckdb.createJoin({
        leftAlias: left.alias,
        rightAlias: right.alias,
        leftOn: "order_id",
        rightOn: "order_id",
        joinType: "inner",
        viewName: "mizya_e2e_join",
      });
      return { sourceCount: projectSources.length, joined: true, rowCount: joined.rowCount };
    }, projectA);
    check(
      "استُعيد المصدران بعد التبديل ونُفّذ JOIN بينهما",
      joinResult.joined && joinResult.sourceCount === 2 && joinResult.rowCount === 2,
      JSON.stringify(joinResult),
    );
    await page.close();
  }

  // 2) الجوال: لا تمرير أفقي
  {
    const page = await newPage(browser, { width: 390, height: 844 });
    await page.goto(BASE, { waitUntil: "networkidle" });
    const overflowInfo = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      const offenders = Array.from(document.querySelectorAll("body *"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            id: element.id || undefined,
            className: typeof element.className === "string" ? element.className.slice(0, 120) : undefined,
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
          };
        })
        .filter((item) => item.width > 0 && item.right > viewport + 1)
        .sort((a, b) => b.right - a.right)
        .slice(0, 12);
      return {
        overflow: document.documentElement.scrollWidth - viewport,
        offenders,
      };
    });
    const over = overflowInfo.overflow;
    if (over > 0) console.log("DEBUG mobile overflow offenders:", JSON.stringify(overflowInfo.offenders));
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
