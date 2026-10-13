"use client";

import { useId, useState } from "react";
import { BrandMark } from "@/components/BrandMark";

export type LoadingIndicatorType = "line-simple" | "line-spinner" | "dot-circle";
export type LoadingIndicatorSize = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * INDIKATOR LOADING BERCINCIN + LOGO USAHA DI TENGAH
 * ---------------------------------------------------------
 * Menampilkan cincin teal yang berputar dengan logo usaha di tengahnya.
 * Bedanya dengan spinner ikon di dalam tombol (Loader2): ini komponen
 * halaman penuh, jadi boleh sebesar yang kita mau dan selalu memakai
 * warna merek, bukan warna teks tombol.
 *
 * TIGA BENTUK
 *   line-simple : lintasan penuh + satu busur teal (default, paling terbaca)
 *   line-spinner: satu busur saja, lebih ringan
 *   dot-circle  : dua busur putus-putus, kesan lebih "hidup"
 *
 * WARNA
 * Arc dan tracknya bukan warna hard-coded, tapi token --pf-load-arc /
 * --pf-load-track (lihat design-tokens.css). Jadi tema terang dan gelap
 * sudah tertangani di satu tempat. Kalau warnanya perlu diganti, ubah
 * tokennya - jangan ubah file ini.
 *
 * AKSESIBILITAS
 * Berisi role="status" + aria-label, jadi pembaca layar mengabar "memuat".
 * Geraknya dimatikan total saat pengguna memilih "kurangi gerak"; busurnya
 * tetap terlihat sebagai lingkaran penuh, jadi informasi "sedang memuat"
 * tidak hilang - cuma tidak lagi berputar.
 */

/** diameter cincin, diameter logo (0 = tanpa logo), ukuran teks, jarak ke label */
const SIZES: Record<LoadingIndicatorSize, { ring: number; logo: number; label: string; gap: string }> = {
  // xs sengaja tanpa logo: di diameter 16px logo cuma sisa 7px dan
  // bentuknya jadi gumpalan. Ukuran ini untuk inline di dalam teks.
  xs: { ring: 16, logo: 0, label: "text-xs", gap: "gap-1.5" },
  sm: { ring: 32, logo: 15, label: "text-sm", gap: "gap-2" },
  md: { ring: 48, logo: 22, label: "text-sm", gap: "gap-2.5" },
  lg: { ring: 56, logo: 26, label: "text-base", gap: "gap-2.5" },
  xl: { ring: 64, logo: 30, label: "text-base", gap: "gap-3" },
};

/**
 * Logo usaha di tengah cincin. Mengambil dari database lewat /api/branding/logo;
 * kalau belum ada / gagal dimuat, jatuh ke robot PrintFlow supaya cincin
 * tidak pernah kosong.
 */
function CenterLogo({ size }: { size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <BrandMark size={size} />;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/api/branding/logo"
      alt=""
      width={size}
      height={size}
      className="object-contain"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
      ref={(el) => {
        // Gambar bisa gagal sebelum React sempat memasang onError.
        if (el && el.complete && el.naturalWidth === 0) setFailed(true);
      }}
    />
  );
}

export function LoadingIndicator({
  type = "line-simple",
  size = "md",
  label,
  inline = false,
  className = "",
}: {
  /** Bentuk cincin. */
  type?: LoadingIndicatorType;
  /** `xs` 16px untuk inline di dalam teks; `md` 48px untuk halaman. */
  size?: LoadingIndicatorSize;
  /** Teks di bawah cincin (atau di sampingnya kalau `inline`). */
  label?: string;
  /** Susun mendatar: cincin dan teks Sebelah-sebelah. */
  inline?: boolean;
  className?: string;
}) {
  // dot-circle memakai gradient yang butuh id. Kalau dua loader muncul
  // bersamaan, id yang sama akan dipakai dua-duanya dan salah satunya
  // bisa memakai gradien milik yang lain - useId() membuat unik per
  // instance.
  const uid = useId().replace(/:/g, "");
  const s = SIZES[size];

  const cincin = () => {
    if (type === "line-spinner") {
      return (
        <svg aria-hidden viewBox="0 0 32 32" fill="none" className="pf-load-spin h-full w-full">
          <circle
            cx="16" cy="16" r="14" fill="none"
            className="pf-load-arc" strokeWidth="4"
            strokeDashoffset="40" strokeDasharray="100" strokeLinecap="round"
          />
        </svg>
      );
    }

    if (type === "dot-circle") {
      return (
        <svg aria-hidden viewBox="0 0 36 36" fill="none" className="pf-load-spin h-full w-full">
          <path
            d="M34 18C34 15.8989 33.5861 13.8183 32.7821 11.8771C31.978 9.93586 30.7994 8.17203 29.3137 6.68629C27.828 5.20055 26.0641 4.022 24.1229 3.21793C22.1817 2.41385 20.1011 2 18 2C15.8988 2 13.8183 2.41385 11.8771 3.21793C9.93585 4.022 8.17203 5.20055 6.68629 6.68629C5.20055 8.17203 4.022 9.93586 3.21793 11.8771C2.41385 13.8183 2 15.8989 2 18"
            stroke={`url(#${uid}a)`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.1 8"
          />
          <path
            d="M3.21793 24.1229C4.022 26.0641 5.20055 27.828 6.68629 29.3137C8.17203 30.7994 9.93585 31.978 11.8771 32.7821C13.8183 33.5861 15.8988 34 18 34C20.1011 34 22.1817 33.5861 24.1229 32.7821C26.0641 31.978 27.828 30.7994 29.3137 29.3137C30.7994 27.828 31.978 26.0641 32.7821 24.1229"
            stroke={`url(#${uid}b)`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.1 8"
          />
          <defs>
            <linearGradient id={`${uid}a`} x1="34" y1="18" x2="2" y2="18" gradientUnits="userSpaceOnUse">
              <stop stopColor="currentColor" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id={`${uid}b`} x1="33" y1="23.5" x2="3" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopOpacity="0" stopColor="currentColor" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0.48" />
            </linearGradient>
          </defs>
        </svg>
      );
    }

    // line-simple (default): lintasan penuh + satu busur.
    return (
      <svg aria-hidden viewBox="0 0 32 32" fill="none" className="pf-load-spin h-full w-full">
        <circle cx="16" cy="16" r="14" className="pf-load-track" strokeWidth="4" />
        <circle
          cx="16" cy="16" r="14" fill="none"
          className="pf-load-arc" strokeWidth="4"
          strokeDashoffset="75" strokeDasharray="100" strokeLinecap="round"
        />
      </svg>
    );
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label ?? "Memuat"}
      className={`flex items-center justify-center ${inline ? "flex-row" : "flex-col"} ${s.gap} ${className}`}
    >
      <span className="relative grid shrink-0 place-items-center" style={{ height: s.ring, width: s.ring }}>
        <span className="absolute inset-0">{cincin()}</span>
        {s.logo ? (
          <span className="relative" style={{ height: s.logo, width: s.logo }}>
            <CenterLogo size={s.logo} />
          </span>
        ) : null}
      </span>
      {label ? <span className={`text-[color:var(--pf-ink-2)] ${s.label}`}>{label}</span> : null}
    </div>
  );
}

export default LoadingIndicator;