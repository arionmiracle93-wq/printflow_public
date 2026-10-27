"use client";

import { useMemo, useState } from "react";

/**
 * PANEL PEMILIH JAM
 * ===================================================================
 * Dua kolom: Jam di kiri, Menit di kanan.
 *
 * Kenapa bukan satu daftar panjang (00..23 lalu 00..59 digabung):
 * yang paling sering diubah cuma menitnya. Dua kolom membuat urutan
 * ketukannya sama seperti mengetik "17:30" - pilih jamnya, lalu pilih
 * menitnya - jadi tidak perlu menggulir melewati 24 baris untuk
 * mendapatkan menit 30.
 *
 * MENIT LANGKAH 5
 * 00, 05, 10, ... 55. Semua jam kerja normal jatuh di sini, dan
 * kolomnya jadi 4 baris pendek yang muat tanpa digulir. Menit yang
 * tidak ada di daftar (mis. 07) tetap bisa diketik manual di isian -
 * ketikan manual tidak berubah dan tetap jadi sumber nilai yang resmi.
 */

const MENIT_LANGKAH = 5;

function duaAngka(n: number): string {
  return String(n).padStart(2, "0");
}

export function TimePicker({
  nilai,
  onPilih,
}: {
  /** "HH:mm" atau "" kalau belum ada. */
  nilai: string;
  onPilih: (v: string) => void;
}) {
  const bagian = /^(\d{2}):(\d{2})$/.exec(nilai);
  const jamTersimpan = bagian ? Number(bagian[1]) : 0;
  const menitTersimpan = bagian ? Number(bagian[2]) : 0;

  // Jam yang sedang dikerjakan disimpan terpisah dari nilai yang
  // tersimpan. Kalau memilih jam harus langsung menutup popup, orang
  // tidak pernah sampai memilih menitnya - jadi jam dulu dikunci di
  // sini, dan baru disimpan bersama menit ketika menitnya dipilih.
  //
  // Karena TimePicker hanya dirender selagi popup terbuka, komponen ini
  // selalu me-remount setiap kali dibuka, jadi useState di bawah selalu
  // mulai dari nilai terbaru tanpa perlu efek penyinkronan.
  const [jam, setJam] = useState(jamTersimpan);
  const menit = menitTersimpan;

  const jamList = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const menitList = useMemo(
    () => Array.from({ length: 60 / MENIT_LANGKAH }, (_, i) => i * MENIT_LANGKAH),
    [],
  );

  return (
    <div className="pf-cal w-full select-none text-[color:var(--pf-ink)]">
      {/* Nilai yang akan dipakai, ditampilkan di kepala supaya orang
          tahu sedang mengubah jam berapa - hasilnya belum tersimpan
          sampai menitnya dipilih. */}
      <p className="mb-2 text-center text-[15px] font-bold tabular-nums text-[color:var(--pf-accent-strong)]">
        {duaAngka(jam)}:{duaAngka(menit)}
      </p>

      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] font-semibold text-[color:var(--pf-ink-3)]">Jam</p>
          <div className="grid grid-cols-3 gap-1">
            {jamList.map((h) => (
              <button
                key={h}
                type="button"
                aria-label={`Jam ${duaAngka(h)}`}
                aria-pressed={h === jam}
                onClick={() => setJam(h)}
                className={
                  "h-8 rounded-lg text-[12.5px] font-semibold tabular-nums transition-colors hover:bg-[color:var(--pf-surface-2)] " +
                  (h === jam
                    ? "bg-[color:var(--pf-accent)] text-white"
                    : "text-[color:var(--pf-ink)]")
                }
              >
                {duaAngka(h)}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] font-semibold text-[color:var(--pf-ink-3)]">Menit</p>
          <div className="grid grid-cols-2 gap-1">
            {menitList.map((m) => (
              <button
                key={m}
                type="button"
                aria-label={`Menit ${duaAngka(m)}`}
                aria-pressed={m === menit}
                onClick={() => {
                  onPilih(`${duaAngka(jam)}:${duaAngka(m)}`);
                }}
                className={
                  "h-8 rounded-lg text-[12.5px] font-semibold tabular-nums transition-colors hover:bg-[color:var(--pf-surface-2)] " +
                  (m === menit
                    ? "bg-[color:var(--pf-accent)] text-white"
                    : "text-[color:var(--pf-ink)]")
                }
              >
                {duaAngka(m)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
