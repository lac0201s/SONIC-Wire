# Art direction concepts

Three directions were considered before any UI code was written. The chosen one is
**Cinematic Industrial**; the other two are preserved here because the reasons for
rejecting them constrain future design decisions.

## Concept A — Cinematic Industrial (chosen)

> A colour-grading suite at 3am: obsidian surfaces, instrument labels, one warm
> accent that means "act" and one cool accent that means "measured".

- **Surface logic.** Four neutrals with a fixed job: `obsidian` page, `graphite`
  inset wells, `steel` panels, `iron` controls. Elevation is expressed by a 1 px
  hairline plus a 2 % white top-light gradient — never by drop shadows.
- **Accent discipline.** Ember (`#ff7a2f`) is reserved for actionable or live state:
  primary buttons, active nav, focus rings, progress fill, recording dots. Plasma
  (`#7fd9cd`) marks verified/derived data (waveforms, derived-asset badges). Using
  ember for decoration would destroy the signal; the rule is written into the token
  comment and enforced by review.
- **Instrument typography.** Every measurement is mono, tabular, uppercase for
  labels (`sw-label`) and right-aligned for numbers (`sw-num`). The console should
  read like a machine's own log book, not a dashboard with rounded cards.
- **Machined detail.** Corner ticks (`.sw-ticks`), a 1 px grid field, film grain at
  3 % opacity, and a scan-line sweep on the marketing hero. All procedural.
- **Density with air.** Tables are 12.5 px with 10 px mono metadata; panels carry
  16 px padding on mobile and 20 px on desktop; the page max width is 1320 px.

## Concept B — Repository White (rejected)

A paper-white, archival direction: cream surfaces, hairline rules, serif captions,
colour only in the media itself.

*Rejected because* the product's core object is a dark media frame, and a white
chrome around a black video creates a visual seam at every playback surface. It also
made the observatory's dense latency table feel like a bank statement.

## Concept C — Neon Terminal (rejected)

Pure black with saturated cyan/magenta, monospace everywhere, glow on everything.

*Rejected because* it reads as a hobby tool, fails to distinguish "action" from
"data" (everything glows), and the accent saturation broke contrast targets on large
type. It also aged badly against the 2026 visual landscape of AI-generated pages that
use exactly this palette.

## Rules that fall out of the decision

1. **No gradients as decoration.** The only linear gradients are the panel top-light
   and the procedural hero field.
2. **No imagery of people or products.** Nothing in the UI depicts a studio it does
   not have.
3. **Motion explains state.** A panel rises 520 ms on mount; a progress bar eases
   150 ms; a live dot pulses at 2.4 s. Nothing loops for ambience except the hero
   canvas, which pauses offscreen and freezes under reduced motion.
4. **Type never shrinks below 10 px**, and 10 px is only for uppercase mono
   micro-labels with 0.14em tracking.
5. **Marketing and app share one token set.** `styles.css` is the only palette
   definition in the repository; the landing page and the console cannot drift.

## Surface map

| Layer | Token | Used for |
| --- | --- | --- |
| Page | `obsidian` #060709 | body background |
| Inset | `graphite` #0a0c0f | table header rows, code blocks, wells |
| Panel | `steel` #0f1216 | cards, sections, modals |
| Control | `iron` #151920 | inputs, secondary buttons, thumbnails placeholders |
| Raised | `slate-panel` #1b2029 | hover states, active tab pill |
| Line | `hairline` 7.5 % white | separators, panel borders |
| Line strong | `hairline-strong` 14 % | focus-adjacent borders, table edges |
