import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import DevAnatomyShowcase from "./components/DevAnatomyShowcase.jsx";
import "./index.css";

// Internal anatomy QA view — reachable only by explicitly adding ?devAnatomy=1 to the URL, never
// linked from any nav/button/settings screen a normal athlete would encounter.
const isDevAnatomyRoute = new URLSearchParams(window.location.search).get("devAnatomy") === "1";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isDevAnatomyRoute ? <DevAnatomyShowcase /> : <App />}
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
