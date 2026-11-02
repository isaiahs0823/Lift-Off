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

// Hard pinch-zoom block. index.html's viewport meta (maximum-scale=1.0, user-scalable=no) looks
// like it should do this on its own, but it doesn't on iOS: Safari has deliberately ignored that
// restriction since iOS 10 as an accessibility guarantee (zoom must always be available on any
// page via *some* mechanism), so on a real iPhone that meta tag is a no-op and pinch-zoom still
// gets through — confirmed live, the previous fix did not hold. The only mechanism iOS actually
// honors is intercepting the gesture itself: `gesturestart`/`gesturechange` (Safari's own
// pinch-gesture events) and any `touchmove` carrying 2+ touch points. preventDefault() on both
// stops the zoom from ever starting — there's nothing in BRK that legitimately needs two-finger
// touch (single-column layout, no maps/images meant to be pinch-zoomed), so blocking it
// unconditionally is safe. `{ passive: false }` is required or preventDefault() on touchmove is
// silently ignored.
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);
