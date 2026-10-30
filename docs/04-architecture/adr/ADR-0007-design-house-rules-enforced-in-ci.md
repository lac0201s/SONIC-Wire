# ADR-0007 — The design house rules are executable, not prose

Status: **accepted and implemented**
Date: 2026-10-30
Related: ADR-0006 (polyglot service), `docs/02-design/design-overhaul.md`

## Context

The first console build was aesthetically wrong in a specific, repeatable way:
gradients on panels, mono uppercase micro-labels, icon-topped KPI tiles, hairline
dividers, glows, grain, glass. Those are the default tells of generated frontends.

A written style guide did not prevent them, and a written style guide will not prevent
them coming back after the next refactor.

## Decision

1. Adopt the installed `design-taste-frontend` skill's house style as binding, for the
   public site and the console (with the skill's app-screen rules for the console).
2. Encode the mechanically checkable subset in `scripts/check-ui-rules.mjs`, run as
   `npm run lint:ui` and as part of `npm run check`.
3. Delete the offending primitives rather than asking people not to use them:
   `Panel`'s `ticks` prop, `SectionHeading`'s `label` prop, `AuthLayout`'s `eyebrow`
   prop and `Mark`'s `glow` prop no longer exist.
4. Keep monospace only inside `<code>` / `<pre>`, which the checker enforces.

## Consequences

- 35 frontend source files are scanned on every check; violations fail the build with
  file, line and the rule's reason.
- Two kinds of violations remain human judgement (headline line counts at three
  widths, and whether a screen carries enough substance). Those are recorded as
  unverified wherever a browser was required.
- Adding a legitimate exception means editing the checker with a comment explaining
  why — a reviewable act, unlike silently reintroducing a gradient.
