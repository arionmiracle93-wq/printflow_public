"use client";

import { useRef, useState } from "react";
import { Clock } from "lucide-react";
import { PopoverPanel } from "@/components/PopoverPanel";
import { TimePicker } from "@/components/TimePicker";

/**
 * Input jam yang SELALU tampil format 24 jam hh:mm.
 *
 * Kenapa tidak pakai <input type="time"> polos: tampilannya digambar
 * browser/OS (di HP ada panah/ikon yang mepet ke tepi, di sebagian locale
 * muncul AM/PM), dan tidak bisa diatur dari CSS. Komponen ini sepasang
 * dengan DateFieldID, jadi field tanggal dan jam tampil seragam.
 *
 * Popup-nya sekarang milik aplikasi juga, lewat TimePicker + PopoverPanel
 * yang sama dengan kalender.
 *
 * SEBELUMNYA popup jam masih milik browser. Waktu itu tombol ikon
 * memanggil `showPicker()` pada <input type="time"> yang disembunyikan,
 * sehingga yang muncul adalah panel abu-abu milik sistem operasi:
 * warnanya tidak ikut tema, font dan jaraknya tidak bisa diatur, dan di
 * aplikasi gelap ia menimpa isian-isian lain dengan gaya yang sama sekali
 * berbeda. Satu-satunya popup di aplikasi ini yang tidak seragam - dan
 * sekarang tidak ada lagi.
 *
 * - Boleh diketik manual (angka otomatis diberi ":" setelah 2 digit).
 * - Ikon jam membuka panel milik aplikasi; hasil pilihannya ditulis
 *   ulang jadi hh:mm.
 * - Menit yang tidak ada di daftar (mis. 07) tetap bisa diketik manual -
 *   panel hanya menawarkan kelipatan 5, bukan membatasi input.
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
  const [buka, setBuka] = useState(false);
  const tombolRef = useRef<HTMLButtonElement>(null);

  /* TIDAK ada efek "klik di luar" di sini.

     Waktu itu efeknya ada di komponen ini dengan bungkusRef yang
     ditempelkan pada div isian. Panel popup - yang sudah dipindahkan ke
     document.body - adalah SAUDARA div itu, bukan anaknya, sehingga
     setiap ketukan di dalam panel terbaca sebagai klik di luar: popup
     menutup pada mousedown dan click-nya tidak pernah sampai ke tombol.

     Sekarang keduanya ditangani di dalam PopoverPanel, yang menguji
     "di dalam" ke isian DAN panel sekaligus. */

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

  const pemicu = (
    <>
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
        ref={tombolRef}
        type="button"
        onClick={() => setBuka((v) => !v)}
        disabled={disabled}
        aria-expanded={buka}
        aria-haspopup="dialog"
        aria-label="Pilih jam"
        title="Pilih jam dari panel"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 transition-colors hover:text-[color:var(--pf-accent-strong)] disabled:cursor-not-allowed"
      >
        <Clock size={16} />
      </button>
    </>
  );

  return buka ? (
    <PopoverPanel
      label="Pilih jam"
      onTutup={() => setBuka(false)}
      isi={
        <TimePicker
          nilai={value}
          onPilih={(v) => {
            setSyncedValue(v);
            setText(v);
            onChange(v);
            setBuka(false);
            tombolRef.current?.focus();
          }}
        />
      }
    >
      {pemicu}
    </PopoverPanel>
  ) : (
    <div className="relative">{pemicu}</div>
  );
}
