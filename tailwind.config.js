/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    // Not under extend: this replaces Tailwind's default `font-sans` stack with the brand
    // heading face, so every screen picks up real typography with no per-component changes.
    // `serif`/`mono` aren't touched — nothing in this app uses them.
    fontFamily: {
      sans: ["var(--font-brk-heading)"],
    },
    extend: {
      colors: {
        // Dark charcoal replacing pure black. "deep" = page/tab-bar background,
        // "panel" = cards/inputs, one shade lighter for visible separation.
        charcoal: {
          deep: "#151515",
          panel: "#202020",
        },
        // v5 app-wide design-system palette. Refined for the V2 transformation against the
        // approved reference image (BRKFIT Beginner Experience V2 board) — not a blind swap to
        // the brief's starting-point hex values. Verified by sampling the actual reference PNG's
        // dominant colors (histogram, not eyeballed): background clusters at #000000/#080808
        // (true near-black, darker than this palette's old #0A0A0B), the accent red clusters
        // tightly at #E00810-#E80810, and the card/surface tones step through #181818/#202020/
        // #282828/#383838. The brief's own proposed red (~#F10B20) lands almost exactly on that
        // measured cluster, so it's adopted directly; the brief's charcoal/surface proposals were
        // already within a few hex units of both the old tokens and the measured reference, so
        // those only get a small nudge rather than a rewrite. Text stays just short of pure
        // #FFFFFF (matching the reference's actual #F8F8F8, not literal white) — common dark-UI
        // practice to avoid halation on a near-black background.
        v5: {
          bg: "#050505",
          surface: "#121214",
          elevated: "#1B1B1E",
          muted: "#28282B",
          text: "#F2F3F4",
          subtext: "#A1A1AA",
          red: "#E8101D",
          "red-dim": "#7A0A10",
          success: "#29C17E",
        },
      },
      // Brand typography roles — point at the CSS custom properties defined in index.css so the
      // display/heading/body fonts can be swapped centrally in one place (index.css) once BRK's
      // final brand font is supplied, without touching any component that uses these utilities
      // (font-brk-display / font-brk-heading / font-brk-body).
      fontFamily: {
        "brk-display": ["var(--font-brk-display)"],
        "brk-heading": ["var(--font-brk-heading)"],
        "brk-body": ["var(--font-brk-body)"],
      },
      keyframes: {
        restFlash: {
          "0%, 100%": { backgroundColor: "#202020" },
          "50%": { backgroundColor: "rgba(220, 38, 38, 0.45)" },
        },
        // Subtle-only motion for BRK's "high-emotion moment" surfaces (workout completion hero,
        // PR callouts) — a brief settle-in, never a loop or a flashy transition (visual-evolution
        // task section 10: "PR badge brief pulse/fade-in; completion hero fade-in. No excessive
        // motion/particles/flashing").
        heroFadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        prPulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        "rest-flash": "restFlash 0.5s ease-in-out 4",
        "hero-fade": "heroFadeIn 0.5s ease-out both",
        "pr-pulse": "prPulse 1.4s ease-in-out 2",
      },
    },
  },
  plugins: [],
};
