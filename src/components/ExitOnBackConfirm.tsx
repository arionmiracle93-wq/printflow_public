"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const EXIT_WINDOW_MS = 2000;
const MARK = "printFlowExitGuard";

/**
 * "Tekan/swipe back 2x untuk keluar" — hanya aktif di halaman utama ("/").
 *
 * Kenapa cuma di halaman utama: ini pola standar yang dipakai hampir semua
 * aplikasi Android (WhatsApp, Gojek, Shopee, dll) — di halaman lain, tombol
 * back tetap jalan normal (kembali ke layar sebelumnya). Di halaman utama,
 * back pertama menampilkan "tekan lagi untuk keluar"; back kedua dalam 2
 * detik benar-benar menutup aplikasi.
 *
 * Cara kerja: kita selipkan satu entri "penyangga" di riwayat browser saat
 * berada di halaman utama. Tekan back pertama menghabiskan penyangga itu —
 * kita cegat, tampilkan toast, lalu pasang penyangga baru (posisi terasa
 * tidak berubah). Tekan back kedua (dalam 2 detik) tidak kita cegat lagi,
 * dan kita coba window.close() — berhasil di banyak kasus karena saat itu
 * kita sudah berada persis di entri riwayat paling akhir. Kalau perangkat
 * tertentu tidak mengizinkan penutupan lewat script, Android sendiri yang
 * akan menutup aplikasi begitu tombol back ditekan sekali lagi (karena
 * riwayatnya memang sudah habis).
 */
export function ExitOnBackConfirm() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const armedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (pathname !== "/") return;

    const current = window.history.state as Record<string, unknown> | null;
    if (!current || current[MARK] !== true) {
      window.history.pushState({ ...(current || {}), [MARK]: true }, "", window.location.href);
    }

    function handlePop() {
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
  }, [pathname]);

  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[200] flex justify-center px-4 md:bottom-8">
      <div className="pointer-events-auto rounded-full bg-[#07384f] px-5 py-2.5 text-xs font-bold text-white shadow-[0_10px_30px_rgba(7,56,79,.35)]">
        Tekan sekali lagi untuk keluar
      </div>
    </div>
  );
}
