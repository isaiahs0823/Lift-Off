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
