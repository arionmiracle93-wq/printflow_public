"use client";

import { useState, type ReactNode } from "react";

/**
 * BARIS KETUK UNTUK EDITOR INVOICE DI LAYAR HP
 * -------------------------------------------------------------
 * Di HP setiap bagian editor (tanggal, diskon, PPN, metode bayar,
 * syarat, ...) tampil sebagai SATU baris: ikon bulat + label + nilai
 * sekarang + chevron. Barisnya diketuk untuk membuka isinya.
 *
 * Prinsipnya: isinya TIDAK ditulis ulang. children-nya adalah input yang
 * sudah ada sebelumnya, apa adanya, lengkap dengan semua state dan
 * aturan validasinya. Yang berubah cuma cara membungkusnya.
 *
 * SCREEN LEBIH LEBAR TIDAK BERUBAH
 * Kepala baris disembunyikan di lg ke atas, dan isinya tetap terbuka.
 * Jadi tampilan desktop persis sama seperti sebelumnya - tidak ada
 * satupun kondisi yang bergantung lebar layar di dalam markup.
 *
 * Status buka/tutup disimpan di state lokal per baris, terpisah dari
 * state dokumen. Menutup sebuah baris tidak boleh mengubah isi invoice.
 *
 * PENGECUALIAN: baris yang diberi prop `open` (mis. "Monitoring
 * Produksi") statusnya datang dari luar, jadi baris itu bukan dropdown.
 * Chevron-nya hilang, kepala barisnya tidak bisa diketuk, dan yang
 * membuka isinya adalah sakelar di baris itu sendiri.
 */
export function EditRow({
  icon,
  label,
  value,
  children,
  defaultOpen = false,
  /** Gadget kecil di kanan (sakelar, tombol, jumlah). */
  aside,
  /** Baris tidak bisa dibuka (mis. sudah terkunci ke pekerjaan produksi). */
  locked = false,
  /**
   * Status buka/tutup DATANG DARI LUAR (dikendalikan pemanggil).
   *
   * Kalau diisi, baris ini bukan dropdown lagi: chevron disembunyikan dan
   * kepala baris tidak bisa diketuk - yang meng buka isinya adalah gadget
   * di kolom `aside` (mis. sakelar "Perlu monitoring produksi"). Tekan
   * sakelarnya, panel isinya langsung terbuka; matikan, panelnya langsung
   * tertutup. Tidak perlu ketuk chevron.
   *
   * Di layar lebar (lg ke atas) kepala baris tetap disembunyikan dan
   * isinya tetap terbuka, jadi bentuk desktop tidak berubah.
   */
  open,
}: {
  icon: ReactNode;
  label: string;
  /** Ringkasan nilai saat ini - supaya baris tertutup tetap informatif. */
  value?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  aside?: ReactNode;
  locked?: boolean;
  open?: boolean;
}) {
  const [openLokal, setOpenLokal] = useState(defaultOpen);
  /* Baris yang statusnya dikendalikan luar bukan dropdown, jadi kepala
     barisnya dibuat statis (bukan tombol) dan chevron-nya tidak dirender. */
  const dikendalikan = open !== undefined;
  const buka = dikendalikan ? open : openLokal;

  return (
    <section className="ppi-editrow">
      {locked || dikendalikan ? (
        <div className="ppi-editrow-head ppi-editrow-static">
          <span className="ppi-editrow-ico">{icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-[color:var(--pf-ink)]">{label}</span>
            {value ? <span className="block truncate text-xs text-slate-500">{value}</span> : null}
          </span>
          {aside}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpenLokal((v) => !v)}
          aria-expanded={buka}
          className="ppi-editrow-head"
        >
          <span className="ppi-editrow-ico">{icon}</span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-bold text-[color:var(--pf-ink)]">{label}</span>
            {value ? <span className="block truncate text-xs text-slate-500">{value}</span> : null}
          </span>
          {aside}
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className={`ppi-editrow-chev ${buka ? "open" : ""}`}
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      )}

      {/* hidden saat tertutup di HP; di layar lebar (dan saat cetak)
          selalu tampil, jadi desktop tidak berubah sama sekali. */}
      <div className={buka ? "block" : "hidden lg:block"}>{children}</div>
    </section>
  );
}
