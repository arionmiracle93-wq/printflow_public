"use client";

import { useRef, useState } from "react";
import { Clock } from "lucide-react";

/**
 * Input jam yang SELALU tampil format 24 jam hh:mm.
 *
 * Kenapa tidak pakai <input type="time"> polos: tampilannya digambar
 * browser/OS (di HP ada panah/ikon yang mepet ke tepi, di sebagian locale
 * muncul AM/PM), dan tidak bisa diatur dari CSS. Komponen ini sepasang
 * dengan DateFieldID, jadi field tanggal dan jam tampil seragam.
 *
 * - Boleh diketik manual (angka otomatis diberi ":" setelah 2 digit).
 * - Ada tombol ikon jam yang memicu pemilih jam bawaan perangkat; hasil
 *   pilihannya otomatis ditulis ulang jadi hh:mm.
 * - Value yang dikirim ke parent (onChange) tetap "HH:mm" atau "" -
 *   kompatibel dengan state & body API yang sudah ada.
 * - Kalau ketikan belum lengkap/tidak valid lalu field ditinggalkan, teks
 *   dikembalikan ke jam valid terakhir (bukan dibiarkan setengah jadi).
 */
export function TimeFieldID({
  value,
  onChange,
  className = "",
  id,
  disabled = false,
}: {
  value: string; // "HH:mm" atau ""
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value);
  // Deteksi perubahan value dari LUAR (mis. auto-isi oleh form induk) tanpa
  // useEffect - pola "sesuaikan state saat render" yang disarankan React.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(value);
  }
  const nativeRef = useRef<HTMLInputElement>(null);

  function handleTextChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    const formatted = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
    setText(formatted);

    if (digits.length === 0) {
      setSyncedValue("");
      onChange("");
      return;
    }
    if (digits.length === 4) {
      const hh = Number(digits.slice(0, 2));
      const mm = Number(digits.slice(2, 4));
      if (hh <= 23 && mm <= 59) {
        const iso = `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
        setSyncedValue(iso);
        onChange(iso);
      }
    }
  }

  function handleBlur() {
    // Belum lengkap / tidak valid: kembalikan ke jam valid terakhir.
    if (text !== value) setText(value);
  }

  function openPicker() {
    const el = nativeRef.current;
    if (!el || disabled) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // Sebagian browser menolak showPicker() di kondisi tertentu - lanjut fallback.
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
        placeholder="hh:mm"
        value={text}
        disabled={disabled}
        onChange={(e) => handleTextChange(e.target.value)}
        onBlur={handleBlur}
        maxLength={5}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        tabIndex={-1}
        title="Pilih jam"
        aria-label="Pilih jam"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-teal-600 disabled:cursor-not-allowed"
      >
        <Clock size={16} />
      </button>
      {/* Native time input disembunyikan visual - cuma dipakai untuk memicu
          pemilih jam bawaan perangkat. Ukuran 1px (bukan 0) supaya
          showPicker() tetap diizinkan oleh browser. */}
      <input
        ref={nativeRef}
        type="time"
        value={value}
        onChange={(e) => {
          setSyncedValue(e.target.value);
          onChange(e.target.value);
          setText(e.target.value);
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
      />
    </div>
  );
}
