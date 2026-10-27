"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { CalendarPopover } from "@/components/CalendarPopover";

/**
 * INPUT TANGGAL YANG SELALU TAMPIL dd/mm/yyyy, DENGAN KALENDER SENDIRI
 *
 * Dua alasan kenapa input ini ada, keduanya masih berlaku:
 * - Format tampilannya mengikuti locale perangkat kalau pakai
 *   input type=date polos (bisa jadi mm/dd/yyyy di sebagian HP).
 *   Komponen ini memaksa dd/mm/yyyy untuk semua orang.
 * - Popup kalender bawaan perangkat tidak bisa diberi gaya. Di mode
 *   gelap ia tetap memakai warna sistem operasi, sehingga muncul
 *   sebagai kotak terang di tengah aplikasi yang gelapnya sendiri,
 *   dan di HP menutup hampir seluruh layar untuk satu tanggal.
 *   Sekarang yang muncul adalah kalender milik aplikasi
 *   (src/components/Calendar).
 *
 * Yang tetap sama seperti sebelumnya:
 * - Boleh diketik manual, angka otomatis diberi "/".
 * - Nilai ke parent (onChange) tetap ISO "yyyy-mm-dd", jadi state dan
 *   body API tidak berubah sedikit pun.
 */
export function DateFieldID({
  value,
  onChange,
  className = "",
  id,
  required = false,
  name,
  min,
  maks,
}: {
  value: string; // "yyyy-mm-dd" atau ""
  onChange: (isoValue: string) => void;
  className?: string;
  id?: string;
  required?: boolean;
  /** Kalau diisi, dirender sebagai input tersembunyi untuk form GET. */
  name?: string;
  min?: string;
  maks?: string;
}) {
  const [text, setText] = useState(() => isoToDisplay(value));
  // Dipakai untuk mendeteksi perubahan value dari LUAR (mis. auto-isi
  // tanggal oleh form induk) tanpa useEffect - setState saat render
  // seperti ini memang pola yang disarankan React untuk "menyesuaikan
  // state ketika prop berubah".
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(isoToDisplay(value));
  }
  const [buka, setBuka] = useState(false);
  const tombolRef = useRef<HTMLButtonElement>(null);

  /* Tidak ada lagi efek "klik di luar" / Escape di sini.

     Semula efeknya ada di komponen ini, dengan bungkusRef yang
     ditempelkan pada div isian. Panel kalender adalah SAUDARA div itu,
     sehingga setiap ketukan di tanggal terbaca sebagai klik di luar:
     popup menutup pada mousedown dan click-nya tidak pernah sampai ke
     tombol. Kalender terlihat benar tapi tidak bisa dipakai.

     Sekarang keduanya ditangani di dalam CalendarPopover, yang
     membungkus isian dan panel sekaligus. */

  function handleTextChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(formatted);

    if (digits.length === 8) {
      const day = Number(digits.slice(0, 2));
      const month = Number(digits.slice(2, 4));
      const year = Number(digits.slice(4, 8));
      const iso = `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
      const parsed = new Date(`${iso}T00:00:00`);
      const valid =
        !Number.isNaN(parsed.getTime()) && parsed.getDate() === day && parsed.getMonth() + 1 === month && year > 1900;
      if (valid) {
        setSyncedValue(iso);
        onChange(iso);
      }
    }
  }

  return (
    <>
      {buka ? (
        <CalendarPopover
          label="Pilih tanggal"
          nilai={value || undefined}
          min={min}
          maks={maks}
          bulanAwal={value || undefined}
          onPilih={(v) => {
            const iso = typeof v === "string" ? v : "";
            if (!iso) return;
            setSyncedValue(iso);
            setText(isoToDisplay(iso));
            onChange(iso);
            setBuka(false);
            tombolRef.current?.focus();
          }}
          onTutup={() => setBuka(false)}
        >
          <Isian
            id={id}
            required={required}
            text={text}
            onText={handleTextChange}
            className={className}
            tombolRef={tombolRef}
            buka={buka}
            setBuka={setBuka}
          />
        </CalendarPopover>
      ) : (
        /* Popup ditutup: CalendarPopover tidak dirender, jadi tidak ada
           lagi yang perlu diukur. Karena pemeriksaan "klik di luar" dan
           Escape sama-sama hanya jalan saat buka, ref kosong pada
           keadaan ini tidak pernah dipakai - dan tidak perlu
           diteruskan ke isian. */
        <Isian
          id={id}
          required={required}
          text={text}
          onText={handleTextChange}
          className={className}
          tombolRef={tombolRef}
          buka={buka}
          setBuka={setBuka}
        />
      )}
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </>
  );
}

/** Isian + tombol kalender. Dipisah supaya bentuknya sama persis
    dengan maupun tanpa popup terbuka - popup menjahit posisinya ke
    elemen ini, jadi kalau isiannya berpindah tempat saat popup
    muncul, popup ikut bergeser dan salah hitung.

    div pembungkus di sini TIDAK memakai ref, dan memang tidak perlu:
    pemeriksaan "klik di luar" dilakukan CalendarPopover pada div yang
    membungkus isian dan panel sekaligus, jadi panel ikut terhitung
    sebagai bagian dari dalam. Lihat efek "Tutup sendiri" di sana. */
function Isian({
  id,
  required,
  text,
  onText,
  className,
  tombolRef,
  buka,
  setBuka,
}: {
  id?: string;
  required: boolean;
  text: string;
  onText: (v: string) => void;
  className: string;
  tombolRef: React.RefObject<HTMLButtonElement | null>;
  buka: boolean;
  setBuka: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        value={text}
        onChange={(e) => onText(e.target.value)}
        required={required}
        maxLength={10}
        className={`${className} pr-9`}
      />
      <button
        ref={tombolRef}
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-expanded={buka}
        aria-haspopup="dialog"
        title="Pilih dari kalender"
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400 hover:text-teal-600"
      >
        <CalendarDays size={16} />
      </button>
    </div>
  );
}

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}
