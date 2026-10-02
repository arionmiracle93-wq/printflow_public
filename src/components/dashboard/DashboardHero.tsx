import Link from "next/link";
import { ArrowRight, Hand, ListTodo, Plus, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Greeting } from "@/components/Greeting";
import { HeroHighlightsCarousel } from "@/components/HeroHighlightsCarousel";
import { LocalDateTime } from "@/components/LocalDateTime";

/**
 * HERO FOTO DASHBOARD, DESAIN ORIGINAL
 * ---------------------------------------------------------------
 * Markup di bawah ini disalin apa adanya dari src/app/page.tsx versi
 * asli (commit bacb913), hanya dipindah ke komponen tersendiri supaya
 * page.tsx lebih ringkas. Tidak ada kelas, ukuran, gradasi, atau
 * teks yang diubah:
 *   - foto dan gradasi masking: .hero-photo-bg di globals.css
 *   - cahaya amber dan teal, tekstur halftone
 *   - sapaan, jam lokal, BrandMark
 *   - judul, ringkasan AI, dua tombol
 *   - badge Insight AI dan carousel sorotan (HeroHighlightsCarousel)
 *
 * Foto: /public/images/dashboard-hero.jpg (desktop) dan
 * dashboard-hero-mobile.jpg (HP).
 *
 * Optimasi scroll (Oktober 2026), tampilan tetap sama:
 *   - blur-3xl diganti gradasi radial (.pf-hero-glow)
 *   - backdrop-blur tombol "Semua Pekerjaan" hanya aktif di md ke atas;
 *     di HP latar tombol sudah gelap sehingga efek kacanya nyaris tak
 *     terlihat, tapi biayanya besar saat header ikut ber-backdrop-blur
 *   - hero dijadikan lapisan GPU tersendiri (.pf-hero) supaya saat
 *     digulir cukup digeser, tidak digambar ulang
 *
 * Revisi 30 September 2026:
 *   - bayangan (drop shadow) kartu hero dihapus di tema terang; di tema
 *     gelap tetap ada (dark:shadow-...)
 *   - dua tombol selalu sejajar kiri-kanan (dulu numpuk atas-bawah di HP
 *     sempit). Di HP kedua tombol berbagi lebar sama rata; ikon panah di
 *     tombol "Pekerjaan Baru" disembunyikan di bawah 390px, dan di bawah
 *     350px jarak/ukuran huruf dirapatkan supaya tidak kepotong. Di layar
 *     >= 640px tombol kembali selebar isinya, rata kiri seperti semula.
 */
export function DashboardHero({ summary, highlights }: { summary: string; highlights: string[] }) {
  return (
    <section className="pf-hero relative isolate overflow-hidden rounded-[1.5rem] border border-white/10 text-white dark:border-white/5 dark:shadow-[0_20px_46px_rgba(0,0,0,.5)]">
      {/* Foto latar + gradasi gelap. Strategi overlay beda mobile vs desktop, lihat .hero-photo-bg di globals.css */}
      <div className="hero-photo-bg absolute inset-0 -z-20" />
      {/* Aksen brand (amber + teal) sebagai cahaya lembut di belakang foto.
          Dulu dibuat dengan filter blur-3xl (blur 64px), salah satu efek
          paling berat untuk GPU HP. Sekarang memakai gradasi radial dengan
          posisi dan warna yang sama, hasil visualnya setara tanpa filter. */}
      <div className="pf-hero-glow pf-hero-glow-amber" aria-hidden />
      <div className="pf-hero-glow pf-hero-glow-teal" aria-hidden />
      <div className="print-halftone absolute inset-0 -z-10 hidden md:block" />

      <div className="relative flex flex-col gap-4 p-5 [text-shadow:0_1px_10px_rgba(0,0,0,.55)] md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
              <Greeting /> <Hand size={20} className="inline text-amber-300" aria-hidden />
            </p>
            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.1em] text-white/50">
              <LocalDateTime />
            </p>
          </div>
          <BrandMark compact />
        </div>

        <div className="max-w-md">
          <h1 className="text-xl font-black leading-tight tracking-tight md:text-[1.75rem]">
            Produksi cetak, <span className="text-amber-300">terpantau</span> tepat waktu
          </h1>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/70 md:text-sm">{summary}</p>
        </div>

        <div className="flex flex-nowrap gap-2">
          <Link
            href="/pesanan/baru"
            className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full max-[349px]:gap-1 max-[349px]:px-2 max-[349px]:text-[10px] bg-white px-3 py-2 text-[11px] font-extrabold text-[#07384f] shadow-[0_8px_18px_rgba(0,0,0,.28)] transition-transform active:scale-[0.97] sm:flex-none sm:px-4 sm:text-xs"
          >
            <Plus size={14} strokeWidth={2.8} className="shrink-0" /> Pekerjaan Baru <ArrowRight size={12} className="shrink-0 max-[389px]:hidden" />
          </Link>
          <Link
            href="/pesanan"
            className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full max-[349px]:gap-1 max-[349px]:px-2 max-[349px]:text-[10px] border border-white/25 bg-white/10 px-3 py-2 text-[11px] font-bold text-white transition-colors md:backdrop-blur-sm hover:bg-white/20 sm:flex-none sm:px-4 sm:text-xs"
          >
            <ListTodo size={14} className="shrink-0" /> Semua Pekerjaan
          </Link>
        </div>

        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-300">
            <Sparkles size={10} /> Insight AI
          </span>
          <HeroHighlightsCarousel items={highlights} />
        </div>
      </div>
    </section>
  );
}
