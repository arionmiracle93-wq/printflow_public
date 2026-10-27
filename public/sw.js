/* Print Flow Service Worker — offline shell + Web Push Android/PWA */
const CACHE = "print-flow-shell-v13";
/* Salinan halaman Invoice (daftar & detail) agar bisa DIBUKA saat offline. Dihapus saat keluar akun.
   Versi naik dari v1 ke v2 karena kunci cache-nya berubah: versi v1 memakai
   url.pathname saja, sehingga semua URL yang bedanya cuma query string menimpa
   satu slot yang sama. Cache versi lama dibuang sendiri saat aktivasi (lihat
   blok "activate"). */
const PAGES = "print-flow-pages-v3";
/* File aplikasi bawaan Next.js yang namanya berisi hash (tidak berubah isinya) agar halaman salinan bisa tampil offline. */
const STATIC = "print-flow-static-v1";
/* Halaman yang boleh dibuka tanpa jaringan: home (pemilih modul),
   daftar invoice, dan detail invoice.

   "/" ikut ditambahkan pada versi ini. Sebelumnya home tidak ada di
   sini, padahal start_url aplikasi juga "/" - jadi begitu ikon aplikasi
   diketuk tanpa jaringan, yang muncul adalah offline.html, bukan
   pemilih modul. Sekarang itu sudah sesuai: yang tampil adalah salinan
   home terakhir.

   Yang ditampilkan di dalam home hanya nama pengguna dan status izin
   modul - bukan data tagihan. Dan salinan ini tetap dihapus saat
   keluar akun (lihat blok fetch di bawah), sama seperti salinan
   invoice yang jauh lebih sensitif.

   Versi naik dari v2 ke v3 karena daftar polanya berubah: perangkat
   lama harus membuang salinan v2 supaya tidak menyimpan "/ lama" yang
   isinya masih dashboard produksi.

   PENTING: "/$" ditulis sebagai "(?:$|...)" di dalam pola. Kalau
   "/" ditulis polos sebelum tanda "|", "/invoice/123" ikut cocok dan
   "/produksi" tetap tidak - persis seperti versi sebelumnya. */
const OFFLINE_OK = /^\/(?:$|invoice(?:\/\d+)?$)/;
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
        /* Kunci cache HARUS memuat query string juga.

           url.pathname hanya berisi "/invoice"; query seperti
           ?bulan=2026-10 atau ?dari=... ada di url.search. Kalau kunci
           hanya pathname, semua varian filter itu menimpa satu slot yang
           sama. Akibatnya: begitu putus jaringan, daftar yang tampil
           berisi filter milik kunjungan lain, sementara orang mengira
           itu daftar tanpa filter miliknya sendiri.

           Yang kedua: filter tanggal memengaruhi isian "Tagih lewat
           WhatsApp" dan kartu dokumen, jadi halaman yang tersimpan bukan
           sekadar daftar yang lebih panjang atau lebih pendek - isinya
           benar-benar berbeda. Karena itu tidak ada jalan pintas
           "kalau tidak ketemu, pakai /invoice polos": lebih baik
           memberitahu sedang offline daripada menampilkan daftar yang
           tidak sama dengan yang diminta.

           Catatan: cache.put pada kunci yang sudah ada menggeser
           posisinya ke belakang, jadi trimPages di bawah sudah bekerja
           seperti LRU tanpa perubahan tambahan. */
        const kunci = url.pathname + url.search;
        try {
          const res = await fetch(req);
          if (res.ok && !res.redirected && (res.headers.get("content-type") || "").includes("text/html")) {
            const cache = await caches.open(PAGES);
            await cache.put(kunci, res.clone());
            await trimPages(cache);
          }
          return res;
        } catch {
          const hit = await caches.match(kunci, { cacheName: PAGES });
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
