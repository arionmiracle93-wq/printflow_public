"use client";

import { useEffect, useRef } from "react";

/** Selang antar penyegaran berkala. */
const SELA_MS = 15 * 60 * 1000;
/** Jeda minimum antar panggilan, supaya dua pemicu yang datang
    bersamaan tidak menyebabkan permintaan beruntun. */
const JEDA_MIN_MS = 60 * 1000;

/**
 * JAGA SESI TETAP HIDUP SAAT APLIKASI DIPAKAI
 * ===================================================================
 * Token sesi berumur 12 jam, dihitung sejak login dan bukan sejak
 * aktivitas terakhir. Route /api/auth/refresh menerbitkannya ulang;
 * komponen ini adalah sisi kliennya.
 *
 * TIGA PEMICU
 *
 * 1. Sekali saat komponen dipasang, yaitu saat halaman pertama
 *    kali dibuka.
 *
 * 2. visibilitychange menjadi "visible". Ini yang paling penting
 *    untuk APK. Di HP orang biasanya membuka aplikasi, pindah ke
 *    WhatsApp, lalu kembali satu jam kemudian. Android tidak
 *    memanggil ulang halaman saat itu, jadi tanpa pemicu ini
 *    tidak ada yang memperpanjang sesi - padahal orangnya jelas
 *    sedang aktif memakai aplikasi.
 *
 * 3. Timer berkala selama tab terlihat. Pengaman untuk orang yang
 *    memakai aplikasi tanpa berganti halaman: satu tab yang
 *    dibiarkan terbuka berjam-jam tidak memicu focus maupun
 *    visibilitychange, padahal layarnya menyala.
 *
 * Timer berhenti saat tab disembunyikan, supaya tidak sibuk
 * memanggil server untuk halaman yang tidak sedang dilihat.
 *
 * KENAPA 15 MENIT
 * Jendela sesinya 12 jam, jadi setiap 15 menit memberi 48
 * kesempatan sebelum cookie benar-benar habis. Satu yang gagal -
 * jaringan jelek, HP tidur - tidak langsung mengakhiri sesi.
 * Jeda minimum 60 detik mencegah focus dan visibilitychange
 * yang datang bersamaan menyebabkan dua permintaan berturut.
 *
 * KENAPA DIAM-DIAM
 * Tidak ada indikator, tidak ada toast, tidak ada pengalihan
 * perhatian. Route mengembalikan 401 kalau sesi sudah tidak sah,
 * dan saat itu permintaan halaman berikutnya yang mengarahkan ke
 * login seperti biasa. Komponen ini tidak mengambil alih itu.
 */
export function SessionKeepAlive() {
  const terakhir = useRef(0);

  useEffect(() => {
    let dibatalkan = false;

    async function segarkan() {
      if (dibatalkan) return;
      // Jangan menabrak server kalau dua pemicu datang berdekatan.
      const sekarang = Date.now();
      if (sekarang - terakhir.current < JEDA_MIN_MS) return;
      terakhir.current = sekarang;
      try {
        await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
          headers: { "x-print-flow-keepalive": "1" },
          keepalive: true,
          cache: "no-store",
        });
      } catch {
        // Tidak ada yang perlu dilakukan. Kegagalan di sini bukan
        // berarti sesi berakhir - hanya satu penyegaran yang
        // gagal, dan ada empat puluh tujuh lagi setelahnya.
      }
    }

    function saatTerlihat() {
      if (document.visibilityState === "visible") void segarkan();
    }

    void segarkan();
    document.addEventListener("visibilitychange", saatTerlihat);
    window.addEventListener("focus", saatTerlihat);

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void segarkan();
    }, SELA_MS);

    return () => {
      dibatalkan = true;
      document.removeEventListener("visibilitychange", saatTerlihat);
      window.removeEventListener("focus", saatTerlihat);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}