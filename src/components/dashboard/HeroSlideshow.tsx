"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";

/**
 * SLIDESHOW FOTO HERO DASHBOARD
 * ---------------------------------------------------------------
 * 3 slide, geser ke kiri tiap INTERVAL_MS (6 detik), berputar terus.
 * Tanpa titik indikator. Gradasi TIDAK ada di sini — itu tugas
 * .hero-photo-bg di globals.css (lapisan di atas slideshow ini).
 *
 * SET FOTO TERANG & GELAP
 *   Setiap slide punya pasangan gambar sendiri untuk tema terang dan
 *   gelap, masing-masing dengan versi desktop + HP. Pemilihan gambar
 *   dilakukan lewat CSS (.hero-slide + variabel --hero-* di bawah),
 *   bukan state React, supaya:
 *     - tema sudah benar sejak paint pertama (tidak berkedip);
 *     - browser hanya mengunduh set gambar tema yang sedang aktif.
 *
 * DAFTAR FOTO (taruh di /public/images/):
 *   Slide 1 terang : dashboard-hero-light.jpg        / -light-mobile.jpg
 *   Slide 1 gelap  : dashboard-hero.jpg              / -mobile.jpg
 *   Slide 2 terang : dashboard-hero-2-light.jpg      / -2-light-mobile.jpg
 *   Slide 2 gelap  : dashboard-hero-2.jpg            / -2-mobile.jpg
 *   Slide 3 terang : dashboard-hero-3-light.jpg      / -3-light-mobile.jpg
 *   Slide 3 gelap  : dashboard-hero-3.jpg            / -3-mobile.jpg
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
 *   - Latar fallback dibuat terang di tema terang dan navy di tema
 *     gelap, jadi panel tetap rapi walau ada gambar yang belum ada.
 */

type SlideImages = { desktop: string; mobile: string };
type Slide = { light: SlideImages; dark: SlideImages };

const SLIDES: Slide[] = [
  {
    light: { desktop: "/images/dashboard-hero-light.jpg", mobile: "/images/dashboard-hero-light-mobile.jpg" },
    dark: { desktop: "/images/dashboard-hero.jpg", mobile: "/images/dashboard-hero-mobile.jpg" },
  },
  {
    light: { desktop: "/images/dashboard-hero-2-light.jpg", mobile: "/images/dashboard-hero-2-light-mobile.jpg" },
    dark: { desktop: "/images/dashboard-hero-2.jpg", mobile: "/images/dashboard-hero-2-mobile.jpg" },
  },
  {
    light: { desktop: "/images/dashboard-hero-3-light.jpg", mobile: "/images/dashboard-hero-3-light-mobile.jpg" },
    dark: { desktop: "/images/dashboard-hero-3.jpg", mobile: "/images/dashboard-hero-3-mobile.jpg" },
  },
];

const INTERVAL_MS = 6000;
const SLIDE_MS = 900;

// true  = hormati pengaturan "kurangi gerakan" milik perangkat (pudar, tanpa geser).
// false = SELALU geser, di semua perangkat. Pilih false hanya kalau kamu sengaja
//         mau efek geser tampil walau perangkat pengunjung minta gerakan dikurangi.
const RESPECT_REDUCED_MOTION = true;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onStoreChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

export function HeroSlideshow() {
  // active = slide yang tampil, prev = slide yang baru saja keluar.
  // Disatukan dalam 1 state supaya update-nya selalu serempak.
  const [pos, setPos] = useState<{ active: number; prev: number | null }>({ active: 0, prev: null });
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const { active, prev } = pos;
  const useFade = RESPECT_REDUCED_MOTION && reduceMotion;

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
    <div className="absolute inset-0 -z-20 overflow-hidden bg-[#eaf6fb] dark:bg-[#07141d]" aria-hidden>
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
        // Variabel CSS ini dibaca .hero-slide di globals.css. Dengan cara
        // ini tema terang/gelap diganti murni oleh CSS, tanpa hydration
        // flash dan tanpa mengunduh dua set gambar sekaligus.
        const themeImages = {
          "--hero-light-mobile": `url("${slide.light.mobile}")`,
          "--hero-light-desktop": `url("${slide.light.desktop}")`,
          "--hero-dark-mobile": `url("${slide.dark.mobile}")`,
          "--hero-dark-desktop": `url("${slide.dark.desktop}")`,
        } as CSSProperties;

        return <div key={i} className="hero-slide absolute inset-0 will-change-transform" style={{ ...style, ...themeImages }} />;
      })}
    </div>
  );
}
