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
    },
  },
  plugins: [],
};
