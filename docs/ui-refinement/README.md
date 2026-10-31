# UI refinement — before/after

Mobile (390x844) screenshots from the production build, seeded with an identical active-program
state (`Upper Lower`, day 3 of the cycle) on both sides so the comparison is apples-to-apples.
Captured via Playwright against `vite preview` (production build), not the dev server — see this
branch's commit for why (React 18 StrictMode's dev-only double-effect-invocation raced the
app's single-editor Web Lock in `vite dev`, a pre-existing timing issue unrelated to this UI work
and not reproducible in the production build users actually get).

## Today — unchanged

`screenshots/before-today.png` vs `screenshots/after-today.png` — pixel-identical. Today already
had exactly one dominant Start action and no competing controls; the only change here
(`photoSlot="todayHeader"` on its `PhotoHero` calls) is inert until a real photo is supplied.

## Train — competing-CTA fix

`screenshots/before-train.png` vs `screenshots/after-train.png` — before, the active-program
HeroCard's own "Start" button and a second, unconditional "Start workout today" button both
rendered at once. After, the second control demotes to a plain text link ("Or start something
else") whenever the hero card is already showing its own Start action.

## v2 — typography + hero treatment

`after-*.png` (the first pass above) kept the generic system sans font and a flat gradient —
correctly called out as "looks the exact same." `screenshots/v2-today.png` and
`screenshots/v2-train.png` are the corrected pass: Anton/Oswald (Google Fonts, SIL OFL) now
drive every screen's type instead of the system stack, and PhotoHero's fallback got a layered
gradient + red glow + vignette + accent bar in place of the old flat two-stop wash. See the
UI-correction commit for the full rationale.
