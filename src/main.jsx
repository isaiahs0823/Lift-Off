import React from "react";
import ReactDOM from "react-dom/client";
import PersistenceBoundary from "./persistence/PersistenceBoundary.jsx";
import DevAnatomyShowcase from "./components/DevAnatomyShowcase.jsx";
import "./index.css";

// Internal anatomy QA view — reachable only by explicitly adding ?devAnatomy=1 to the URL, never
// linked from any nav/button/settings screen a normal athlete would encounter.
const isDevAnatomyRoute = new URLSearchParams(window.location.search).get("devAnatomy") === "1";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isDevAnatomyRoute ? <DevAnatomyShowcase /> : <PersistenceBoundary />}
  </React.StrictMode>
);

// Registers public/sw.js (see that file for exactly what it does and doesn't do — no fetch
// handler, no caching, purely rest-timer-notification plumbing). Best-effort: BRK works
// completely normally without it, so a registration failure is silently swallowed rather than
// surfaced anywhere the athlete would see it.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// A hard pinch-zoom block (gesturestart/gesturechange/multi-touch touchmove preventDefault) used
// to live here. Removed: it blocked pinch-zoom unconditionally in BOTH directions, so any athlete
// who ended up zoomed in for any reason at all — an iOS input-focus auto-zoom slipping past the
// 16px guard (index.css), a double-tap slipping past touch-action: manipulation, or anything not
// yet identified — had no way to manually pinch back out again, which is strictly worse than the
// accidental-zoom bug it was meant to prevent. Double-tap-zoom and the input-focus auto-zoom are
// still independently guarded (index.css); this only restores the escape hatch for whatever isn't.
