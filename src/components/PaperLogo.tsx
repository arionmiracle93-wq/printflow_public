"use client";

import { useState } from "react";

/**
 * Logo usaha di kop dokumen (memakai logo PrintFlow). Kalau belum ada logo atau gagal
 * dimuat, kotaknya DISEMBUNYIKAN sama sekali - tidak meninggalkan gambar rusak di cetakan/PDF.
 */
export function PaperLogo() {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/branding/logo"
        alt=""
        className="h-full w-full object-contain p-1"
        onError={() => setFailed(true)}
        ref={(el) => {
          // Gambar bisa gagal sebelum React sempat memasang onError (saat halaman baru dimuat).
          if (el && el.complete && el.naturalWidth === 0) setFailed(true);
        }}
      />
    </span>
  );
}
