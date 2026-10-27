"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * DROPDOWN FILTER STATUS (sidebar Riwayat Dokumen, layar lebar)
 * =========================================================================
 * Sebelumnya tujuh tombol filter status (Semua, Belum bayar, Sebagian,
 * Lewat tempo, Lunas, Draft, Batal) selalu terbuka dan memakan hampir
 * separuh tinggi sidebar. Sekarang di layar lebar daftar itu DITUTUP
 * secara bawaan: yang terlihat hanya satu tombol berisi filter yang
 * sedang dipakai + panah. Klik tombol -> daftar membuka di bawahnya.
 *
 * Kenapa membuka di tempat (accordion), bukan panel melayang?
 * Sidebar punya wadah gulir sendiri (overflow-y-auto), jadi panel
 * absolut akan terpotong di tepi sidebar. Membuka di tempat aman dari itu
 * dan tetap terasa seperti dropdown.
 *
 * Yang SENGAJA tidak berubah:
 *  - HP/tablet (di bawah lg). Daftar ini dipakai juga di menu geser
 *    "Status" pada bottom navigation, dan menu geser itu sendiri sudah
 *    tertutup sampai disentuh. Menambah satu lapis tutup-buka di dalamnya
 *    hanya menambah satu ketukan. Jadi di bawah lg tombol dropdown
 *    disembunyikan dan daftar selalu tampil seperti semula.
 *  - Tiap pilihan tetap <Link> biasa (diberikan lewat children), jadi
 *    halaman daftar invoice tetap server component.
 *
 * Pemanggil memberi `key={filter}`: begitu filter berganti (halaman
 * dimuat ulang), komponen dibuat baru dan kembali tertutup.
 */
export function StatusFilterDropdown({
  currentLabel,
  currentIcon,
  active,
  children,
}: {
  /** Nama filter yang sedang dipakai, tampil di tombol saat tertutup. */
  currentLabel: string;
  currentIcon: ReactNode;
  /** True kalau filter selain "Semua" sedang aktif (tombol diberi warna aksen). */
  active: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  /* Esc menutup daftar. Pasang pendengar hanya saat terbuka. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div>
      {/* HP/tablet: judul kecil seperti semula (di dalam menu geser). */}
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-slate-400 lg:hidden">
        Filter status
      </p>

      {/* Layar lebar: tombol dropdown. Dibungkus div yang disembunyikan di
          bawah lg (bukan memberi `hidden` langsung ke tombol) karena
          .ppi-side-btn sudah mengatur display-nya sendiri. */}
      <div className="hidden lg:block">
        <button
          type="button"
          className={`ppi-side-btn ${active ? "active" : ""}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="ppi-ico">{currentIcon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase leading-none tracking-[.12em] opacity-60">
              Filter status
            </span>
            <span className="mt-1 block truncate">{currentLabel}</span>
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>

      {/* Daftar pilihan. Di lg ke atas tersembunyi sampai dibuka; di bawah lg
          selalu tampil. */}
      <div id={panelId} className={`space-y-0.5 ${open ? "lg:mt-1" : "lg:hidden"}`}>
        {children}
      </div>
    </div>
  );
}
