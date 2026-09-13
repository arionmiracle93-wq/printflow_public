"use client";

import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";

/** Menampilkan logo usaha dari database; robot menjadi fallback jika belum ada. */
export function AppLogo() {
  const [failed, setFailed] = useState(false);

  if (failed) return <BrandMark />;

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_8px_24px_rgba(13,148,136,.25)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/branding/logo"
        alt="Logo usaha"
        className="h-full w-full object-contain p-1"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
