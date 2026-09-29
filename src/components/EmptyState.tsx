import type { ReactNode } from "react";
import Link from "next/link";

/**
 * TAMPILAN KOSONG, SATU GAYA UNTUK SEMUA HALAMAN
 * ---------------------------------------------------------------
 * Dulu tiap halaman membuat tampilan kosongnya sendiri dengan ukuran
 * ikon, warna, dan kalimat yang berbeda-beda. Sekarang semuanya memakai
 * komponen ini: ikon di kotak teal, judul, satu kalimat penjelasan,
 * lalu langkah berikutnya yang jelas (bukan hanya "kosong").
 *
 * Aksi memakai tombol sekunder / netral supaya tidak menyaingi tombol
 * utama (amber) yang biasanya sudah ada di judul halaman.
 */
type EmptyAction = { href: string; label: string; icon?: ReactNode; variant?: "secondary" | "ghost" };

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondary,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: EmptyAction;
  secondary?: EmptyAction;
  compact?: boolean;
}) {
  const button = (a: EmptyAction, fallback: "secondary" | "ghost") => (
    <Link href={a.href} className={(a.variant ?? fallback) === "secondary" ? "btn-secondary" : "btn-ghost"}>
      {a.icon}
      {a.label}
    </Link>
  );

  return (
    <div className={`card flex flex-col items-center text-center ${compact ? "px-5 py-8" : "px-6 py-12"}`}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--pf-accent-soft)] text-[color:var(--pf-accent-strong)]">
        {icon}
      </span>
      <h2 className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--pf-ink)]">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-[color:var(--pf-ink-3)]">{description}</p>
      ) : null}
      {action || secondary ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {action ? button(action, "secondary") : null}
          {secondary ? button(secondary, "ghost") : null}
        </div>
      ) : null}
    </div>
  );
}
