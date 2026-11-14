# Hybrid PDF export architecture

## Status

- Current PDF implementation remains full-page PNG rasterization through `html-to-image` and `jsPDF.addImage`.
- Arabic text, mixed RTL/LTR content, tables, and DOM layout remain on the raster path.
- Report charts now opt in to export registration; their original ECharts option objects are held in a `WeakMap`, preserving formatter functions without serializing options into DOM attributes.
- ECharts SVG generation is available through its server-side renderer; vector PDF composition is **not yet implemented**.

## Target output

1. Capture each complete report page as PNG at the existing 2x scale, preserving Arabic shaping and layout.
2. Temporarily hide registered report chart hosts during the base-page capture and restore their prior visibility in a `finally` block.
3. Render each registered chart with `renderEChartsSvg(option, { width, height })` using ECharts 5.6.0 SSR SVG mode and the exact original option object.
4. Convert SVG to PDF vector paths with `svg2pdf.js`, positioned over the measured chart rectangle.
5. If an individual SVG render or conversion fails, rasterize that chart region and insert it as PNG. A chart failure must not fail an otherwise valid report export.

## Component and registry contract

- Only report charts explicitly marked with `pdfExport` are registered.
- `report-chart-export.ts` stores the original option in a `WeakMap` keyed by the chart host. This preserves function-valued formatters and avoids large or sensitive DOM attributes.
- Export descriptors include the host, original option, and measured CSS-pixel dimensions. Invalid or unmounted dimensions are excluded.
- Chart data and calculations remain sourced from the existing DuckDB/report pipeline; export must not recompute or alter them.

## SVG renderer

- Use ECharts SSR with `renderer: "svg"`, `ssr: true`, and explicit dimensions.
- Disable animation for deterministic export.
- Dispose the temporary ECharts instance in `finally`.
- Validate SVG output before passing it to the PDF converter.

## PDF composition

- Load `svg2pdf.js` only in the browser export path; its conversion API requires a real DOM and is not supported by JSDOM.
- Convert page-relative CSS pixel coordinates to jsPDF points using `A4_W / PAGE_W` and `A4_H / PAGE_H`.
- Keep page order, page count, and Arabic-safe PNG fallback unchanged.
- Do not use SVG-as-image APIs that rasterize vector artwork.

## Dependency and test requirements

- Add `svg2pdf.js` only together with regenerated `bun.lock` and `package-lock.json`; CI uses `bun install --frozen-lockfile`.
- Do not hand-edit lockfile resolutions or integrity hashes.
- Unit-test registry lifecycle, SVG extraction, dimensions, coordinate conversion, fallback behavior, and cleanup.
- Keep PDF composition tests separate from JSDOM-incompatible `svg2pdf.js` integration tests.
- Add a browser E2E test that exports a report with at least one chart and verifies a valid PDF.
- Inspect the resulting PDF for Arabic shaping, chart alignment, clipping, page boundaries, and actual vector drawing commands before declaring Hybrid complete.

## Acceptance criteria

- Arabic body text and tables render identically to the current raster export.
- At least one report chart is represented by vector PDF drawing commands, not an embedded raster image.
- Failed SVG conversion falls back safely without losing the report or producing a partial document.
- Typecheck, Vitest, build, and browser E2E all pass.
