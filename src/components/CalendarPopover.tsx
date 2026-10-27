"use client";

import { Calendar, type ModeKalender } from "@/components/Calendar";
import { PopoverPanel } from "@/components/PopoverPanel";

/**
 * POPUP KALENDER
 * ===================================================================
 * Pembungkus tipis: seluruh posisi, portal, tombol tutup, dan
 * penanganan klik-di-luar ada di PopoverPanel. File ini hanya
 * menempelkan isi kalender ke dalam cangkang itu.
 *
 * Cangkangnya dipakai juga oleh pemilih jam (TimeFieldID), jadi
 * keduanya tidak bisa berbeda perilaku - popup kalender yang menutupi
 * header atau terpotong di dalam kotak meta akan menutupi atau terpotong
 * juga di pemilih jam.
 *
 * Kenapa kalender sendiri dan bukan popup bawaan browser:
 * - Popup OS tidak bisa diberi gaya. Di mode gelap ia tetap memakai
 *   warna sistem operasi, sehingga muncul sebagai kotak terang di
 *   tengah aplikasi yang gelapnya sendiri.
 * - Format tampilannya mengikuti locale perangkat, bukan kode kita.
 * - Di HP popup-nya menutup halaman dan menutupi hampir seluruh layar
 *   hanya untuk memilih satu tanggal.
 */
export function CalendarPopover({
  children,
  label,
  mode,
  nilai,
  min,
  maks,
  bulanAwal,
  tambahan,
  onPilih,
  onTutup,
}: {
  /** Isian dan tombol pemicunya. */
  children: React.ReactNode;
  /** Dipakai sebagai nama untuk pembaca layar, BUKAN sebagai teks
      yang ditampilkan di dalam panel. */
  label: string;
  mode?: ModeKalender;
  nilai?: string | { dari?: string; sampai?: string };
  min?: string;
  maks?: string;
  bulanAwal?: string;
  /** Baris tambahan di ATAS kisi kalender, mis. sakelar "Hari/Bulan".
      Sifatnya opsional dan tidak dipakai di sini - pemanggil yang
      butuh, seperti penyaring tanggal di panel cari, menyisipkannya
      lewat prop ini. */
  tambahan?: React.ReactNode;
  onPilih: (v: string | { dari?: string; sampai?: string } | undefined) => void;
  onTutup: () => void;
}) {
  return (
    <PopoverPanel
      label={label}
      onTutup={onTutup}
      isi={
        <>
          {tambahan}
          <Calendar
            mode={mode}
            nilai={nilai}
            min={min}
            maks={maks}
            bulanAwal={bulanAwal}
            onPilih={onPilih}
            onTutup={onTutup}
          />
        </>
      }
    >
      {children}
    </PopoverPanel>
  );
}
