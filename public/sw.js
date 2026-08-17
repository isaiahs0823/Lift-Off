// ---------------- BRK service worker ----------------
// Minimal by design. BRK has no offline/caching strategy today, and adding one is a separate,
// deliberate decision — not a side effect of wanting rest-timer notifications. This worker
// deliberately has NO fetch handler, so it can never intercept, cache, or interfere with any
// network request BRK makes (the Coach chat stream, the USDA food-search proxy, anything).
//
// Its only two jobs:
//   1. Exist and stay active, so navigator.serviceWorker.controller is truthy — that's what lets
//      showBackgroundNotification() in src/App.jsx use registration.showNotification() instead
//      of a bare `new Notification()`, which is better supported for a backgrounded-but-alive
//      tab on several browsers.
//   2. Route a tap on a "REST COMPLETE" notification back into BRK.
//
// This does NOT provide real push notifications while the phone is locked or BRK is fully
// suspended — that requires Web Push (a server-held subscription + something to trigger the
// send), which needs backend infrastructure BRK doesn't have yet. See src/App.jsx's
// showBackgroundNotification() for the full explanation.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
