# Design tokens, colour and spacing

Single source of truth: `apps/web/src/styles.css` (`@theme` block). Both the
marketing site and the console import the same file — there is no second palette.

## 1. Colour

### Surfaces (darkest → lightest)

| Token | Hex | Job |
| --- | --- | --- |
| `--color-obsidian` | `#060709` | page background |
| `--color-graphite` | `#0a0c0f` | inset wells, table headers |
| `--color-steel` | `#0f1216` | panels, modals |
| `--color-iron` | `#151920` | inputs, secondary controls |
| `--color-slate-panel` | `#1b2029` | hover/active surfaces |
| `--color-hairline` | `rgba(255,255,255,0.075)` | separators, panel borders |
| `--color-hairline-strong` | `rgba(255,255,255,0.14)` | table edges, emphasis rules |

### Text and semantic colour — measured contrast

Ratios computed with the WCAG 2.1 relative-luminance formula. **AA normal text
requires 4.5:1**; AA large text (≥24 px or ≥19 px bold) requires 3:1.

| Foreground | Hex | on obsidian | on steel | on iron | on slate-panel | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `--color-ink` | `#eceae5` | 16.76 | 15.62 | 14.66 | 13.59 | AAA everywhere |
| `--color-mute` | `#949aa4` | 7.12 | 6.63 | 6.22 | 5.77 | AAA everywhere |
| `--color-dim` | `#818997` | 5.72 | 5.33 | 5.00 | 4.64 | AA everywhere |
| `--color-ember` | `#ff7a2f` | 7.75 | 7.22 | 6.78 | 6.28 | AA everywhere |
| `--color-ember-soft` | `#ffb287` | 11.49 | 10.70 | 10.04 | 9.31 | AAA everywhere |
| `--color-plasma` | `#7fd9cd` | 12.20 | 11.36 | 10.66 | 9.89 | AAA everywhere |
| `--color-danger` | `#ff5f56` | 6.74 | 6.28 | 5.89 | 5.46 | AA everywhere |
| `--color-warn` | `#ffc65c` | 12.94 | 12.06 | 11.31 | 10.49 | AAA everywhere |
| `--color-ok` | `#7bd88f` | 11.57 | 10.78 | 10.12 | 9.38 | AAA everywhere |

**Correction made during this build:** `--color-dim` was originally `#626973`,
which measured **2.95–3.63:1** on the panel surfaces and failed AA for the 10 px
micro-labels it is used for. It was raised to `#818997` (4.64:1 worst case) while
staying visibly dimmer than `mute`. That is the only palette change driven by
measurement rather than taste.

Ember is never used as a text-background pair with white: white on ember measures
2.60:1. The primary button therefore uses near-black `#170a02` on ember (7.75:1).

### Accent semantics (enforced in review)

- **Ember** = actionable or live. Primary buttons, active nav, focus ring, progress
  fill, recording dot, workflow step in flight.
- **Plasma** = measured or derived. Waveform bars, derivative badges, latency values.
- **Danger / Warn / Ok** = state, never decoration.

## 2. Typography scale

| Role | Family | Size / line-height | Tracking | Notes |
| --- | --- | --- | --- | --- |
| Display hero | Bricolage Grotesque Variable | `clamp(2.6rem, 6.4vw, 5rem)` / 0.94 | -0.045em | marketing only |
| Section title | Bricolage Grotesque | 28–34 px / 1.1 | -0.03em | `text-balance` |
| Panel title | Inter | 15–16 px / 1.3 | -0.01em | weight 600 |
| Body | Inter | 13–15 px / 1.55 | 0 | `text-pretty` on paragraphs |
| Table cell | Inter | 12.5 px / 1.4 | 0 | dense data |
| Micro-label (`sw-label`) | JetBrains Mono | 10 px / 1.2, uppercase | 0.14em | panel eyebrows, column heads |
| Numeric (`sw-num`) | JetBrains Mono | 10–13 px | 0 | `font-variant-numeric: tabular-nums` |
| Code / id | JetBrains Mono | 10.5–12 px | 0.02em | hashes, preset ids |

Fonts are installed from npm (`@fontsource-variable/*`) and bundled — no network
request at runtime, no FOUT from a third-party font host.

## 3. Spacing, radius, layout

- **Spacing**: 4 px base. Steps used: 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40, 56.
- **Radius**: `xs 3px` (chips, thumbnails), `sm 5px` (inputs, small buttons),
  `md 9px` (panels), `lg 14px` (modals). Nothing is pill-shaped except status dots.
- **Page gutters**: `px-5` (20 px) mobile, `sm:px-8` (32 px) desktop.
- **Max content width**: 1320 px on marketing and console; inspector uses a
  two-column `minmax(0,1fr) 360px` split at `lg`.
- **Touch targets**: minimum 32 × 32 px for icon buttons, 40 px height for primary
  actions, 44 px on touch breakpoints via `size="lg"`.

## 4. Elevation, borders, texture

| Element | Implementation |
| --- | --- |
| Panel | 1 px `hairline` border + 2.2 % white top-light gradient over `steel` |
| Raised panel | adds `slate-panel` background at hover |
| Corner ticks | `.sw-ticks` — 1 px L-marks at opposing corners, 6 px long |
| Grid field | `.sw-grid-bg` — 32 px linear-gradient rules at 2 % white |
| Grain | `.sw-grain` — inline SVG feTurbulence at 3 % opacity, hidden under reduced motion |
| Focus | `:focus-visible` → 2 px ember outline, 2 px offset, 2 px radius |

No box-shadows are used for elevation. The only shadows in the codebase are the
inset highlight on the primary button and the ember bloom in the hero canvas.

## 5. Token governance

1. New colours must be added to `@theme` with a measured contrast ratio in this
   document; ad-hoc hex values in components are rejected in review.
2. The `ember` accent is a scarce resource: adding a second warm accent requires an
   ADR.
3. Charts and canvas code read tokens from CSS custom properties where possible;
   where a canvas needs a literal (e.g. `SignalCanvas`), the value is copied from
   the token and commented with its name.
