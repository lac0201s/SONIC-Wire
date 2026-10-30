# React Bits analysis

## 1. What was verified (primary)

`api.github.com` is reachable from this environment, so the repository was inspected
directly rather than from memory:

| Fact | Value | How |
| --- | --- | --- |
| Repository | `DavidHDev/react-bits` | `GET /repos/DavidHDev/react-bits` |
| Stars | 50,716 | same |
| Licence | `NOASSERTION` per GitHub; README states **MIT + Commons Clause** | repo metadata + README |
| Last push | 2026-10-19 | repo metadata |
| Categories | `Animations` 38, `Backgrounds` 64, `Components` 48, `Micro` 35, `TextAnimations` 33 → **218 component folders** | `GET /contents/src/content/<category>` |
| Distribution model | copy-paste source, four variants per component (JS/TS × CSS/Tailwind) | README |
| Sample dependency profile | `TextAnimations/SplitText/SplitText.jsx` — 428 lines importing `gsap`, `gsap/ScrollTrigger`, `gsap/SplitText`, `@gsap/react` | `GET /contents/.../SplitText.jsx`, base64 decoded |

## 2. What SonicWire took from it

Nothing was copied: every component in `apps/web/src` is original, and no React Bits
file is present in the repository. The *ideas* that shaped the build:

| Idea | Adopted as | Why it fits SonicWire |
| --- | --- | --- |
| Animation as a component contract (props in, motion out, no global CSS) | `Waveform`, `SignalCanvas`, `Meter`, `ProgressBar` in `design-system/` take data + tone props and own their own animation | Keeps motion testable and removable under `prefers-reduced-motion` |
| Canvas background fields instead of stock imagery | `SignalCanvas` renders filaments/particles procedurally | No image tool was available (403) and a downloaded hero image would have been a licence and payload cost |
| Copy-paste over a runtime dependency | The whole design system is ~600 lines of local components | Avoids a 200-component dependency tree for the six primitives the product needs |
| Reduced-motion respect built into each effect | `matchMedia('(prefers-reduced-motion: reduce)')` short-circuits the canvas to a single static frame; CSS transitions are disabled globally under the media query | Required for accessibility conformance |

## 3. Why wholesale adoption was rejected

1. **Weight and licence surface.** 218 components with GSAP-based variants would add
   a large dependency and a second licence (GSAP has its own terms, separate from
   React Bits' MIT + Commons Clause). A media tool needs a handful of primitives.
2. **Aesthetic mismatch.** React Bits skews toward marketing spectacle — glitch
   text, particle headings, scroll-velocity type. SonicWire's console must stay
   legible while dense with measured values; motion that competes with a codec table
   is a defect.
3. **Testability.** GSAP timelines are hard to assert in jsdom; the components here
   animate via CSS transitions or a single `requestAnimationFrame` loop, so
   `ui.test.tsx` can assert behaviour without stubbing an animation engine.
4. **Determinism.** Several React Bits effects use randomness at mount, which makes
   visual diffs and reduced-motion snapshots unstable. `SignalCanvas` seeds its
   particles once and freezes under reduced motion.

## 4. Patterns deliberately borrowed

- **Text reveal on the marketing hero**: implemented with CSS `sw-rise` keyframes
  (opacity + 8 px translate, 520 ms) rather than a split-text engine.
- **Ambient canvas field**: implemented as a low-density (`7` filaments, `46`
  particles) 2D context with DPR-aware sizing, paused when the canvas is offscreen.
- **Micro-interaction on actions**: buttons use 120 ms colour/scale transitions and
  an inline spinner; no ripple, no bounce.

## 5. Verdict

React Bits is a legitimate, actively maintained reference for animated React
component *patterns*, and it is cited here as inspiration only. Its components were
neither vendored nor installed; the repository contains no third-party animation
code.

## 6. Sources

- `https://api.github.com/repos/DavidHDev/react-bits` (metadata), 2026-10-30.
- `https://api.github.com/repos/DavidHDev/react-bits/contents/src/content` and the five category listings, 2026-10-30.
- `https://api.github.com/repos/DavidHDev/react-bits/readme`, 2026-10-30.
- `TextAnimations/SplitText/SplitText.jsx` via the contents API (dependency inspection), 2026-10-30.
