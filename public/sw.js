/* Print Flow Service Worker — offline shell + Web Push Android/PWA */
const CACHE = "print-flow-shell-v13";
/* Salinan halaman Invoice (daftar & detail) agar bisa DIBUKA saat offline. Dihapus saat keluar akun. */
const PAGES = "print-flow-pages-v1";
/* File aplikasi bawaan Next.js yang namanya berisi hash (tidak berubah isinya) agar halaman salinan bisa tampil offline. */
const STATIC = "print-flow-static-v1";
const OFFLINE_OK = /^\/invoice(\/\d+)?$/;
const MAX_PAGES = 25;
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
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key !== PAGES && key !== STATIC).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function trimPages(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_PAGES; i += 1) await cache.delete(keys[i]);
}

/*
 * Data pekerjaan/invoice tidak di-cache sembarangan. Yang disimpan hanya:
 *  - salinan halaman /invoice dan /invoice/<id> terakhir yang dibuka (network-first: online = selalu data terbaru;
 *    putus jaringan = salinan terakhir), dihapus saat keluar akun;
 *  - file aplikasi /_next/static yang bertanda immutable (bernama hash) supaya salinan itu bisa tampil.
 * Navigasi lain yang gagal mendapat halaman offline.
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Keluar akun (tombol Keluar maupun sesi berakhir): hapus salinan halaman dari perangkat.
  if (url.pathname === "/api/auth/logout") {
    event.respondWith(fetch(req).finally(() => caches.delete(PAGES)));
    return;
  }
  if (req.method !== "GET") return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && /immutable/.test(res.headers.get("cache-control") || "")) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode !== "navigate") return;

  if (OFFLINE_OK.test(url.pathname)) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && !res.redirected && (res.headers.get("content-type") || "").includes("text/html")) {
            const cache = await caches.open(PAGES);
            await cache.put(url.pathname, res.clone());
            await trimPages(cache);
          }
          return res;
        } catch {
          const hit = await caches.match(url.pathname, { cacheName: PAGES });
          return hit || (await caches.match("/offline.html"));
        }
      })(),
    );
    return;
  }

  event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
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
