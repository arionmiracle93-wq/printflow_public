"use client";

import { useEffect } from "react";

/**
 * Registrasi service worker sekali untuk PWA, offline fallback, dan Web Push.
 *
 * TAPI DI MODE DEVELOPMENT service worker DIMATIKAN.
 *
 * Alasannya (bukan teori - sudah diuji di aplikasi ini):
 * `next dev` (Turbopack) menyajikan berkas JavaScript sebagai
 * navigasi yang dilayani service worker. Akibatnya halaman yang
 * dimuat lewat service worker TIDAK ME-HYDRATE: React tidak pernah
 * memasang penangan klik/ketik, jadi tombol tidak merespons, pencarian
 * tidak menyaring, dan mengetik di kolom pencarian hanya mengubah
 * tulisan di layar tanpa efek apa pun.
 *
 * Yang paling sering memicu: service worker dari pemakaian sebelumnya
 * (mis. sempat menjalankan `npm start` versi produksi di port yang sama)
 * masih hidup dan terus menyalurkan permintaan navigasi.
 *
 * Yang dilakukan di development:
 *   1. service worker yang sudah terdaftar DIHAPUS (kalau ada), dan
 *   2. service worker baru TIDAK didaftarkan.
 * Cache lamanya juga dibersihkan supaya tidak ada berkas lama yang
 * tersisa.
 *
 * Di production TIDAK ada yang berubah: service worker tetap
 * didaftarkan supaya PWA, mode offline, dan Web Push tetap jalan.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "development") {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister();
      });
      void caches.keys().then((keys) => {
        for (const key of keys) {
          if (key.startsWith("print-flow-")) void caches.delete(key);
        }
      });
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);
  return null;
}
