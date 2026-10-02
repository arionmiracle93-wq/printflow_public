"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock } from "lucide-react";

/* Formatter dibuat sekali saja. Versi sebelumnya membuat tiga objek
   Intl.DateTimeFormat baru setiap detik, pekerjaan kecil yang sia-sia
   di HP kelas bawah. Hasil teksnya sama persis. */
const DATE_FMT = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
const TIME_FMT = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const ZONE_FMT = new Intl.DateTimeFormat("id-ID", { timeZoneName: "short" });

function formatLocal(date: Date) {
  const zone = ZONE_FMT.formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  return `${DATE_FMT.format(date)}, ${TIME_FMT.format(date)}${zone ? ` ${zone}` : ""}`.toUpperCase();
}

/**
 * Jam live berdasarkan perangkat/browser pengguna, bukan waktu server Vercel.
 *
 * Optimasi scroll (Oktober 2026):
 * Jam ini berada di dalam hero foto. Setiap kali angkanya berganti, browser
 * harus menggambar ulang area hero. Kalau itu terjadi setiap detik SAMBIL
 * pengguna menggulir, HP kelas menengah ke bawah terasa tersendat sekali
 * per detik. Karena itu jam hanya berdetak saat benar-benar terlihat di
 * layar dan tab sedang aktif. Begitu hero tergulir keluar layar, jam
 * berhenti; begitu kembali terlihat, jam langsung diperbarui dan berdetak lagi.
 */
export function LocalDateTime() {
  const [value, setValue] = useState<string>("");
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    let onScreen = true;

    const update = () => setValue(formatLocal(new Date()));
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      if (timer !== undefined || !onScreen || document.visibilityState !== "visible") return;
      update();
      timer = window.setInterval(update, 1_000);
    };

    update();
    start();

    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    document.addEventListener("visibilitychange", onVisibility);

    let observer: IntersectionObserver | undefined;
    if (ref.current && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) start();
        else stop();
      });
      observer.observe(ref.current);
    }

    return () => {
      stop();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <span ref={ref} className="flex items-center gap-2" suppressHydrationWarning>
      <CalendarClock size={14} />
      {/* tabular-nums: lebar tiap digit sama, jadi teks tidak "bergetar"
          melebar-menyempit setiap detik. */}
      <span className="[font-variant-numeric:tabular-nums]">{value || "MEMBACA WAKTU PERANGKAT…"}</span>
    </span>
  );
}
