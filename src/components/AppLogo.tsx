"use client";

import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";

/**
 * Menampilkan logo usaha dari database; marka Print Flow menjadi fallback
 * bila pemilik belum mengunggah logonya (atau gambarnya gagal dimuat).
 */
export function AppLogo({ size = 40 }: { size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) return <BrandMark size={size} />;

  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden border border-white/25 bg-white transition-transform duration-300 group-hover:rotate-[-3deg]"
      style={{ width: size, height: size, borderRadius: Math.max(10, size * .3), boxShadow: "0 6px 18px -6px rgba(2,26,36,.55)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/branding/logo"
        alt="Logo usaha"
        loading="eager"
        className="h-full w-full object-contain p-[9%]"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
