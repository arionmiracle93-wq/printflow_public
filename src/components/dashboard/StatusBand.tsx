import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Greeting } from "@/components/Greeting";
import { LocalDateTime } from "@/components/LocalDateTime";

/**
 * PITA STATUS
 * ---------------------------------------------------------------
 * Foto hero memakai kelas .hero-photo-bg milik globals.css, yaitu
 * gradasi masking ASLI dari aplikasi. Tidak ada gradasi baru yang
 * ditumpuk di atasnya, tidak ada kartu angka transparan di atas
 * foto. Foto dibiarkan bekerja sendiri sebagai latar.
 *
 * Isi dikunci empat elemen teks saja: sapaan dengan jam, judul,
 * satu kalimat ringkasan, lalu tombol. Angka operasional ada di
 * kartu KPI tepat di bawah pita ini, bukan menumpang di atas foto.
 */
export function StatusBand({ summary, late }: { summary: string; late: number }) {
  const critical = late > 0;

  return (
    <section className="pf-enter relative isolate overflow-hidden rounded-[1.5rem] border border-white/10 text-white shadow-[0_20px_46px_rgba(3,16,23,.35)] dark:border-white/5 dark:shadow-[0_20px_46px_rgba(0,0,0,.5)]">
      {/* Gradasi masking asli, apa adanya dari globals.css */}
      <div className="hero-photo-bg absolute inset-0 -z-20" />
      {/* Aksen cahaya lembut, sama seperti versi asli */}
      <div className="pointer-events-none absolute -bottom-24 -right-10 -z-10 h-56 w-56 rounded-full bg-amber-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -top-16 -left-10 -z-10 h-48 w-48 rounded-full bg-teal-400/20 blur-3xl" />
      <div className="print-halftone absolute inset-0 -z-10 hidden md:block" />

      <div className="relative p-5 [text-shadow:0_1px_10px_rgba(0,0,0,.55)] md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/60">
              <span className="font-semibold text-white/85">
                <Greeting />
              </span>
              <LocalDateTime />
            </p>
          </div>
          <BrandMark compact />
        </div>

        <h1 className="mt-3 max-w-lg text-[1.375rem] font-semibold leading-[1.15] tracking-[-0.02em] text-white md:text-[1.75rem]">
          {critical ? "Ada pekerjaan yang lewat tenggat" : "Produksi berjalan sesuai jadwal"}
        </h1>

        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-white/70">{summary}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href="/pesanan/baru" className="pf-btn pf-btn-primary">
            <Plus size={15} /> Pekerjaan baru
          </Link>
          <Link
            href="/pesanan"
            className="pf-btn border-white/25 bg-white/10 text-white hover:border-white/40 hover:bg-white/20"
          >
            Semua pekerjaan <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
