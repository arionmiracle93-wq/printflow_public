"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Baris teks kecil di atas foto hero yang bergonta-ganti otomatis,
 * dilengkapi titik indikator seperti carousel foto pada referensi desain.
 * Sumber teksnya tetap sorotan AI (insight.highlights), cuma disajikan
 * satu baris per waktu supaya kartu hero tidak penuh teks.
 *
 * Optimasi scroll (Oktober 2026), tampilan TIDAK berubah:
 *
 * 1. Tinggi stabil. Dulu hanya teks aktif yang dirender. Kalau teks A
 *    satu baris dan teks B dua baris, tinggi hero berubah setiap 4,5 detik
 *    dan SELURUH isi halaman di bawahnya ikut bergeser, termasuk saat
 *    pengguna sedang menggulir. Rasanya seperti halaman tersentak.
 *    Sekarang semua teks ditumpuk di sel grid yang sama, jadi tinggi
 *    wadah selalu mengikuti teks terpanjang dan tidak pernah berubah.
 *    Yang berganti hanya opacity, dikerjakan GPU, tanpa hitung ulang tata letak.
 *
 * 2. Berhenti saat tidak terlihat. Pergantian teks dijeda ketika hero
 *    sudah tergulir keluar layar atau tab tidak aktif.
 */
export function HeroHighlightsCarousel({ items }: { items: string[] }) {
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (items.length <= 1) return;
    let timer: number | undefined;
    let onScreen = true;

    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      if (timer !== undefined || !onScreen || document.visibilityState !== "visible") return;
      timer = window.setInterval(() => setIndex((i) => (i + 1) % items.length), 4500);
    };

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
  }, [items.length]);

  if (items.length === 0) return null;

  const safeIndex = index % items.length;

  return (
    <div ref={ref} className="mt-1">
      <div className="grid" aria-live="polite">
        {items.map((text, i) => (
          <p
            key={i}
            aria-hidden={i !== safeIndex}
            data-active={i === safeIndex ? "" : undefined}
            className="pf-hl-item text-[11px] leading-relaxed text-white/85 [grid-area:1/1] md:text-xs"
          >
            {text}
          </p>
        ))}
      </div>
      {items.length > 1 ? (
        <div className="mt-2 flex items-center gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Lihat sorotan ${i + 1} dari ${items.length}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === safeIndex ? "w-5 bg-amber-300" : "w-1.5 bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
