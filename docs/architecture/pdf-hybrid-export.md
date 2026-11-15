# Hybrid PDF export architecture

## Implementation status

- PDF page backgrounds, Arabic body text, mixed RTL/LTR content, and tables are captured as PNG to preserve browser text shaping and layout.
- Report charts opt in to export registration. Their original ECharts options are stored in a `WeakMap`, preserving formatter functions without placing large or sensitive values in DOM attributes.
- Charts are rendered to standalone SVG with ECharts 5.6.0 SSR and converted to PDF vector drawing commands with `svg2pdf.js` 2.7.0.
- Charts whose SVG contains Arabic glyphs use a chart-only PNG fallback because jsPDF's standard font path cannot guarantee Arabic shaping.
- A chart conversion failure falls back to a PNG of that chart; it does not invalidate the report.

## Export pipeline

1. Collect registered chart hosts and measure their page-relative CSS-pixel rectangles.
2. Temporarily hide chart hosts and capture each complete report page at 2x resolution.
3. Restore chart visibility in a `finally` block.
4. Render each chart from its original ECharts option using SSR SVG mode with explicit dimensions and animation disabled.
5. Convert the SVG to vector PDF paths at the measured A4 point coordinates.
6. Use a chart-only PNG when the SVG contains Arabic text or rendering/conversion fails.

## Component and registry contract

- Only report charts explicitly marked with `pdfExport` are registered.
- `report-chart-export.ts` stores the original option in a `WeakMap` keyed by the chart host. This preserves function-valued formatters and avoids large or sensitive DOM attributes.
- Export descriptors include the host, original option, and measured CSS-pixel dimensions. Invalid or unmounted dimensions are excluded.
- Chart data and calculations remain sourced from the existing DuckDB/report pipeline; export does not recompute or alter them.

## SVG renderer

- Use ECharts SSR with `renderer: "svg"`, `ssr: true`, and explicit dimensions.
- Disable animation for deterministic export.
- Dispose the temporary ECharts instance in `finally`.
- Validate SVG output before passing it to the PDF converter.

## PDF composition

- `svg2pdf.js` is loaded only when a report contains registered charts.
- SVG nodes are attached temporarily to the document while conversion reads computed styles and viewport metrics.
- Page-relative coordinates are converted using the actual rendered page rectangle, so CSS scaling in the report preview is respected.
- Keep page order, page count, and Arabic-safe PNG fallback unchanged.
- Do not use SVG-as-image APIs that rasterize vector artwork.

## Dependency and test requirements

- `bun.lock` is the authoritative dependency lockfile and is regenerated with Bun. CI installs with `bun install --frozen-lockfile`.
- `package-lock.json` remains a legacy, unsynchronized lockfile and is not used by the project's CI workflows.
- Unit tests cover registry lifecycle, SVG extraction, dimensions, coordinate conversion, fallback behavior, and cleanup.
- Browser E2E exports the real `ReportDocument` component with a deterministic synthetic fixture, without calling external AI. The fixture contains 28 health columns (forcing multiple quality-log pages), long Arabic narrative text, KPI/statistics/SQL/lineage/top-bottom/methodology sections, and two registered ECharts charts.
- The dense PDF contains one Latin-labelled chart that must remain vector and one Arabic-labelled chart that must use the chart-only raster fallback. E2E checks that the PDF page count matches the rendered document, image count equals page rasters plus the Arabic chart fallback, vector path operators exist, and page content containers do not overflow vertically.
- CI uploads the dense PDF plus cover and chart-page screenshots as `mizya-pdf-visual-qa` artifacts for visual review.
- A separate workspace integration E2E now reads the active DuckDB table, derives a grouped SQL result from its actual numeric and categorical columns, computes data health from that table, and mounts a report with the production `ReportDocument`. Its language plan is deterministic (no external AI call), while query rows, source row count, schema, and quality metrics are real workspace outputs.
- The workspace PDF is checked for page-count parity, the presence of the rendered ECharts chart, non-empty page content, no vertical overflow, compact summary/SQL-methodology composition, removal of empty-lineage pages, and the expected source/query counts. Its page count is capped for the representative one-insight fixture to prevent sparse-page regressions. CI uploads this PDF and its chart-page screenshot alongside the dense fixture artifacts.
- The PDF report uses Changa for Arabic text and chart labels. The font is loaded before capture and embedded into the rasterization CSS so PDF generation does not depend on a later font request.
- Inspect the resulting PDF for Arabic shaping in Changa, chart alignment, compact section balance, clipping, page boundaries, and actual vector drawing commands before declaring the output visually approved.

## Acceptance criteria

- Arabic body text, headings, and chart labels use Changa on the MIZYA warm-paper report theme and preserve browser text shaping through font loading and embedding.
- A Latin-labelled report chart is represented by vector PDF drawing commands, not an embedded raster image.
- Charts containing Arabic labels preserve shaping through the chart-only raster fallback.
- Failed SVG conversion falls back safely without losing the report or producing a partial document.
- Typecheck, Vitest, build, and browser E2E all pass.
