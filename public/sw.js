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
  // Today is BRK's default landing tab, so focusing/opening "/" already satisfies "deep-link to
  // Today's workout" for every current notification type (rest-complete, workout reminder) with
  // no client-side route to thread through — this just names that fact rather than leaving it
  // implicit, so a future notification type with a real non-Today target has an obvious place to
  // extend (event.notification.data?.deepLink).
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});

// ---------------- WEB PUSH (scaffolded, not yet live) ----------------
// This listener is real and will correctly show a notification the instant something actually
// sends a push to a subscribed browser — but nothing in BRK's deployed stack does that yet.
// Live delivery needs: a generated VAPID keypair, a deployed Supabase Edge Function holding the
// private key as a secret and calling web-push, and a pg_cron schedule invoking it periodically
// (see supabase_schema_reminders.sql's push_subscriptions table + its header comment for the
// exact remaining steps). Until that's deployed, no subscription is ever created client-side
// (see src/utils/workoutReminders.js), so this handler simply never receives an event — it's
// forward-compatible scaffolding, not a claim that background push already works.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const title = payload.title || "BRK";
  const options = {
    body: payload.body || "",
    icon: "/apple-touch-icon.png",
    tag: payload.tag || "brk-push",
    renotify: true,
    data: { deepLink: payload.deepLink || "today" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
