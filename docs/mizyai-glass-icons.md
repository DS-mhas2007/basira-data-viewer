# MIZYAi Glass Icon System

MIZYAi's original SVG icon family is implemented in `src/components/MIZYAiIcon.tsx`.

## Design language

- Deep Navy is the canvas; icons remain legible on dark surfaces.
- Teal (`#60F5D2`) communicates data, navigation, and operational actions.
- Lavender (`#D6B2FC`) communicates AI, discovery, and secondary intelligence.
- Dual blends both colors for signature MIZYAi actions.
- Each glyph uses a translucent glass fill, bright glass edge, internal highlight, and restrained glow.
- Icons are original SVG geometry, not recolored Lucide glyphs.

## Available glyphs

| Group | Names |
| --- | --- |
| Workspace | `dashboard`, `projects`, `reports` |
| Intelligence | `analytics`, `assistant`, `insights` |
| System | `settings`, `alerts`, `search`, `database`, `security` |
| Actions | `cleaning`, `upload`, `download`, `share`, `filter` |
| Feedback | `success`, `warning`, `error`, `spark`, `correlation`, `distribution`, `outliers`, `quality`, `prediction` |

## Usage

```tsx
import { MIZYAiIcon } from "@/components/MIZYAiIcon";

<MIZYAiIcon name="assistant" tone="dual" className="size-6" />
<MIZYAiIcon name="analytics" tone="teal" className="size-8" />
<MIZYAiIcon name="insights" tone="lavender" className="size-10" />
```

The `title` prop makes the SVG accessible as an image. Without a title, it is hidden from assistive technology and should be paired with an accessible label on its parent control.

## Usage rules

- Use 16–20 px for dense navigation, 24 px for primary actions, and 32–48 px for feature tiles.
- Prefer `teal` for data actions, `lavender` for AI/discovery, and `dual` for signature assistant moments.
- Keep the icon on a quiet Navy or glass surface; do not add another strong glow around every instance.
- Preserve the original paths and gradients. Do not replace the icon family with generic emoji or a recolored third-party set.
- The family respects reduced-motion preferences.

## Domain-specific glyphs

- `correlation`: relationship analysis and correlation matrices.
- `distribution`: histograms and statistical distributions.
- `outliers`: anomaly and outlier detection.
- `quality`: data quality and validation.
- `prediction`: forecasting and what-if analysis.

The navigation uses the custom glyph family in the workspace sidebar and mobile navigation. The anomaly radar, cleaning panel, and data-quality score also use dedicated MIZYAi glyphs.
