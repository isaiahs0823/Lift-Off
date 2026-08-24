/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Dark charcoal replacing pure black. "deep" = page/tab-bar background,
        // "panel" = cards/inputs, one shade lighter for visible separation.
        charcoal: {
          deep: "#151515",
          panel: "#202020",
        },
        // v5 workout redesign palette — additive, scoped to the active-workout screens
        // (TrainTab, StartWorkoutChoice, TrainingExerciseCard, GuidedRunView, RestTimer). Kept
        // separate from `charcoal`/Tailwind's `red` rather than overwriting them so every other
        // existing screen's look is untouched.
        v5: {
          bg: "#0A0A0B",
          surface: "#111215",
          elevated: "#1A1C1F",
          muted: "#2A2D31",
          text: "#E8E9EA",
          subtext: "#9AA0A6",
          red: "#D2262E",
          "red-dim": "#7A1015",
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
      },
      animation: {
        "rest-flash": "restFlash 0.5s ease-in-out 4",
      },
    },
  },
  plugins: [],
};
