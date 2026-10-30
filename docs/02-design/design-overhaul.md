# Design overhaul: what was banned and what replaced it

The first console build was generator-shaped: gradients on every surface, mono
uppercase micro-labels, icon-topped KPI tiles, hairline dividers, glow on the mark, a
grain overlay and a backdrop-blurred header. It read as a template, not an instrument.
This page records the overhaul, so the decisions survive the next refactor.

## Rules now in force

The house style comes from the installed `design-taste-frontend` skill (see
`docs/01-research/taste-skill-analysis.md`). Short form:

- No gradients, no glows, no shadows at rest, no glass, no grain/grid textures.
- No eyebrows or pill badges; no tiny uppercase tracked labels; no monospace outside
  real code.
- No hairline rules as decoration; no 1px outlined boxes; surfaces are a tone step.
- KPIs are type, not tiles; no icon-topped cards, no repeated card grids.
- Two typefaces maximum for UI; display grotesque for headings, Inter for text.

## What was removed, file by file

| Removed | Where it lived | Why |
| --- | --- | --- |
| `sw-grain`, `sw-grid-bg`, `sw-ticks`, `sw-tick` | `styles.css`, `AppShell`, `AuthLayout`, `Landing` | decorative texture layers |
| gradient/radial fills on panels, buttons, thumbnail fallbacks, auth overlay | `styles.css`, `ui.tsx`, `AssetCard`, `AuthLayout` | gradients banned on every surface |
| inset+outer shadow on primary button, toast drop shadow, `Mark` glow | `ui.tsx`, `Brand.tsx` | no shadows or glows at rest |
| `backdrop-blur` header, mobile nav, modals, bulk bar, media badges | `AppShell`, `ui.tsx`, `CommandPalette`, `Command`, `Library`, `AssetCard` | no glass |
| `SectionHeading` `label` prop, `AuthLayout` `eyebrow` prop, page-level `<Label>` above `h1` | 20 files | no eyebrows |
| `.sw-label` mono + uppercase + 0.19em tracking | `styles.css` | tiny tracked caps |
| `font-mono` on values, timestamps, labels, codes | 21 files | monospace outside code |
| `divide-y` row separators | AssetDetail, Observatory, Studio, Settings | no thin rules |
| KPI tiles on Command, Observatory | `Command.tsx`, `Observatory.tsx` | KPIs are type |
| Signal-canvas hero field and decorative overlays on auth | `AuthLayout` | no decorative shapes |

Monospace survives in exactly three places: SHA-256 digests, shell commands and JSON
payloads, all inside `<code>`/`<pre>`.

## What replaced it

1. **Scale.** One computed focal point per screen: the landing headline at
   `clamp(2.7rem, 6.2vw, 4.6rem)`, the asset title at `clamp(1.35rem, 2.6vw, 1.9rem)`,
   section headings at 26–34 px.
2. **A live product fragment.** The landing hero shows real `/api/health` and
   `/api/providers` output — including the provider's own text about what cannot be
   downloaded — rather than a drawing of a dashboard.
3. **Measurement as content.** The inspector now shows measured loudness, true peak,
   loudness range, silence share, black frames, scene cuts, decode errors, mean luma
   and a peak envelope drawing built from the file's own samples.
4. **Tone steps instead of borders.** `steel` panels on `obsidian` ground; `iron` for
   raised areas; hairlines only where two dense blocks genuinely collide.
5. **Type as the state language.** `StatusMark` (React Bits) draws pending / running /
   done / failed / cancelled beside labels; `Metric` states a number and the fact that
   qualifies it.

## Enforcement

`npm run lint:ui` (`scripts/check-ui-rules.mjs`) fails the build on every banned
utility in `apps/web/src` (vendor excluded), and `npm run check` runs typecheck → ui
rules → tests. Current state: 35 files scanned, no violations; 18 web tests, 90 server
tests, 12 contract tests green.

## What is not verified

No browser exists in this sandbox (no Chrome, Chromium or Edge, and no root to install
one), so the skill's `inspect.mjs` browser gate did not run. Headline line counts at
three widths, browser-measured contrast and screenshot review are therefore
**unverified by me**; the static rule scan, component tests and the live server smoke
test are what passed.
