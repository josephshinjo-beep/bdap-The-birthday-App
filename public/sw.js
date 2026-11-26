/* bdap service worker: shows pushes and opens their link when tapped. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "bdap", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "bdap";
  const priority = Boolean(data.priority);
  // Priority (birthday reminders): stays on screen until dismissed, vibrates,
  // and re-alerts if an older one with the same tag is still showing.
  event.waitUntil(
    self.registration.showNotification(priority ? "🎂 " + title : title, {
      body: data.body || "",
      icon: "/icons/192",
      badge: "/icons/192",
      tag: data.tag || undefined,
      renotify: priority && Boolean(data.tag),
      requireInteraction: priority,
      silent: false,
      vibrate: priority ? [220, 90, 220, 90, 420] : [120],
      timestamp: Date.now(),
      actions: priority && data.url ? [{ action: "open", title: "Open" }] : [],
      data: { url: data.url || "/rooms" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "/rooms";
  // Only open pages on this site.
  const target = new URL(raw, self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin + "/rooms";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
