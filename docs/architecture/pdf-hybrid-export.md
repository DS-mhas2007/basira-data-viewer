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
- Browser E2E exports a report page with an ECharts chart and checks that the PDF contains only the page raster image; chart artwork must remain vector.
- Inspect the resulting PDF for Arabic shaping, chart alignment, clipping, page boundaries, and actual vector drawing commands before declaring the output visually approved.

## Acceptance criteria

- Arabic body text and tables render identically to the existing raster export.
- A Latin-labelled report chart is represented by vector PDF drawing commands, not an embedded raster image.
- Charts containing Arabic labels preserve shaping through the chart-only raster fallback.
- Failed SVG conversion falls back safely without losing the report or producing a partial document.
- Typecheck, Vitest, build, and browser E2E all pass.
