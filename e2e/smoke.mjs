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

    // Export a real report from the loaded workspace without invoking AI.
    const exportTrigger = page.locator('[data-tour="export"]');
    await exportTrigger.waitFor({ state: "visible", timeout: 30_000 });
    await exportTrigger.click();
    await page.getByRole("menuitem").filter({ hasText: "تقرير مخصص" }).click();
    await page.getByRole("checkbox", { name: "صفحات الاستنتاجات" }).uncheck();
    await page.getByRole("checkbox", { name: "مصفوفة التوصيات" }).uncheck();
    await page.getByRole("button", { name: "توليد التقرير" }).click();
    const reportRoot = page.locator("#basira-report-root");
    await reportRoot.waitFor({ state: "visible", timeout: 30_000 });
    const reportVisual = await reportRoot.evaluate((root) => {
      const pages = Array.from(root.querySelectorAll("[data-pdf-page]"));
      return {
        pageCount: pages.length,
        coverBackground: pages[0] ? getComputedStyle(pages[0]).backgroundColor : "",
        paperBackground: pages[1] ? getComputedStyle(pages[1]).backgroundColor : "",
        coverHasWordmark: pages[0]?.textContent?.includes("MIZYA") ?? false,
        coverText: pages[0] ? getComputedStyle(pages[0]).color : "",
        coverScoreColor: pages[0]?.querySelector("[data-pdf-cover-score]")
          ? getComputedStyle(pages[0].querySelector("[data-pdf-cover-score]")).color
          : "",
      };
    });
    check(
      "معاينة التقرير الفعلية تستخدم غلاف MIZYA الداكن وصفحات الورق الدافئ",
      reportVisual.pageCount >= 3 &&
        reportVisual.coverBackground === "rgb(28, 41, 48)" &&
        reportVisual.paperBackground === "rgb(241, 237, 226)" &&
        reportVisual.coverHasWordmark &&
        reportVisual.coverText === "rgb(241, 237, 226)" &&
        reportVisual.coverScoreColor === "rgb(141, 223, 208)",
      JSON.stringify(reportVisual),
    );
    const [reportDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "تنزيل PDF" }).click(),
    ]);
    const reportPath = await reportDownload.path();
    await reportDownload.saveAs("/tmp/mizya-report-e2e.pdf");
    await reportRoot.locator("[data-pdf-page]").nth(0).screenshot({ path: "/tmp/mizya-report-cover.png" });
    await reportRoot.locator("[data-pdf-page]").nth(1).screenshot({ path: "/tmp/mizya-report-page-02.png" });
    const reportBytes = await readFile(reportPath);
    const reportRaw = reportBytes.toString("latin1");
    const reportPageCount = (reportRaw.match(/\/Type\s*\/Page\b/g) ?? []).length;
    check(
      "تنزيل تقرير MIZYA متعدد الصفحات من المعاينة",
      reportDownload.suggestedFilename().startsWith("تقرير-MIZYA-") &&
        reportRaw.startsWith("%PDF-") &&
        reportBytes.length > 1000 &&
        reportPageCount >= 3,
      JSON.stringify({
        filename: reportDownload.suggestedFilename(),
        size: reportBytes.length,
        pageCount: reportPageCount,
      }),
    );
    await page.getByRole("button", { name: "إغلاق" }).click();

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
    await page.locator("#basira-dropzone").waitFor({ state: "visible", timeout: 20_000 });

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
    const aliasDialog = page.locator(".fixed").filter({ hasText: "سجل مصدر البيانات" }).last();
    check("نافذة تسجيل المصدر الثاني ظاهرة", await aliasDialog.isVisible());
    check("اسم المصدر الثاني مضبوط", await aliasDialog.locator("input").first().inputValue() === "order_segments");
    await aliasDialog.getByRole("button", { name: "سجل المصدر" }).click();
    await aliasDialog.waitFor({ state: "detached", timeout: 30_000 }).catch(() => {});

    // Wait for the parent upload callback to finish parsing and persist its source descriptor.
    await page.locator(".basira-topbar").getByText("order_segments.csv").waitFor({ timeout: 30_000 }).catch(() => {});
    check(
      "الملف الثاني وصل إلى مساحة العمل",
      await page.locator(".basira-topbar").getByText("order_segments.csv").isVisible().catch(() => false),
    );
    // The top bar updates before the async parent persistence finishes. The data
    // dropzone remounts only after handleFile has completed its manifest write.
    await page.locator("#basira-dropzone").waitFor({ state: "visible", timeout: 30_000 });
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
      return manifest?.sources?.length === 2 &&
        manifest.sources.some((source) => source.name === "مبيعات متجر إلكتروني.csv") &&
        manifest.sources.some((source) => source.name === "order_segments.csv");
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
    // Wait for the project restore to finish; an empty source list immediately
    // after clearSources() is not proof that the switch has completed.
    await page.locator("#basira-dropzone").waitFor({ state: "visible", timeout: 30_000 });
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
    await page.locator(".basira-topbar").getByText("مبيعات متجر إلكتروني.csv").waitFor({ timeout: 60_000 });
    await page.waitForFunction(async () => {
      const module = await import("/src/lib/duckdb-service.ts");
      return (await module.duckdb.listSources()).length >= 2;
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

    // Exercise source activation and deletion only after multi-source restore + JOIN.
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
    await page.waitForFunction((sourceId) => {
      const card = document.querySelector(`[data-mizya-source-id="${sourceId}"]`);
      return !!card?.querySelector('button[aria-pressed="true"]');
    }, secondSourceId, { timeout: 20_000 });
    await sourceCard.waitFor({ state: "visible", timeout: 20_000 });
    check("يمكن تفعيل ورقة المصدر المحفوظ دون إعادة رفعه", !!secondSourceId && await sourceCard.isVisible());
    // Remove the test-only derived JOIN view before deleting one of its source tables.
    await page.evaluate(async () => {
      const module = await import("/src/lib/duckdb-service.ts");
      await module.duckdb.query('DROP VIEW IF EXISTS "mizya_e2e_join"');
    });
    await sourceCard.getByRole("button", { name: "حذف" }).click();
    await sourceCard.getByRole("button", { name: "تأكيد الحذف" }).click();
    await sourceCard.waitFor({ state: "detached", timeout: 20_000 });
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
        remainingAliases: aliases.length,
        aliasNames: aliases.map((item) => item.alias),
      };
    }, { projectId: projectA, sourceId: secondSourceId });
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

  // 3) Hybrid PDF: warm-paper page raster, Latin vector chart, Arabic chart raster fallback.
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
      pdfPage.style.cssText = "position:relative;width:794px;height:1123px;background:#F1EDE2;overflow:hidden;";
      const latinHost = document.createElement("div");
      latinHost.setAttribute("data-pdf-chart", "");
      latinHost.style.cssText = "position:absolute;left:70px;top:180px;width:300px;height:180px;";
      const arabicHost = document.createElement("div");
      arabicHost.setAttribute("data-pdf-chart", "");
      arabicHost.style.cssText = "position:absolute;left:420px;top:180px;width:300px;height:180px;";
      pdfPage.append(latinHost, arabicHost);
      root.append(pdfPage);
      document.body.append(root);

      const latinOption = {
        animation: false,
        xAxis: { type: "category", data: ["A", "B", "C"] },
        yAxis: { type: "value" },
        series: [{ type: "bar", data: [4, 7, 2], itemStyle: { color: "#28796F" } }],
      };
      const arabicOption = {
        animation: false,
        xAxis: { type: "category", data: ["مبيعات", "أرباح", "عملاء"] },
        yAxis: { type: "value" },
        series: [{ type: "bar", data: [8, 5, 3], itemStyle: { color: "#725B88" } }],
      };
      // The Arabic chart host represents an already-rendered ECharts surface.
      // Its visible labels exercise the chart-only PNG fallback while SSR SVG
      // generation below still uses the registered original ECharts option.
      arabicHost.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180">' +
        '<rect x="24" y="22" width="54" height="108" rx="7" fill="#D9C5F1"/>' +
        '<rect x="112" y="58" width="54" height="72" rx="7" fill="#D9C5F1"/>' +
        '<rect x="200" y="82" width="54" height="48" rx="7" fill="#D9C5F1"/>' +
        '<g fill="#1C2930" font-size="12" text-anchor="middle">' +
        '<text x="51" y="151">مبيعات</text><text x="139" y="151">أرباح</text><text x="227" y="151">عملاء</text>' +
        '</g></svg>';

      const { registerReportChart } = await import("/src/lib/report-chart-export.ts");
      registerReportChart(latinHost, latinOption);
      registerReportChart(arabicHost, arabicOption);
      const { buildReportPdf } = await import("/src/lib/pdf-report.ts");
      try {
        const blob = await buildReportPdf(root);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let raw = "";
        for (const byte of bytes) raw += String.fromCharCode(byte);
        const imageObjects = (raw.match(/\/Subtype\s*\/Image/g) ?? []).length;

        // jsPDF compresses page content streams. Inflate them and verify that
        // svg2pdf emitted actual PDF path operators, not merely another image.
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
        return {
          size: blob.size,
          header: raw.startsWith("%PDF-"),
          imageObjects,
          vectorPathOperators,
        };
      } finally {
        root.remove();
      }
    });
    check(
      "تصدير PDF بهوية MIZYA: صفحة ورقية + رسم لاتيني Vector + رسم عربي Raster",
      result.header && result.size > 1000 && result.imageObjects === 2 && result.vectorPathOperators > 0,
      JSON.stringify(result),
    );
    await page.close();
  }

  // 3b) Dense, deterministic ReportDocument fixture: multi-page Arabic tables + Latin/Arabic charts.
  // This exercises the real report component and export registry without an external AI call.
  {
    const page = await newPage(browser, { width: 1366, height: 900 });
    await page.goto(BASE, { waitUntil: "networkidle" });

    await page.evaluate(async () => {
      const { mountDenseReportFixture } = await import("/e2e/fixtures/dense-report.tsx");
      const shell = document.createElement("div");
      shell.id = "mizya-dense-pdf-fixture";
      shell.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;pointer-events:none;";
      document.body.appendChild(shell);
      window.__mizyaDensePdfRoot = mountDenseReportFixture(shell);
    });

    await page.waitForFunction(() => {
      const root = document.querySelector("#mizya-dense-pdf-fixture");
      return root &&
        root.querySelectorAll("[data-pdf-page]").length >= 12 &&
        root.querySelectorAll("[data-pdf-chart] canvas").length >= 2;
    }, { timeout: 60_000 });

    const [denseDownload, result] = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      page.evaluate(async () => {
        const root = document.querySelector("#mizya-dense-pdf-fixture");
        if (!root) throw new Error("dense-report-root-missing");

        const pages = Array.from(root.querySelectorAll("[data-pdf-page]"));
        const chartHosts = Array.from(root.querySelectorAll("[data-pdf-chart]"));
        const pageDiagnostics = pages.map((reportPage) => {
          const content = reportPage.firstElementChild;
          return {
            title: reportPage.getAttribute("data-section-title"),
            contentHeight: content?.clientHeight ?? 0,
            contentScrollHeight: content?.scrollHeight ?? 0,
          };
        });

        const { buildReportPdf, downloadPdfBlob } = await import("/src/lib/pdf-report.ts");
        const blob = await buildReportPdf(root);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let raw = "";
        for (const byte of bytes) raw += String.fromCharCode(byte);
        const imageObjects = (raw.match(/\/Subtype\s*\/Image/g) ?? []).length;
        const streamMatches = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];
        const decodedStreams = [];
        for (const match of streamMatches) {
          const binary = match[1] ?? "";
          const streamBytes = Uint8Array.from(binary, (character) => character.charCodeAt(0) & 0xff);
          try {
            const decompressed = await new Response(
              new Blob([streamBytes]).stream().pipeThrough(new DecompressionStream("deflate")),
            ).arrayBuffer();
            decodedStreams.push(Array.from(new Uint8Array(decompressed), (byte) => String.fromCharCode(byte)).join(""));
          } catch {
            // Ignore non-Flate streams; the vector path check inspects decoded content streams.
          }
        }
        const decodedContent = decodedStreams.join("\n");
        const vectorPathOperators = (decodedContent.match(/(?:^|\s)(?:m|l|c|h|re)\s+-?\d/g) ?? []).length;
        const pdfPageCount = (raw.match(/\/Type\s*\/Page\b/g) ?? []).length;

        downloadPdfBlob(blob, "تقرير-MIZYA-Dense-QA.pdf");
        return {
          header: raw.startsWith("%PDF-"),
          size: blob.size,
          pageCount: pdfPageCount,
          domPageCount: pages.length,
          chartCount: chartHosts.length,
          chartCanvasCount: root.querySelectorAll("[data-pdf-chart] canvas").length,
          imageObjects,
          vectorPathOperators,
          contentOverflowPages: pageDiagnostics.filter((item) => item.contentScrollHeight > item.contentHeight + 3).map((item) => item.title),
          sectionTitles: pageDiagnostics.map((item) => item.title),
          latinChartPresent: chartHosts.length >= 2,
        };
      }),
    ]);

    const densePdfPath = await denseDownload.path();
    await denseDownload.saveAs("/tmp/mizya-report-dense-e2e.pdf");
    const densePdfBytes = await readFile(densePdfPath);
    const denseRaw = densePdfBytes.toString("latin1");
    const densePageCount = (denseRaw.match(/\/Type\s*\/Page\b/g) ?? []).length;
    await page.evaluate(() => {
      const fixture = document.querySelector("#mizya-dense-pdf-fixture");
      if (fixture) {
        fixture.style.position = "absolute";
        fixture.style.left = "0";
        fixture.style.top = "0";
        fixture.style.zIndex = "9999";
      }
    });
    const denseCover = page.locator('#mizya-dense-pdf-fixture [data-section-title="الغلاف"]');
    await denseCover.screenshot({ path: "/tmp/mizya-report-dense-cover.png" });
    const chartPage = page.locator('#mizya-dense-pdf-fixture [data-section-title="الاستنتاج 1"]');
    await chartPage.screenshot({ path: "/tmp/mizya-report-dense-chart-page.png" });

    check(
      "تقرير MIZYA تحليلي كثيف يُرسم من ReportDocument الحقيقي",
      result.header &&
        result.size > 20_000 &&
        result.domPageCount >= 12 &&
        result.pageCount === result.domPageCount &&
        result.chartCount === 2 &&
        result.chartCanvasCount === 2,
      JSON.stringify(result),
    );
    check(
      "تصدير كثيف يحافظ على الرسوم: Latin Vector + Arabic Raster fallback",
      result.imageObjects === result.pageCount + 1 && result.vectorPathOperators > 0,
      JSON.stringify({
        pages: result.pageCount,
        images: result.imageObjects,
        vectorPathOperators: result.vectorPathOperators,
      }),
    );
    check(
      "لا يوجد تجاوز رأسي في حاويات صفحات التقرير الطويل",
      result.contentOverflowPages.length === 0,
      JSON.stringify(result.contentOverflowPages),
    );
    check(
      "تنزيل PDF كثيف متعدد الصفحات وحفظ لقطات QA",
      denseDownload.suggestedFilename() === "تقرير-MIZYA-Dense-QA.pdf" &&
        denseRaw.startsWith("%PDF-") &&
        densePdfBytes.length > 20_000 &&
        densePageCount >= 12,
      JSON.stringify({
        filename: denseDownload.suggestedFilename(),
        size: densePdfBytes.length,
        pageCount: densePageCount,
      }),
    );

    await page.evaluate(() => {
      window.__mizyaDensePdfRoot?.unmount();
      document.querySelector("#mizya-dense-pdf-fixture")?.remove();
    });
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
