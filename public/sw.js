/* Print Flow Service Worker — offline shell + Web Push Android/PWA */
const CACHE = "print-flow-shell-v12";
const SHELL = [
  "/offline.html",
  "/api/pwa/manifest",
  "/api/pwa/icon/192.png?v=printer-1",
  "/api/pwa/icon/512.png?v=printer-1",
  "/api/pwa/badge/96.png?v=printer-mono-1",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/* Data pekerjaan tidak di-cache. Hanya navigasi yang mendapat halaman offline saat jaringan putus. */
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
  const title = data.title || "Print Flow";
  const options = {
    body: data.body || "Ada pembaruan pekerjaan.",
    icon: "/api/pwa/icon/512.png",
    badge: "/api/pwa/badge/96.png",
    tag: data.tag || "print-flow-update",
    renotify: true,
    requireInteraction: Boolean(data.requireInteraction),
    vibrate: [180, 80, 180],
    data: { url: data.url || "/" },
    actions: [{ action: "open", title: "Buka Print Flow" }],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    }),
  );
});
