import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
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
