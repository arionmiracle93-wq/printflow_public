"use client";

import { useEffect, useState } from "react";

/**
 * Baris teks kecil di atas foto hero yang bergonta-ganti otomatis,
 * dilengkapi titik indikator seperti carousel foto pada referensi desain.
 * Sumber teksnya tetap sorotan AI (insight.highlights) — cuma disajikan
 * satu baris per waktu supaya kartu hero tidak penuh teks.
 */
export function HeroHighlightsCarousel({ items }: { items: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;

  const safeIndex = index % items.length;

  return (
    <div className="mt-1">
      <p key={safeIndex} className="hero-fade text-[11px] leading-relaxed text-white/85 md:text-xs">
        {items[safeIndex]}
      </p>
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
