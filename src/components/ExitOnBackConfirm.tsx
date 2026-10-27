"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const EXIT_WINDOW_MS = 2000;
const MARK = "printFlowExitGuard";

/** Halaman akar tiap modul. Dari sini tombol Back leading ke home. */
const AKAR_MODUL = ["/produksi", "/invoice"];

/**
 * PERILAKU TOMBOL BACK DI APLIKASI TERPASANG (D-04)
 * ===================================================================
 * Dua aturan berbeda, dan sengaja dipisah karena gejalanya berlawanan:
 *
 * 1. DI HOME ("/") - "tekan sekali lagi untuk keluar".
 *    Pola standar aplikasi Android. Kita selipkan satu entri
 *    "penyangga" di riwayat; back pertama menghabiskan penyangga itu -
 *    kita cegat, tampilkan toast, lalu pasang penyangga baru (posisi
 *    terasa tidak berubah). Back kedua dalam 2 detik tidak kita cegat
 *    lagi, dan kita coba window.close(). Kalau perangkat tidak
 *    mengizinkan penutupan lewat script, Android sendiri yang menutup
 *    aplikasi begitu back ditekan sekali lagi, karena riwayatnya
 *    memang sudah habis.
 *
 * 2. DI AKAR MODUL ("/produksi", "/invoice") - KEMBALI KE HOME.
 *    Tanpa aturan ini, orang yang membuka aplikasi lewat notifikasi
 *    (yang membawa "/pesanan/{id}") lalu mengetuk shortcut "/produksi"
 *    akan punya riwayat yang tidak memuat home sama sekali. Satu
 *    ketukan Back - satu-satunya jalan keluar dari halaman yang salah -
 *    lalu aplikasinya langsung tertutup. Padahal belum ada yang salah.
 *
 *    Perhatikan ini TIDAK berlaku untuk "/pesanan/{id}" dan seluruh
 *    halaman dalam modul. Di sana tombol Back harus tetap mengikuti
 *    riwayat browser biasa; memaksa semua back ke home akan membuat
 *    orang kehilangan jalan kembali ke daftar yang sedang dibaca.
 */
export function ExitOnBackConfirm() {
  const pathname = usePathname();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const armedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const diAkarModul = AKAR_MODUL.includes(pathname);

  useEffect(() => {
    const diHome = pathname === "/";
    if (!diHome && !diAkarModul) return;

    const current = window.history.state as Record<string, unknown> | null;
    if (!current || current[MARK] !== true) {
      window.history.pushState({ ...(current || {}), [MARK]: true }, "", window.location.href);
    }

    function handlePop() {
      /* Akar modul: satu Back sudah cukup untuk pulang ke home.
         Tidak ada konfirmasi, tidak ada jendela keluar. */
      if (diAkarModul) {
        router.replace("/");
        return;
      }
      if (armedRef.current) {
        window.close();
        return;
      }
      armedRef.current = true;
      setVisible(true);
      window.history.pushState({ [MARK]: true }, "", window.location.href);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        armedRef.current = false;
        setVisible(false);
      }, EXIT_WINDOW_MS);
    }

    window.addEventListener("popstate", handlePop);
    return () => {
      window.removeEventListener("popstate", handlePop);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      armedRef.current = false;
      setVisible(false);
    };
  }, [pathname, diAkarModul, router]);

  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[200] flex justify-center px-4 md:bottom-8">
      <div className="pointer-events-auto rounded-full bg-[#07384f] px-5 py-2.5 text-xs font-bold text-white shadow-[0_10px_30px_rgba(7,56,79,.35)]">
        Tekan sekali lagi untuk keluar
      </div>
    </div>
  );
}
