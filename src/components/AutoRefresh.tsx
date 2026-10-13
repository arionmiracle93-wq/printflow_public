"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * AUTO-REFRESH LAYAR (supaya banyak PC & HP yang membuka data yang sama tidak ketinggalan)
 * Menyegarkan data halaman secara halus (router.refresh: isian yang sedang diketik tidak hilang) saat:
 *  - aplikasi aktif kembali setelah ditinggal sebentar, atau internet kembali, dan
 *  - tiap 45 detik selama halaman terbuka dan terlihat.
 * TIDAK menyegarkan saat: layar tersembunyi / offline, ada jendela terbuka, kolom isian sedang dipakai,
 * atau di halaman formulir (buat/edit).
 */
const INTERVAL_MS = 45_000;
const MIN_HIDDEN_MS = 8_000;

const ALLOWED: RegExp[] = [
  /^\/$/,
  /^\/pesanan$/,
  /^\/pesanan\/\d+$/,
  /^\/serah-terima$/,
  /^\/mitra$/,
  /^\/pelanggan$/,
  /^\/invoice$/,
  /^\/invoice\/\d+$/,
  /^\/invoice\/laporan$/,
  /^\/invoice\/katalog$/,
];

function userIsBusy(): boolean {
  if (document.querySelector(".ppi-modal-back, [role='dialog']")) return true;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function AutoRefresh() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ALLOWED.some((re) => re.test(pathname))) return;
    let hiddenAt = 0;
    const refresh = () => {
      if (document.visibilityState !== "visible" || navigator.onLine === false || userIsBusy()) return;
      router.refresh();
    };
    const timer = setInterval(refresh, INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt >= MIN_HIDDEN_MS) {
        hiddenAt = 0;
        refresh();
      }
    };
    const onOnline = () => refresh();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [pathname, router]);

  return null;
}
