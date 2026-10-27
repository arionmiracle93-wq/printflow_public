"use client";

import { useRef, useState } from "react";
import { CalendarRange } from "lucide-react";
import { CalendarPopover } from "@/components/CalendarPopover";

/**
 * INPUT BULAN (pengganti <input type="month">)
 *
 * Kenapa tidak pakai input type=month polos:
 * - Popup bawaan perangkat tidak bisa diberi gaya, jadi di mode gelap
 *   ia muncul terang di tengah aplikasi yang gelapnya sendiri.
 * - Tampilannya juga kosong kalau bulannya tidak diisi, sehingga di
 *   form filter orang tidak tahu field itu untuk memilih bulan.
 * - Di sebagian browser, placeholder-nya juga berbeda tiap perangkat.
 *
 * Sekarang berupa tombol yang isinya nama bulan dan tahun
 * ("Oktober 2026"), dan form tersembunyi tetap membawa nilai
 * "yyyy-mm" yang sudah jadi format query string di URL.
 */
export function MonthFieldID({
  name,
  defaultValue,
  className = "",
  label,
  min,
  maks,
}: {
  /** Nama field di form GET. Nilai yang dikirim tetap "yyyy-mm". */
  name: string;
  defaultValue?: string; // "yyyy-mm" atau ""
  className?: string;
  label?: string;
  min?: string;
  maks?: string;
}) {
  const [nilai, setNilai] = useState(defaultValue ?? "");

  return (
    <>
      <input type="hidden" name={name} value={nilai} />
      <MonthTrigger
        className={className}
        label={label ?? "Pilih bulan"}
        nilai={nilai}
        min={min}
        maks={maks}
        onPilih={setNilai}
      />
    </>
  );
}

/**
 * TOMBOL PEMICU BULAN (dipakai MonthFieldID di atas)
 *
 * Tidak diekspor. Dulu ikut exported karena panel pencarian di header
 * memakainya: saat itu panel itu menyaring dengan bulan ATAU rentang
 * tanggal, jadi butuh dua nama berbeda di satu tombol. Sekarang panel
 * cari punya komponennya sendiri (TanggalFieldID/TanggalTrigger) yang
 * menangani bulan dan hari sekaligus, jadi pemakai kedua itu hilang
 * - dan prop teksTampil yang hanya buatnya ikut dihapus.
 *
 * Kalau nanti ada pemakai baru yang HANYA butuh bulan, komponen ini
 * yang dipakai - jangan menyalin tombolnya ke tempat lain.
 */
function MonthTrigger({
  className = "",
  label = "Pilih bulan",
  nilai,
  min,
  maks,
  onPilih,
}: {
  className?: string;
  label?: string;
  nilai: string;
  min?: string;
  maks?: string;
  /** Dipanggil dengan "yyyy-mm" yang baru dipilih. */
  onPilih: (v: string) => void;
}) {
  const [buka, setBuka] = useState(false);
  const tombolRef = useRef<HTMLButtonElement>(null);

  /* Tombol + panel. Pemeriksaan "klik di luar" dan Escape ditangani di
     dalam CalendarPopover (melalui PopoverPanel), yang membungkus keduanya
     sekaligus - bukan hanya tombolnya seperti versi lama. */

  return buka ? (
    <CalendarPopover
      label={label}
      mode="month"
      nilai={nilai || undefined}
      min={min ? `${min}-01` : undefined}
      maks={maks ? `${maks}-28` : undefined}
      bulanAwal={nilai ? `${nilai}-01` : undefined}
      onPilih={(v) => {
        onPilih(typeof v === "string" ? v : "");
        setBuka(false);
        tombolRef.current?.focus();
      }}
      onTutup={() => setBuka(false)}
    >
      <TombolBulan className={className} label={label} nilai={nilai} buka={buka} setBuka={setBuka} tombolRef={tombolRef} />
    </CalendarPopover>
  ) : (
    /* Popup ditutup: tidak ada yang perlu diukur. Pemeriksaan "klik di
       luar" dan Escape hanya jalan saat buka. */
    <TombolBulan className={className} label={label} nilai={nilai} buka={buka} setBuka={setBuka} tombolRef={tombolRef} />
  );
}

/** Tombol pemicu. Dipisah dari popup supaya posisinya sama persis
    dengan maupun tanpa popup terbuka - popup mengukur ruang kosong
    terhadap elemen ini, jadi kalau ia bergeser saat popup muncul,
    pengukurannya salah.

    div pembungkus di sini TIDAK memakai ref, dan memang tidak perlu:
    pemeriksaan "klik di luar" dilakukan CalendarPopover pada div yang
    membungkus tombol dan panel sekaligus, jadi panel ikut terhitung
    sebagai bagian dari dalam. Lihat efek "Tutup sendiri" di sana. */
function TombolBulan({
  className,
  label,
  nilai,
  buka,
  setBuka,
  tombolRef,
}: {
  className: string;
  label: string;
  nilai: string;
  buka: boolean;
  setBuka: React.Dispatch<React.SetStateAction<boolean>>;
  tombolRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="relative">
      <button
        ref={tombolRef}
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-expanded={buka}
        aria-haspopup="dialog"
        aria-label={label}
        title="Pilih bulan dari kalender"
        /* group: ikon di dalam ikut berubah warna saat kursor di atas
           field, supaya orang tahu kalender ini yang dipicu. */
        className={`${className} group flex items-center gap-2 text-left`}
      >
        <span className={`min-w-0 flex-1 truncate ${nilai ? "" : "text-slate-400"}`}>
          {tampilBulan(nilai)}
        </span>
        {/* Ikon di KANAN, sama seperti tombol kalender di DateFieldID
            (lihat src/components/DateFieldID.tsx). Dua isian tanggal ini
            selalu berdampingan di banyak halaman; kalau ikon bulan ada
            di kiri sementara ikon tanggal di kanan, yang keduanya berarti
            hal sama jadi terlihat seperti dua hal berbeda.

            Ikon diberi warna dan latar sendiri supaya terbaca sebagai
            tombol, bukan sekadar hiasan. Sebelum ini ikonnya cuma glyph
            abu-abu kecil di tepi kiri - secara teknis bisa diklik, tapi
            tidak ada yang menyangka itu tombol. */}
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--pf-surface-2)] text-slate-400 transition-colors group-hover:bg-[color:var(--pf-accent-soft)] group-hover:text-[color:var(--pf-accent-strong)]"
          aria-hidden
        >
          <CalendarRange size={15} />
        </span>
      </button>
    </div>
  );
}

function tampilBulan(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return "Pilih bulan";
  const nama = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${nama[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}
