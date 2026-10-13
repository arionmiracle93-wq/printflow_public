"use client";

import { useState } from "react";

/**
 * Logo usaha di kop dokumen (memakai logo PrintFlow). Kalau belum ada logo atau gagal
 * dimuat, logo DISEMBUNYIKAN sama sekali - tidak meninggalkan gambar rusak di cetakan/PDF.
 *
 * Tanpa kotak latar: dulu ada border + bg putih sebagai alas, jadi logo terlihat
 * seperti stempel kecil di dalam kartu. Sekarang logonya berdiri sendiri, sedikit
 * lebih besar (56 -> 64px) supaya tidak kalah kecil dari judul usaha di sebelahnya.
 */
export function PaperLogo() {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/branding/logo"
        alt=""
        className="h-full w-full object-contain"
        onError={() => setFailed(true)}
        ref={(el) => {
          // Gambar bisa gagal sebelum React sempat memasang onError (saat halaman baru dimuat).
          if (el && el.complete && el.naturalWidth === 0) setFailed(true);
        }}
      />
    </span>
  );
}
