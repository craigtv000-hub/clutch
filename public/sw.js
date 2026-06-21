// sw.js — the service worker.
// This tiny script runs in the background even when the app/tab is closed.
// When your server sends a push, this is what actually shows the notification
// on the phone's lock screen and handles taps.

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || "⚡ CLUTCH";
  const options = {
    body: data.body || "A game just got good.",
    tag: data.tag || "clutch",
    data: { url: data.url || "/" },
    badge: "/icons/badge.png",
    icon: "/icons/icon-192.png",
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
