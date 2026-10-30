# Typography and motion specification

## 1. Typography

### Families and why

| Family | Source | Role | Why this one |
| --- | --- | --- | --- |
| **Bricolage Grotesque** (variable) | `@fontsource-variable/bricolage-grotesque` 5.2.8 | display, section titles | A grotesque with slightly irregular, engineered terminals — reads as designed rather than default. Variable weight lets the hero sit at 600 and section titles at 560–600 without a second file. |
| **Inter** (variable) | `@fontsource-variable/inter` 5.2.8 | all UI text | Highest legibility at 12–15 px, extensive figure support, `cv11`/`ss01` features enabled for a single-storey `a` and slashed zero context. |
| **JetBrains Mono** (variable) | `@fontsource-variable/jetbrains-mono` 5.2.8 | measurements, ids, labels | Designed for code density: unambiguous `0/O`, `1/l/I`; tabular by default so latency and byte columns align without `font-variant-numeric`. |

Alternatives considered: Geist (rejected — visually indistinguishable from Inter at
UI sizes, so the display layer would lose its voice), Space Grotesk (rejected — too
wide at 10 px labels), IBM Plex Mono (rejected — heavier x-height made dense tables
feel crowded next to Inter).

### Rules

1. **Numerals are tabular** anywhere a value can change: durations, byte sizes,
   percentages, latencies, attempt counts. Implemented as `.sw-num`.
2. **Labels are uppercase mono, 10 px, 0.14em tracking.** Used for panel eyebrows and
   table column heads. Never for sentences.
3. **No text below 10 px.** The 10 px floor applies to labels only; body text never
   drops below 12 px.
4. **Line length** is capped at ~68 characters for prose (`max-w-[560px]`–`max-w-2xl`);
   tables and fact grids are exempt.
5. **Headings use `text-wrap: balance`, paragraphs `text-wrap: pretty`.**
6. **Weight range**: 400 body, 500 controls, 560–600 headings, 600 only for the hero
   and modal titles. No 700+ — it punches holes in dark surfaces.

### Type scale (implemented values)

```
display   clamp(2.6rem, 6.4vw, 5rem) / 0.94 / -0.045em   Bricolage 600
h2        28–34px / 1.1 / -0.03em                        Bricolage 600
h3        15–16px / 1.3 / -0.01em                        Inter 600
body      13–15px / 1.55                                  Inter 400
table     12.5px / 1.4                                    Inter 400
label     10px / 1.2 / 0.14em uppercase                   JetBrains 500
num       10–13px tabular                                 JetBrains 400
mono-id   10.5–12px / 0.02em                              JetBrains 400
```

## 2. Motion

### Timing tokens

| Token | Value | Use |
| --- | --- | --- |
| `--ease-industrial` | `cubic-bezier(0.22, 1, 0.36, 1)` | all transitions and keyframes |
| micro | 120–150 ms | hover, focus, toggle, button press |
| standard | 220–260 ms | panel/tab content, toast enter |
| reveal | 520 ms | hero rise, first paint of a route |
| ambient | 2400 ms loop | live dot pulse only |

### Named animations

| Name | Definition | Where |
| --- | --- | --- |
| `sw-rise` | opacity 0→1, translateY 8px→0, 520 ms | route hero, panel entrance |
| `sw-pulse-soft` | opacity 1→0.45→1, 2.4 s ease-in-out infinite | live/recording dot |
| `sw-scan` | background-position sweep, 6 s linear infinite | marketing hero only |
| progress fill | width transition 150 ms linear | job progress bars |
| toast | translateY 8px→0 + opacity, 200 ms | notifications |

### Constraints

1. **Motion must explain a state change.** Decorative loops are limited to the live
   dot and the hero canvas.
2. **No motion above 520 ms**, and nothing that blocks input.
3. **`prefers-reduced-motion: reduce`** sets every animation/transition to 0.001 ms,
   disables `scroll-behavior`, hides `.sw-grain`, and makes `SignalCanvas` paint a
   single static frame (`matchMedia` checked at mount and on resize).
4. **Canvas pauses when offscreen** via `IntersectionObserver`; it also caps DPR at
   2 and stops the RAF loop on unmount.
5. **No layout-animating properties** except `transform` and `opacity`; the progress
   bar is the one width transition, and it is on a fixed-height element so it cannot
   reflow content.

### Motion inventory (what a reviewer will see)

| Interaction | Motion | Duration |
| --- | --- | --- |
| Hover a panel/row | background lightens to `slate-panel`, border to `hairline-strong` | 150 ms |
| Open a modal | backdrop fade + panel rise | 220 ms |
| Submit a transform | button → loading spinner, progress bar advances with real encoder progress | 150 ms per tick |
| Job completes | status badge swaps, toast enters, list re-sorts | 200 ms |
| Route change | content fades/rises | 520 ms |
| Command palette | overlay fade, list filters without animation | 150 ms |
