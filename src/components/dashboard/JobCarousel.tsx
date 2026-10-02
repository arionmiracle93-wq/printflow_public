"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * CAROUSEL KARTU PEKERJAAN (revisi UI)
 * --------------------------------------------------------------
 * Perilaku di HP sama seperti versi lama (geser 1 kartu penuh per
 * layar, snap mandatory). Yang BARU:
 *  - titik indikator di bawah kartu, jadi pengguna tahu ada berapa
 *    kartu dan sedang di kartu ke berapa;
 *  - titik bisa diketuk untuk melompat ke kartu tertentu;
 *  - di layar md+ berubah jadi grid 2 kolom (indikator disembunyikan).
 *
 * Komponen ini hanya "pembungkus tampilan" — kartu tetap dirender
 * di server (page.tsx), jadi tidak ada data yang pindah ke client.
 */
export function JobCarousel({ children }: { children: ReactNode[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const count = children.length;

  const handleScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.clientWidth || 1;
    setActive(Math.round(el.scrollLeft / slide));
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  function goTo(i: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div>
      <div
        ref={trackRef}
        className="pf-snap -mx-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4 md:mx-0 md:grid md:grid-cols-2 md:gap-3 md:overflow-visible md:px-0 md:pb-0 md:[scroll-snap-type:none]"
      >
        {children.map((child, i) => (
          <div key={i} className="w-full shrink-0 md:w-auto md:shrink">
            {child}
          </div>
        ))}
      </div>

      {count > 1 ? (
        <div className="mt-2.5 flex items-center justify-center gap-1.5 md:hidden">
          {children.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Lihat kartu ${i + 1} dari ${count}`}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-6 bg-teal-500" : "w-1.5 bg-slate-300 dark:bg-white/20"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
