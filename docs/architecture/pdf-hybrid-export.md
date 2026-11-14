# Hybrid PDF export architecture

## Status

- Current implementation: full-page PNG rasterization through `html-to-image` and `jsPDF.addImage`.
- Arabic text, mixed RTL/LTR content, tables, and DOM layout must remain on the raster path.
- ECharts currently mounts with the Canvas renderer in `EChartsView`.
- Hybrid export is **not implemented** by this document; this is the implementation contract for the next change.

## Target output

Use a layered PDF page:

1. Capture the complete report page as a PNG at the existing 2x scale. This is the authoritative fallback and preserves Arabic shaping and layout.
2. For each explicitly marked report chart, create a separate ECharts instance using the SVG renderer and the exact same option, width, and height as the on-screen chart.
3. Convert the generated SVG element to PDF vector paths with `svg2pdf.js`, positioning it over the chart's measured page rectangle.
4. Only after the vector chart has been added successfully, cover its corresponding raster chart region with the page background color (or, preferably, capture the base page with chart hosts temporarily hidden and restore them in a `finally` block).
5. If an individual SVG render or conversion fails, rasterize that chart region and insert it as PNG. A chart failure must never fail an otherwise valid report export.

## Component contract

### `ReportChart`

- Mark only report charts intended for vector export with `data-pdf-chart`.
- Preserve a serializable ECharts option on the chart host, or expose the option through a dedicated export descriptor.
- Keep the measured chart viewport dimensions identical to the rendered chart.
- Do not serialize user-provided HTML or arbitrary SVG markup.

### SVG renderer

- Use ECharts 5.6.0 with `renderer: "svg"` in a temporary, isolated host.
- Reuse the exact chart option; do not recompute data or bypass DuckDB.
- Disable animation for deterministic export.
- Remove the temporary chart instance and host in `finally`, including on exceptions.
- Validate that an SVG element was produced and has non-zero dimensions.

### PDF composition

- Load `svg2pdf.js` only in the browser export path; its API requires a real DOM and is not supported by JSDOM.
- Convert page-relative CSS pixel coordinates to jsPDF points using the existing A4 mapping: `A4_W / PAGE_W` and `A4_H / PAGE_H`.
- Keep page order, page count, and the existing Arabic-safe PNG path unchanged.
- Use the existing per-page PNG as the fallback if SVG conversion fails; do not emit a partially composed PDF.

## Dependency and test requirements

- Add `svg2pdf.js` only together with regenerated `bun.lock` (the CI workflow uses `bun install --frozen-lockfile`).
- Do not hand-edit lockfile package resolutions or integrity hashes.
- Unit-test SVG extraction, dimensions, coordinate conversion, fallback behavior, and cleanup.
- Keep PDF composition tests separate from JSDOM-incompatible `svg2pdf.js` integration tests.
- Add a browser E2E test that exports a report with at least one chart and verifies a valid PDF is produced.
- Inspect the resulting PDF visually for Arabic shaping, chart alignment, clipping, page boundaries, and selectable/vector chart content before declaring Hybrid complete.

## Acceptance criteria

- Arabic body text and tables render identically to the current raster export.
- At least one report chart is represented by vector PDF drawing commands, not an embedded raster image.
- Failed SVG conversion falls back safely without losing the report or producing a partial document.
- Typecheck, Vitest, build, and browser E2E all pass.
