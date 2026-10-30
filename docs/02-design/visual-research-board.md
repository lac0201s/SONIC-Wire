# Visual research board

This board records the references that shaped the interface, what was actually
available, and how each influence was translated. No reference image was downloaded
into the repository.

## 1. Availability of imagery

| Intended artefact | Status | Consequence |
| --- | --- | --- |
| AI-generated hero art (3 variants) | **Not produced** — the image tool returned HTTP 403 | Replaced by procedural canvas art (`SignalCanvas`), documented in the asset plan |
| Photo reference board | Not downloaded | Reference characteristics recorded as prose and tokens instead |
| Stock texture pack | Not used | Grain is a 64 px inline SVG data-URI with 3 % opacity |

The mandate forbids fabricating a downloaded resource. Nothing in this document
claims an image that does not exist in `apps/web/src`.

## 2. Reference characteristics (what was aimed for)

1. **Colour-grading suite UIs** — DaVinci Resolve's scopes, Baselight's node graph:
   near-black chrome so the image is the only bright object; numeric readouts in
   monospace; one saturated accent for the active scope.
2. **Broadcast hardware front panels** — engraved labels, tick marks, LED state
   indicators, screws. Translated into `.sw-ticks` corner marks, `sw-label` engraving
   and the `sw-live-dot` pulse.
3. **Scientific instrumentation** — tabular numerals aligned by decimal, axis-free
   waveforms, "p50/p95" language rather than "average". The observatory copies this
   vocabulary literally.
4. **Film title cards** — a single line of display type at 0.94 line-height with
   negative tracking, a small caps eyebrow above it. The landing hero is this, with
   the second line carrying the ember accent.
5. **Industrial safety signage** — high-contrast warnings, never decorative:
   `danger` for destructive actions, `warn` for policy restrictions (e.g. "link
   only"), `ok` for verified hashes.

## 3. Composition studies

| Surface | Composition | Why |
| --- | --- | --- |
| Landing hero | Asymmetric 60/40 split: type left, live system card right, canvas field behind both | Allows the marketing site to show real health data without a screenshot |
| Library | Full-bleed toolbar, then a dense list (default) or a 3-up card grid | Media libraries are scanned, not admired |
| Inspector | 2-column: player + waveform on the left, fact table on the right, sticky action bar beneath | Eye stays on the frame while numbers update |
| Observatory | Four KPI panels in a row, then two tables (queue, audit) | Answers "is it healthy, what failed, what changed" in one screen |
| Acquire | Import form, then the provider capability matrix as a real table with an "Ingest" column | The policy *is* the content |

## 4. Texture and light

- **Grain**: inline SVG feTurbulence, `opacity: 0.03`, `mix-blend-mode: overlay`,
  disabled entirely under reduced motion.
- **Grid field**: 32 px `linear-gradient` rules at 2 % white behind the console body.
- **Top light**: 2.2 % white to transparent over the first 42 % of every panel.
- **Ember bloom**: only in the hero canvas, as a radial gradient anchored to the
  pointer with a 0.06 parallax — the single place where light is decorative.
- **Scan sweep**: a 6 s horizontal gradient pass on the hero, hidden under reduced
  motion.

## 5. What the board ruled out

- Rounded-2xl cards and soft shadows (the "AI SaaS" default of 2024–2026).
- Purple/indigo gradients; glassmorphism blur panels; floating 3D blobs.
- Emoji as iconography; icon-only actions without labels in the console.
- Charts that imply data density the product does not have (no sparkline on a page
  with one data point).
