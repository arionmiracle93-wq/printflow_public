"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, type ReactNode } from "react";

/**
 * DERETAN TAB
 * ===================================================================
 * Bentuknya mengikuti gambar acuan: satu kotak pembatas di luar, tab
 * di dalamnya TIDAK diberi kotak sendiri - hanya pemisah tipis antar
 * tab, dan tab yang aktif ditandai garis tebal di bawahnya.
 *
 * Teks saja, tanpa ikon. Ini pilihan sadar, bukan sekadar-more:
 * di 360px setiap tab hanya dapat ~84px. Setelah dikurangi padding dan
 * tanpa ikon, "Tampilan" (label terpanjang di tab Pengaturan) masih
 * muat. Dengan ikon 15px, teksnya terpotong jadi "Tamp..." - persis
 * yang terjadi pada versi sebelumnya.
 *
 * Kenapa ditulis sendiri, bukan memakai pustaka tab (shadcn/Radix):
 * proyek ini tidak memakai Radix sama sekali - 81 komponen datar di
 * src/components, tanpa folder ui/ dan tanpa helper cn(). Menarik satu
 * komponen tab berarti menambah lima paket npm (@radix-ui/react-tabs,
 * react-scroll-area, react-separator, react-slot, react-label) plus
 * class-variance-authority hanya untuk urutan <div> dan satu blok CSS.
 * Yang ditulis di file ini nol dependensi baru.
 *
 * Sifat yang perlu diketahui pemanggil:
 * - fill=true  : tab membagi lebar sama rata. Untuk 3-4 tab sehingga
 *               muat tanpa digulir, dan tiap tabya sama besar.
 * - fill=false : tab selebar isinya lalu digulir mendatar di DALAM
 *               bar-nya. Untuk 7+ pilihan yang memang tidak mungkin
 *               muat di 360px.
 *
 * Catatan fill=false: wadahnya tidak memakai w-max. w-max membuat
 * elemennya melebar melebihi induknya, lalu yang bergeser ke kanan adalah
 * halaman seluruhnya - bukan bar-nya. Yang benar: wadah selebar induk
 * (flex blok sudah begitu) plus tab-tabnya shrink-0.
 *
 * Bilah gulir sengaja TAMPIL dan tipis. Untuk deretan tab, guntingan
 * tepi menyesatkan: yang terpotong terlihat pudar, bukan "bisa
 * digulir".
 */
export type TabItem<T extends string> = {
  value: T;
  label: string;
  /**
   * Alamat tujuan. Kalau diisi, tab dirender sebagai <Link> dan
   * `onChange` tidak dipakai - berguna di server component yang tidak
   * boleh memanggil hook navigasi. Kalau kosong, tab jadi <button>
   * yang memanggil onChange.
   */
  href?: string;
  /** Keterangan kecil di kanan label (mis. jumlah produk). */
  meta?: ReactNode;
};

export function TabBar<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  fill = true,
  className = "",
}: {
  items: TabItem<T>[];
  value: T;
  onChange?: (v: T) => void;
  ariaLabel: string;
  fill?: boolean;
  className?: string;
}) {
  const router = useRouter();

  /* ------------------------------------------------------------------
     PRA-MUAT SAAT JARI DITEKAN
     ------------------------------------------------------------------
     Tab di halaman ini adalah <Link>, jadi mengetuk tab berarti meminta
     halaman baru ke server. Halaman invoice dan laporan masing-masing
     menjalankan 5-6 query database, jadi ada jeda nyata - dan selama
     jeda itu /invoice menampilkan loader layar penuh, sehingga seluruh
     daftar hilang lalu muncul lagi. Rasanya seperti macet, bukan
     seperti berpindah tab.

     Solusinya bukan mengurangi query, tapi memindahkannya ke belakang
     layar: begitu jarinya menyentuh tab (pointerdown), halaman tujuan
     langsung diunduh di belakang. Jeda antara jari menyentuh dan
     navigasi berjalan sekitar 80-150ms - cukup untuk sebagian besar
     query selesai, sehingga ketukan berikutnya dilayani dari cache
     dan terasa instan, persis seperti tab client-side di Pengaturan.

     Dipakai bersama onPointerDown, bukan onMouseEnter: di HP tidak
     ada hover, jadi pramuat otomatis Next.js hampir tidak pernah
     berjalan. Pointerdown juga menutupi tetikus dan pena.
     ------------------------------------------------------------------ */
  const prepare = useCallback(
    (href: string) => {
      router.prefetch(href);
    },
    [router],
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`pf-tabbar flex min-w-0 items-stretch overflow-x-auto ${className}`}
    >
      {items.map((it, i) => {
        const aktif = it.value === value;
        const cls = `pf-tab relative flex min-h-11 min-w-0 items-center justify-center gap-1 whitespace-nowrap px-1.5 text-[13px] font-semibold transition-colors ${
          fill ? "flex-1" : "shrink-0"
        } ${aktif ? "bg-[color:var(--pf-surface-2)] text-[color:var(--pf-ink)]" : "text-[color:var(--pf-ink-2)] hover:bg-[color:var(--pf-surface-2)]"}`;
        const isi = (
          <>
            <span className="truncate">{it.label}</span>
            {it.meta ? <span className={`shrink-0 text-[11px] ${aktif ? "text-[color:var(--pf-ink-2)]" : "text-[color:var(--pf-ink-3)]"}`}>{it.meta}</span> : null}
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-0.5 ${aktif ? "bg-[color:var(--pf-accent)]" : "bg-transparent"}`}
            />
          </>
        );
        if (it.href) {
          return (
            <Link
              key={it.value}
              href={it.href}
              role="tab"
              aria-selected={aktif}
              className={cls}
              data-last={i === items.length - 1 ? "" : undefined}
              prefetch={false}
              onPointerDown={() => prepare(it.href as string)}
            >
              {isi}
            </Link>
          );
        }
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={aktif}
            onClick={() => onChange?.(it.value)}
            className={cls}
            data-last={i === items.length - 1 ? "" : undefined}
          >
            {isi}
          </button>
        );
      })}
    </div>
  );
}