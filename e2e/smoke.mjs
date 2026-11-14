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

    // Wait for the first source manifest write before starting another upload.
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
      return manifest?.sources?.some((source) => source.name === "مبيعات متجر إلكتروني.csv") ?? false;
    }, projectA, { timeout: 30_000 });

    // Open the data section; its compact dropzone is where additional sources are added.
    await page.locator('[data-tour-nav="data"] button').click();
    await page.getByText("مصادر هذا المشروع").waitFor({ state: "visible", timeout: 20_000 });
    const secondSourceId = await page.evaluate(async (projectId) => {
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
      return manifest.sources.find((source) => source.name === "order_segments.csv")?.id ?? "";
    }, projectA);
    const sourceCard = page.locator(`[data-mizya-source-id="${secondSourceId}"]`);
    await sourceCard.waitFor({ state: "visible", timeout: 20_000 });
    await sourceCard.locator("button").filter({ hasText: "البيانات" }).click();
    await page.locator(".basira-topbar").getByText("order_segments.csv").waitFor({ timeout: 20_000 });
    await sourceCard.waitFor({ state: "visible", timeout: 20_000 });
    await page.waitForFunction(async (sourceId) => {
      const module = await import("/src/lib/duckdb-service.ts");
      const sources = await module.duckdb.listSources();
      return sources.some((source) => source.alias.startsWith(`${sourceId}__`));
    }, secondSourceId, { timeout: 20_000 });
    check("يمكن تفعيل ورقة المصدر المحفوظ دون إعادة رفعه", !!secondSourceId && await sourceCard.isVisible());
    console.log("DEBUG source manager ID:", JSON.stringify({ projectA, secondSourceId }));
    // Remove the test-only derived JOIN view before deleting one of its source tables.
    await page.evaluate(async () => {
      const module = await import("/src/lib/duckdb-service.ts");
      await module.duckdb.query('DROP VIEW IF EXISTS "mizya_e2e_join"');
    });
    await sourceCard.getByRole("button", { name: "حذف" }).click();
    await sourceCard.getByRole("button", { name: "تأكيد الحذف" }).click();
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
      return manifest?.sources?.length === 1 &&
        manifest.sources.every((source) => source.name !== "order_segments.csv");
    }, projectA, { timeout: 20_000 });
    const cleanupState = await page.evaluate(async ({ projectId, sourceId }) => {
      const projectDb = await new Promise((resolve, reject) => {
        const request = indexedDB.open("mizya-projects", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const manifest = await new Promise((resolve, reject) => {
        const request = projectDb.transaction("projects", "readonly").objectStore("projects").get(projectId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      projectDb.close();
      const workspaceDb = await new Promise((resolve, reject) => {
        const request = indexedDB.open("basira-workspace", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const allKeys = await new Promise((resolve, reject) => {
        const request = workspaceDb.transaction("sessions", "readonly").objectStore("sessions").getAllKeys();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      workspaceDb.close();
      const module = await import("/src/lib/duckdb-service.ts");
      const aliases = await module.duckdb.listSources();
      return {
        sourceCount: manifest?.sources?.length ?? -1,
        payloadExists: allKeys.includes(`project-source:${projectId}:${sourceId}`),
        sourceAliases: aliases.filter((item) => item.alias.startsWith(`${sourceId}__`)).length,
        remainingAliases: aliases.length,\n        aliasNames: aliases.map((item) => item.alias),
      };
    }, { projectId: projectA, sourceId: secondSourceId });
    console.log("DEBUG source cleanup:", JSON.stringify(cleanupState));
    check("حذف المصدر يزيل وصفه من سجل المشروع", cleanupState.sourceCount === 1, JSON.stringify(cleanupState));
    check("حذف المصدر يزيل ملفه المحلي", !cleanupState.payloadExists, JSON.stringify(cleanupState));
    check("حذف المصدر يزيل جداول DuckDB التابعة له", cleanupState.sourceAliases === 0, JSON.stringify(cleanupState));
    check("يبقى المصدر الآخر متاحاً بعد الحذف", cleanupState.remainingAliases >= 1);
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

  // 3) Hybrid PDF: one page raster image plus vector ECharts artwork.
  {
    const page = await newPage(browser, { width: 1366, height: 800 });
    page.on("console", (message) => {
      if (message.text().includes("[pdf]")) console.log(message.text());
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    const result = await page.evaluate(async () => {
      const root = document.createElement("div");
      root.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;";
      const pdfPage = document.createElement("section");
      pdfPage.setAttribute("data-pdf-page", "");
      pdfPage.style.cssText = "position:relative;width:794px;height:1123px;background:#010A19;overflow:hidden;";
      const chartHost = document.createElement("div");
      chartHost.setAttribute("data-pdf-chart", "");
      chartHost.style.cssText = "position:absolute;left:120px;top:180px;width:320px;height:180px;";
      pdfPage.append(chartHost);
      root.append(pdfPage);
      document.body.append(root);

      const { registerReportChart } = await import("/src/lib/report-chart-export.ts");
      registerReportChart(chartHost, {
        animation: false,
        xAxis: { type: "category", data: ["A", "B", "C"] },
        yAxis: { type: "value" },
        series: [{ type: "bar", data: [4, 7, 2], itemStyle: { color: "#60F5D2" } }],
      });
      const { buildReportPdf } = await import("/src/lib/pdf-report.ts");
      const blob = await buildReportPdf(root);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let raw = "";
      for (const byte of bytes) raw += String.fromCharCode(byte);
      const imageObjects = (raw.match(/\/Subtype\s*\/Image/g) ?? []).length;

      // jsPDF compresses page content streams. Inflate them and verify that
      // svg2pdf emitted actual PDF path operators, not merely a second image.
      const streamMatches = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];
      const decodedStreams = [];
      for (const match of streamMatches) {
        const binary = match[1] ?? "";
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0) & 0xff);
        try {
          const decompressed = await new Response(
            new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate")),
          ).arrayBuffer();
          decodedStreams.push(new TextDecoder().decode(decompressed));
        } catch {
          decodedStreams.push(binary);
        }
      }
      const content = decodedStreams.join("\n");
      const vectorPathOperators = (content.match(/(?:^|\s)(?:m|l|c|h|re)\s+-?\d/g) ?? []).length;
      root.remove();
      return { size: blob.size, header: raw.startsWith("%PDF-"), imageObjects, vectorPathOperators };
    });
    check(
      "تصدير PDF هجين: صورة الصفحة مع رسم Vector",
      result.header && result.size > 1000 && result.imageObjects === 1 && result.vectorPathOperators > 0,
      JSON.stringify(result),
    );
    await page.close();
  }

  // 4) فشل تحميل المحرك: رسالة واضحة بدل تعليق دائم
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
