"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * WADAH GESER KARTU ANTREAN (HP dan tablet)
 * ---------------------------------------------------------------
 * Satu kartu memenuhi satu layar (aturan lebar ada di .pf-swipe,
 * dashboard.css). Karena kartu berikutnya tidak lagi mengintip dari
 * tepi layar, komponen ini menambahkan titik penunjuk posisi di
 * bawahnya, supaya pengguna tahu masih ada kartu lain.
 *
 * Posisi dibaca dengan IntersectionObserver, bukan event scroll,
 * jadi tidak memicu render ulang di setiap piksel geseran dan tetap
 * ringan di WebView APK. Titik bisa diketuk untuk melompat.
 *
 * Kartu tetap dirender di server; komponen ini hanya pembungkus.
 */
export function SwipeTrack({ children, className = "" }: { children: ReactNode; className?: string }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const items = Children.toArray(children);
  const count = items.length;

  useEffect(() => {
    const track = trackRef.current;
    if (!track || count <= 1) return;
    const slides = Array.from(track.children) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = slides.indexOf(entry.target as HTMLElement);
            if (index !== -1) setActive(index);
          }
        }
      },
      { root: track, threshold: 0.6 },
    );

    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [count]);

  function goTo(index: number) {
    const track = trackRef.current;
    const slide = track?.children[index] as HTMLElement | undefined;
    if (!track || !slide) return;
    const padding = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const left = track.scrollLeft + (slide.getBoundingClientRect().left - track.getBoundingClientRect().left) - padding;
    track.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <div className={className}>
      <div ref={trackRef} className="pf-swipe -mx-3 px-3 sm:-mx-4 sm:px-4" aria-roledescription="carousel">
        {items.map((child, i) => (
          <div key={i} className="flex [&>*]:w-full" aria-roledescription="slide" aria-label={`Kartu ${i + 1} dari ${count}`}>
            {child}
          </div>
        ))}
      </div>

      {count > 1 ? (
        <div className="pf-swipe-dots md:hidden">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              className="pf-swipe-hit"
              onClick={() => goTo(i)}
              aria-label={`Tampilkan kartu ${i + 1} dari ${count}`}
            >
              <span className="pf-swipe-dot" aria-current={i === active ? "true" : undefined} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
