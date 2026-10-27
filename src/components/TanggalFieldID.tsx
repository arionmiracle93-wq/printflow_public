"use client";

import { useRef, useState } from "react";
import { CalendarRange } from "lucide-react";
import { CalendarPopover } from "@/components/CalendarPopover";

/**
 * PEMILIH TANGGAL BEBAS UNTUK PANEL PENCARIAN
 * ===================================================================
 * Satu tombol, satu kalender, dua tingkat memilih:
 *
 *   Hari  -> kisi tanggal. Kepala kalender bisa lompat ke bulan dan
 *            tahun mana pun, jadi tanggal berapa pun bisa dipilih
 *            tanpa menggulir satu per satu.
 *   Bulan -> kisi 12 bulan. Kepala kalender bisa lompat ke tahun
 *            mana pun.
 *
 * Hasilnya berupa "yyyy-mm-dd" (satu hari) atau "yyyy-mm" (satu bulan).
 *
 * Kenapa tidak memakai MonthTrigger yang sudah ada: isian bulan di
 * form lain HANYA boleh memilih bulan. Di sini yang dicari orang bisa
 * "hari invoice itu dibuat" maupun "semua invoice bulan itu", jadi
 * keduanya harus bisa dipilih dari tempat yang sama - kalau dua
 * tombol terpisah, orang harus menebak kontrol mana yang dipakai.
 *
 * Kenapa tidak menambah perilaku baru di dalam Calendar: Kalender
 * yang ada sudah punya dua mode dengan dua perilaku yang tepat (mode
 * "single" untuk hari, mode "month" untuk bulan). Yang dibutuhkan di
 * sini hanya berpindah di antara keduanya, jadi menambah perilaku
 * ketiga di dalam Calendar justru menambah tempat yang harus dijaga.
 * Sakelarnya dipasang di pemanggil, bukan di dalam.
 */

export type TanggalPilih = "hari" | "bulan";

export function TanggalTrigger({
  className = "",
  label = "Filter tanggal dokumen",
  /** Nilai saat ini: "yyyy-mm-dd" (satu hari) atau "yyyy-mm" (satu bulan). */
  nilai,
  /** Teks di tombol saat belum ada nilai. */
  placeholder = "Pilih tanggal",
  /** Tingkat yang tampil saat kalender dibuka pertama kali. */
  awal = "hari",
  onPilih,
}: {
  className?: string;
  label?: string;
  nilai?: string;
  placeholder?: string;
  awal?: TanggalPilih;
  /** Dipanggil dengan "yyyy-mm-dd" atau "yyyy-mm". String kosong berarti dibatalkan. */
  onPilih: (v: string) => void;
}) {
  const [buka, setBuka] = useState(false);
  const [tingkat, setTingkat] = useState<TanggalPilih>(awal);
  const tombolRef = useRef<HTMLButtonElement>(null);

  const isiBulan = nilai && /^\d{4}-\d{2}$/.test(nilai);
  const mode = tingkat === "bulan" ? "month" : "single";
  // Kalender bulan menerima "yyyy-mm", kalender hari "yyyy-mm-dd".
  // Nilai yang bentuknya tidak cocok dengan tingkat yang sedang
  // ditampilkan sengaja dikosongkan supaya tidak ada lingkaran
  // sorotan yang menyesatkan.
  const nilaiUntukKalender =
    nilai && (tingkat === "bulan" ? !!isiBulan : /^\d{4}-\d{2}-\d{2}$/.test(nilai)) ? nilai : undefined;

  const sakelar = (
    <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-[color:var(--pf-surface-2)] p-1">
      {(["hari", "bulan"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTingkat(t)}
          aria-pressed={tingkat === t}
          className={
            "h-8 rounded-lg text-[12.5px] font-bold transition-colors " +
            (tingkat === t
              ? "bg-[color:var(--pf-surface-solid)] text-[color:var(--pf-ink)] shadow-[var(--pf-shadow-1)]"
              : "text-[color:var(--pf-ink-3)] hover:text-[color:var(--pf-ink)]")
          }
        >
          {t === "hari" ? "Tanggal" : "Bulan"}
        </button>
      ))}
    </div>
  );

  const pemicu = (
    <button
      ref={tombolRef}
      type="button"
      onClick={() => setBuka((v) => !v)}
      aria-expanded={buka}
      aria-haspopup="dialog"
      aria-label={label}
      title="Pilih tanggal, bulan, atau tahun"
      className={`${className} group flex items-center gap-2 text-left`}
    >
      <span className={`min-w-0 flex-1 truncate ${nilai ? "" : "text-slate-400"}`}>
        {nilai ? tampilNilai(nilai) : placeholder}
      </span>
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--pf-surface-2)] text-slate-400 transition-colors group-hover:bg-[color:var(--pf-accent-soft)] group-hover:text-[color:var(--pf-accent-strong)]"
        aria-hidden
      >
        <CalendarRange size={15} />
      </span>
    </button>
  );

  return buka ? (
    <CalendarPopover
      label={label}
      mode={mode}
      nilai={nilaiUntukKalender}
      bulanAwal={nilai}
      tambahan={sakelar}
      onPilih={(v) => {
        const hasil = typeof v === "string" ? v : "";
        if (hasil) onPilih(hasil);
        setBuka(false);
        tombolRef.current?.focus();
      }}
      onTutup={() => setBuka(false)}
    >
      {pemicu}
    </CalendarPopover>
  ) : (
    pemicu
  );
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "yyyy-mm" -> "Oktober 2026"; "yyyy-mm-dd" -> "18 Okt 2026".
    Nilai lain dikembalikan apa adanya, bukan "__" - tombol ini
    menampilkan hasil server, jadi format aneh lebih baik terlihat
    apa adanya daripada jadi tanda tanya yang tidak menjawab apa pun. */
export function tampilNilai(nilai: string): string {
  const bulan = /^(\d{4})-(\d{2})$/.exec(nilai);
  if (bulan) return `${BULAN[Number(bulan[2]) - 1] ?? bulan[2]} ${bulan[1]}`;
  const hari = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nilai);
  if (hari) {
    const nama = BULAN[Number(hari[2]) - 1] ?? hari[2];
    return `${Number(hari[3])} ${nama.slice(0, 3)} ${hari[1]}`;
  }
  return nilai;
}