# Vendored React Bits components

Source: [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits) — inspected
2026-10-30 through the GitHub REST API (`/repos/DavidHDev/react-bits/contents/...`),
repo push of record 2026-10-19, 50,716 stars at inspection time.

**Licence:** MIT + Commons Clause (repo states this in its README; GitHub reports
`NOASSERTION`). The Commons Clause restricts *selling* the components; use inside an
application is permitted. Attribution is kept in this file and in the component
headers.

## Components

| Component | Upstream path | Vendored file | Dependencies | Changes made for SonicWire |
| --- | --- | --- | --- | --- |
| `Counter` | `src/content/Components/Counter/` | `Counter.jsx`, `Counter.css` | React only | None to the logic. Props are typed in `react-bits.d.ts`; used with `fontSize`, `tabular` and reduced motion inherited from the app's global rule. |
| `StatusMark` | `src/content/Micro/StatusMark/` | `StatusMark.jsx`, `StatusMark.css` | `motion/react` (already a SonicWire dependency, v12.43.0) | None to the logic. Colours are passed from SonicWire tokens (`ember` / `ok` / `danger`) rather than upstream defaults, and the label is supplied by SonicWire's own status vocabulary. |

Both files are vendored **as JSX** rather than rewritten into TypeScript: the
project enables `allowJs` with `checkJs: false`, and the public surface is typed in
`react-bits.d.ts`. This keeps the upstream diff reviewable and avoids a silent fork.

## Why these two

- `Counter` gives the observatory numbers an odometer transition that respects
  `prefers-reduced-motion`; it is dependency-free and ~2 kB gzipped.
- `StatusMark` is a genuinely better job indicator than a coloured dot: it encodes
  pending / running (determinate and indeterminate) / done / failed / cancelled in a
  single glyph, which is exactly the queue's state machine.

Components evaluated and rejected: `AnimatedList` (pulls `@hugeicons/*`, duplicating
our icon dependency), `AnimatedContent` (GSAP, a ~70 kB addition for a fade),
`BorderGlow`/`SpotlightCard` (gradient and glow treatments the house rules forbid),
`PillNav`/`Dock` (floating pill navigation is explicitly disallowed). The live
component catalogue was read at vendoring time; components that were only mentioned
in prose are not listed here.

## Token integration

Upstream defaults are never relied on for colour. `StatusMark` receives
`color=var(--color-ember)`, `doneColor=var(--color-ok)`,
`errorColor=var(--color-danger)`; `Counter` inherits `textColor` and `fontWeight`
from its container so the type system stays in control.

## Where they are used

- `Counter` — inside `Metric` (`apps/web/src/design-system/ui.tsx`), which renders
  every KPI on Command and Observatory. Numeric values animate; strings render plain.
- `StatusMark` — inside `StatusBadge` via the `STATUS_MARK` vocabulary map, so job and
  asset states draw one glyph: ready/succeeded → done, running/probing → running,
  queued/pending/waiting_approval → pending, failed/error/missing → failed,
  cancelled/skipped → cancelled.

## Tests

`apps/web/src/design-system/ui.test.tsx` covers `Metric` and the `StatusBadge`
mapping, including the accessible name (`role="img"` glyph is `aria-hidden`, the text
label is the accessible name). There is no separate `JobStatus.test.tsx`; job status
rendering is exercised through `AssetCard.test.tsx` and the route tests.
