"use client";

import { useEffect, useState } from "react";

/**
 * SLIDESHOW FOTO HERO DASHBOARD
 * ---------------------------------------------------------------
 * 3 slide, geser ke kiri tiap INTERVAL_MS (6 detik), berputar terus.
 * Tanpa titik indikator. Gradasi gelap TIDAK ada di sini — itu tugas
 * .hero-photo-bg di globals.css (lapisan di atas slideshow ini).
 *
 * DAFTAR FOTO (taruh di /public/images/):
 *   Slide 1: dashboard-hero.jpg   (desktop)  dashboard-hero-mobile.jpg   (HP)  <- file lama, tetap dipakai
 *   Slide 2: dashboard-hero-2.jpg (desktop)  dashboard-hero-2-mobile.jpg (HP)
 *   Slide 3: dashboard-hero-3.jpg (desktop)  dashboard-hero-3-mobile.jpg (HP)
 *
 * Ganti jumlah slide / nama file / interval cukup di SLIDES & INTERVAL_MS.
 *
 * Catatan teknis:
 *   - Animasi cuma transform (translateX), ringan buat GPU HP.
 *   - Berhenti saat tab tidak aktif. Kalau perangkat mengaktifkan
 *     "kurangi gerakan", foto TETAP berganti tiap 6 detik tapi pakai
 *     pudar halus (opacity), bukan geser — jadi slideshow tidak pernah
 *     mati total, hanya gerakannya yang dilembutkan.
 *   - Tiap slide punya 3 keadaan: aktif (x = 0), keluar (x = -100%,
 *     dianimasikan), menunggu (x = +100%, TANPA animasi, siap masuk
 *     dari kanan). Makanya putaran dari slide terakhir ke pertama
 *     tetap geser mulus ke kiri, tidak mundur lintas semua slide.
 *   - Foto yang belum ada otomatis disembunyikan (onError), jadi
 *     panel tetap rapi walau baru isi sebagian.
 */

const SLIDES = [
  { desktop: "/images/dashboard-hero.jpg", mobile: "/images/dashboard-hero-mobile.jpg" },
  { desktop: "/images/dashboard-hero-2.jpg", mobile: "/images/dashboard-hero-2-mobile.jpg" },
  { desktop: "/images/dashboard-hero-3.jpg", mobile: "/images/dashboard-hero-3-mobile.jpg" },
];

const INTERVAL_MS = 6000;
const SLIDE_MS = 900;

// true  = hormati pengaturan "kurangi gerakan" milik perangkat (pudar, tanpa geser).
// false = SELALU geser, di semua perangkat. Pilih false hanya kalau kamu sengaja
//         mau efek geser tampil walau perangkat pengunjung minta gerakan dikurangi.
const RESPECT_REDUCED_MOTION = true;

export function HeroSlideshow() {
  // active = slide yang tampil, prev = slide yang baru saja keluar.
  // Disatukan dalam 1 state supaya update-nya selalu serempak.
  const [pos, setPos] = useState<{ active: number; prev: number | null }>({ active: 0, prev: null });
  const [reduceMotion, setReduceMotion] = useState(false);
  const { active, prev } = pos;
  const useFade = RESPECT_REDUCED_MOTION && reduceMotion;

  // Pantau pengaturan "kurangi gerakan" milik perangkat.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Pemutar slide: jalan terus, hanya menunda saat tab tidak terlihat.
  useEffect(() => {
    if (SLIDES.length < 2) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      setPos((cur) => ({ active: (cur.active + 1) % SLIDES.length, prev: cur.active }));
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 -z-20 overflow-hidden bg-[#07141d]" aria-hidden>
      {SLIDES.map((slide, i) => {
        const isActive = i === active;
        const isLeaving = i === prev && !isActive;
        const transform = isActive ? "translateX(0)" : isLeaving ? "translateX(-100%)" : "translateX(100%)";
        const style = useFade
          ? // Mode kurangi gerakan: tanpa geser, cukup pudar halus.
            { opacity: isActive ? 1 : 0, transition: "opacity 700ms ease" }
          : {
              transform,
              // Hanya slide aktif & yang keluar yang dianimasikan.
              // Slide "menunggu" pindah ke kanan secara instan.
              transition:
                isActive || isLeaving ? `transform ${SLIDE_MS}ms cubic-bezier(0.65, 0, 0.35, 1)` : "none",
            };

        return (
          <picture key={slide.desktop}>
            <source media="(min-width: 768px)" srcSet={slide.desktop} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.mobile}
              alt=""
              draggable={false}
              loading="eager"
              fetchPriority={i === 0 ? "high" : "low"}
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
              className="absolute inset-0 h-full w-full object-cover will-change-transform"
              style={style}
            />
          </picture>
        );
      })}
    </div>
  );
}
