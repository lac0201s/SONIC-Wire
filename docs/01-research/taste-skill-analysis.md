# taste-skill: installed, read, applied, enforced

Status: **executed**, not summarised. This page records what the skill is, what was
installed, which of its rules now govern the SonicWire interface, what was removed
because of them, and how compliance is checked after today.

## 1. What was installed

```bash
npx skills@latest add Leonxlnx/taste-skill --skill design-taste-frontend --agent '*' -y
```

| Fact | Value |
| --- | --- |
| Source | `Leonxlnx/taste-skill`, skill `design-taste-frontend` (tasteskill v2) |
| Installed to | `.agents/skills/design-taste-frontend/` (symlinked into agent folders) |
| Provenance | `skills-lock.json`, content hash `6ac8ba60…08fb0d` |
| Contents used | `SKILL.md` (542 lines), `references/app-screens.md`, `references/tells.md`, `references/imagery.md`, `scripts/draw.mjs`, `scripts/inspect.mjs` |
| Not usable here | `scripts/inspect.mjs` — it drives a real Chrome/Chromium, and this sandbox has none (see §6) |

The skill is prompt-level art direction, not a library. Its value is a house style
plus a measured check loop.

## 2. The house style, and what it banned here

From `SKILL.md` §House rules, with the SonicWire decision each one forced:

| Rule | What it killed in this repository |
| --- | --- |
| No eyebrows, no pill badges above a heading | `SectionHeading`'s `label` prop deleted (17 call sites); `AuthLayout`'s `eyebrow` prop deleted; page-level `<Label>` above every `<h1>` removed (Library, Command, NotFound, Auth) |
| No monospace outside real code | `.sw-num` no longer sets a mono family; `DataRow`/`Badge`/`Label` lost `font-mono`; 21 files swept; mono kept only for SHA-256 digests, commands and JSON |
| No tiny uppercase letter-spaced labels | `.sw-label` is now 12 px sentence case with zero tracking; 32 `uppercase` utilities removed |
| No thin rules, no 1px outlined boxes | `divide-y` rows removed across AssetDetail, Observatory, Studio, Settings; panel borders reduced to a single tone step; `sw-hairline` only where two blocks genuinely need separation |
| No gradients | hero field, thumbnail fallback, auth panel overlay and card scrims removed; `AssetCard` placeholder is flat `graphite` |
| No shadows at rest, no glows | primary button inset/outer shadow removed; `Mark`'s `glow` prop removed; toast shadow removed |
| No glass, no floating pill navigation | header and mobile nav no longer `backdrop-blur`; workspace chip lost its pill; scrims are plain `bg-black/70` |
| KPIs are type, not tiles | `Metric` (label, number, honesty line) replaced icon tiles on Command and Observatory; Observatory KPI panels became bare metrics on the page surface |
| No icon-topped or repeated card grids | Landing sections are text + a live product fragment, not card rows |
| Two typefaces at most | display grotesque + Inter for UI; JetBrains Mono demoted to code only |

Exemptions the skill itself grants are respected: `<pre>`/`<code>` keep monospace,
real tables and inputs keep their lines, and an interface fragment whose root
carries `data-ui` keeps its own chrome.

## 3. App-screen rules

`references/app-screens.md` was read whole before touching the console. Findings that
changed decisions here:

- In 23 real products the median screen surface is ~3% coloured pixels; SonicWire now
  uses ember for one action per screen and nothing else.
- KPIs are set as type in the majority; tiles and icon chips are the generator tell.
- 17 of 23 products use no shadow at rest, and none uses a hero header inside the app.
  The console title is a normal page heading, not a hero.
- Charts carry no legend and no rainbow; the waveform and composition meters use one
  tone each.
- Honest zeros and em dashes are normal; fake numbers are not. Every number on screen
  is fetched, and "not measured" is written as "not measured".

## 4. What replaced the removed ornament

Removing decoration without adding substance produces a thin screen, which the skill
warns about explicitly. The compensating work:

- **Scale**: one large statement per screen (landing headline, asset title, section
  headings at 26–34 px) instead of many small ones.
- **Real content**: the landing page shows live `/api/health` and `/api/providers`
  data including the provider's own refusal text; the inspector shows measured
  loudness, silence, black frames, scene cuts, decode health and a peak envelope.
- **Live product fragment**: the landing hero embeds the actual instrument panel
  rather than a drawing of one.
- **Field of colour**: flat `graphite`/`steel` surfaces separate regions.

## 5. Enforcement

Prose does not survive a refactor, so the rules are executable:

```bash
npm run lint:ui   # scripts/check-ui-rules.mjs
```

The script scans every frontend source file (vendor excluded), allows monospace only
inside `<code>`/`<pre>`, and fails on `font-mono`, `uppercase`, wide `tracking-[…]`,
`bg-gradient`/`linear-gradient`, `backdrop-blur`, `shadow-*`, `drop-shadow-*` and the
removed texture classes. `npm run check` runs typecheck → ui rules → tests.

Current result: **35 files scanned, no violations.**

## 6. What could not be verified here

`inspect.mjs` measures the house rules in a real browser (headline line counts,
contrast, spacing). This environment has no Chrome/Chromium/Edge and the sandbox has
no root, so the browser gate did not run. Browser-driven checks are therefore
**unverified** and the report says so; the static rule scan and the jsdom tests are
what actually passed.

## 7. Sources

- `Leonxlnx/taste-skill` — installed copy at `.agents/skills/design-taste-frontend/`, read 2026-10-30.
- `references/app-screens.md`, `references/tells.md`, `references/imagery.md` in the same folder.
- The study the skill cites: 247 curated gallery sites (One Page Love, Awwwards Sites of the Day).
