/**
 * KERANGKA LOADING PER HALAMAN
 * ---------------------------------------------------------------
 * Ditampilkan Next.js (lewat berkas loading.tsx) selama data halaman
 * sedang diambil dari database. Bentuknya dibuat semirip mungkin dengan
 * tampilan akhir (judul, filter, kartu, tabel, tata letak 3 kolom di
 * halaman detail), supaya saat data datang tidak ada yang "melompat".
 *
 * Memakai kelas .pf-skel dari design-tokens.css: warna mengikuti tema,
 * efek kilau otomatis mati saat pengguna memilih "kurangi gerak".
 * Tidak ada spinner bulat.
 */
import type { ReactNode } from "react";

function S({ className = "" }: { className?: string }) {
  return <div className={`pf-skel ${className}`} aria-hidden />;
}

/** Pembungkus dengan label untuk pembaca layar. */
function Loading({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Judul halaman + keterangan + (opsional) tombol di kanan. */
function Header({ action = true }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-2">
        <S className="h-6 w-44 md:h-7 md:w-56" />
        <S className="h-3.5 w-64 max-w-[70vw]" />
      </div>
      {action ? <S className="h-10 w-36" /> : null}
    </div>
  );
}

/** Kartu berisi beberapa baris teks. */
function CardLines({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`card p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <S className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <S className="h-3.5 w-1/2" />
          <S className="h-3 w-1/3" />
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <S key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

/* ================================================================= */

/** Halaman umum (dipakai halaman yang tidak punya kerangka khusus). */
export function GenericPageSkeleton() {
  return (
    <Loading label="Memuat halaman">
      <Header action={false} />
      <div className="grid gap-4 lg:grid-cols-2">
        <CardLines lines={4} />
        <CardLines lines={4} />
      </div>
      <CardLines lines={3} />
    </Loading>
  );
}

/** Daftar pekerjaan: judul, kartu filter, lalu kartu (HP) atau tabel (desktop). */
export function OrdersSkeleton() {
  return (
    <Loading label="Memuat daftar pekerjaan">
      <Header />
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <S className="h-10 min-w-[12rem] flex-1" />
        <S className="h-10 w-full sm:w-36" />
        <S className="h-10 w-full sm:w-36" />
        <S className="h-10 w-full sm:w-36" />
        <S className="h-10 w-24" />
      </div>

      {/* HP */}
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <S className="h-3 w-24" />
                <S className="h-4 w-4/5" />
                <S className="h-3 w-1/2" />
                <S className="h-3 w-2/3" />
              </div>
              <S className="h-7 w-20 shrink-0 rounded-full" />
            </div>
            <S className="mt-4 h-2 w-full rounded-full" />
            <div className="mt-3 flex justify-between">
              <S className="h-3 w-32" />
              <S className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop */}
      <div className="card hidden overflow-hidden md:block">
        <div className="flex gap-4 border-b border-[color:var(--pf-line)] bg-[color:var(--pf-surface-2)] px-4 py-3">
          <S className="h-3 w-1/3" />
          <S className="h-3 w-24" />
          <S className="h-3 w-24" />
          <S className="h-3 w-20" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-[color:var(--pf-line-soft)] px-4 py-3.5 last:border-b-0">
            <div className="min-w-0 flex-1 space-y-2">
              <S className="h-3.5 w-2/5" />
              <S className="h-3 w-1/4" />
            </div>
            <S className="h-7 w-20 rounded-full" />
            <S className="h-2 w-28 rounded-full" />
            <S className="h-3 w-24" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** Halaman berisi kumpulan kartu (Pelanggan, Serah Terima). */
export function CardGridSkeleton({ label, stats = false }: { label: string; stats?: boolean }) {
  return (
    <Loading label={label}>
      <Header />
      {stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4">
              <S className="h-3 w-20" />
              <S className="mt-3 h-6 w-16" />
            </div>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardLines key={i} lines={2} />
        ))}
      </div>
    </Loading>
  );
}

/** Pengaturan: dua kolom kartu. */
export function SettingsSkeleton() {
  return (
    <Loading label="Memuat pengaturan">
      <Header action={false} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <CardLines lines={2} />
          <CardLines lines={3} />
          <CardLines lines={2} />
        </div>
        <div className="space-y-4">
          <CardLines lines={6} />
          <CardLines lines={3} />
        </div>
      </div>
    </Loading>
  );
}
