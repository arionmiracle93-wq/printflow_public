"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

/**
 * Input tanggal yang SELALU tampil format dd/mm/yyyy.
 *
 * Kenapa tidak pakai <input type="date"> polos: format tampilannya
 * mengikuti locale/OS perangkat masing-masing pengguna (bisa jadi
 * mm/dd/yyyy di sebagian HP/browser), bukan diatur dari kode. Komponen
 * ini memaksa tampilan dd/mm/yyyy untuk semua orang, di device apa pun.
 *
 * - Boleh diketik manual (angka otomatis diberi "/").
 * - Ada tombol kalender kecil yang memicu date-picker bawaan perangkat;
 *   hasil pilihannya otomatis ditulis ulang jadi dd/mm/yyyy.
 * - Value yang dikirim ke parent (onChange) tetap ISO "yyyy-mm-dd" —
 *   supaya kompatibel dengan state & body API yang sudah ada.
 */
export function DateFieldID({
  value,
  onChange,
  className = "",
  id,
  required = false,
}: {
  value: string; // "yyyy-mm-dd" atau ""
  onChange: (isoValue: string) => void;
  className?: string;
  id?: string;
  required?: boolean;
}) {
  const [text, setText] = useState(() => isoToDisplay(value));
  // Dipakai untuk mendeteksi perubahan value dari LUAR (mis. auto-isi target
  // tanggal oleh form induk) tanpa useEffect — setState saat render seperti
  // ini aman & memang pola yang disarankan React untuk "menyesuaikan state
  // ketika prop berubah" (lihat react.dev/learn/you-might-not-need-an-effect).
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(isoToDisplay(value));
  }
  const nativeRef = useRef<HTMLInputElement>(null);

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

  function openPicker() {
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // Sebagian browser menolak showPicker() di kondisi tertentu — lanjut fallback di bawah.
      }
    }
    el.focus();
    el.click();
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        required={required}
        maxLength={10}
        className={`${className} pr-9`}
      />
      <button
        type="button"
        onClick={openPicker}
        tabIndex={-1}
        title="Pilih dari kalender"
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400 hover:text-teal-600"
      >
        <CalendarDays size={16} />
      </button>
      {/* Native date input disembunyikan visual — cuma dipakai untuk memicu
          kalender bawaan perangkat. Ukuran 1px (bukan 0) supaya showPicker()
          tetap diizinkan oleh browser. */}
      <input
        ref={nativeRef}
        type="date"
        value={value}
        onChange={(e) => {
          setSyncedValue(e.target.value);
          onChange(e.target.value);
          setText(isoToDisplay(e.target.value));
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
      />
    </div>
  );
}

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}
