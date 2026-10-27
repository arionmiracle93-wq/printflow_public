import Link from "next/link";
import { ArrowRight, Hand, ListTodo, Plus, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Greeting } from "@/components/Greeting";
import { HeroHighlightsCarousel } from "@/components/HeroHighlightsCarousel";
import { HeroSlideshow } from "@/components/dashboard/HeroSlideshow";
import { LocalDateTime } from "@/components/LocalDateTime";

/**
 * HERO FOTO DASHBOARD
 * ---------------------------------------------------------------
 * Markup awal disalin dari src/app/page.tsx versi asli (commit bacb913),
 * lalu dirawat sebagai komponen tersendiri supaya page.tsx ringkas.
 *
 * Foto: slideshow 3 slide, geser kiri tiap 6 detik. Setiap slide punya
 * pasangan gambar terang/gelap untuk desktop dan HP — lihat
 * HeroSlideshow.tsx untuk daftar file.
 *
 * Tema terang vs gelap (Oktober 2026):
 *   - foto, overlay, teks, tombol, badge, dan indikator carousel punya
 *     varian terang/gelap supaya kontras tetap terbaca;
 *   - tema terang memakai foto/ilustrasi terang + teks navy;
 *   - tema gelap tetap memakai foto gelap + teks putih seperti semula;
 *   - overlay hero diatur di .hero-photo-bg, pemilihan foto di .hero-slide.
 *
 * Optimasi scroll:
 *   - blur-3xl diganti gradasi radial (.pf-hero-glow)
 *   - backdrop-blur tombol "Semua Pekerjaan" hanya aktif di md ke atas;
 *     di HP latar tombol sudah solid sehingga efek kacanya nyaris tak
 *     terlihat, tapi biayanya besar saat header ikut ber-backdrop-blur
 *   - hero dijadikan lapisan GPU tersendiri (.pf-hero) supaya saat
 *     digulir cukup digeser, tidak digambar ulang
 *
 * Catatan tata letak tombol:
 *   - dua tombol selalu sejajar kiri-kanan; di HP berbagi lebar sama rata;
 *   - ikon panah "Pekerjaan Baru" disembunyikan di bawah 390px, dan di
 *     bawah 350px jarak/ukuran huruf dirapatkan supaya tidak kepotong;
 *   - di layar >= 640px tombol kembali selebar isinya, rata kiri.
 */
export function DashboardHero({ summary, highlights }: { summary: string; highlights: string[] }) {
  return (
    <section className="pf-hero relative isolate overflow-hidden rounded-[1.5rem] border border-[#07384f]/10 bg-[#eef8fc] text-[#07384f] dark:border-white/5 dark:bg-[#07141d] dark:text-white dark:shadow-[0_20px_46px_rgba(0,0,0,.5)]">
      {/* Foto latar (slideshow) lalu overlay di atasnya. Urutan DOM ini penting:
          keduanya -z-20, yang belakangan tampil di atas. Set gambar dan overlay
          mengikuti tema terang/gelap; lihat .hero-slide & .hero-photo-bg di globals.css. */}
      <HeroSlideshow />
      <div className="hero-photo-bg absolute inset-0 -z-20" aria-hidden />
      {/* Aksen brand sebagai cahaya lembut di belakang foto. Cahaya amber di sudut kanan
          bawah DIHAPUS (Oktober 2026) karena menguning-kan foto; tinggal cahaya teal.
          Di tema terang intensitasnya dikurangi supaya tidak menutupi foto terang.
          (Kelas .pf-hero-glow-amber di dashboard.css sekarang tidak terpakai.)
          Catatan lama:
          Dulu dibuat dengan filter blur-3xl (blur 64px), salah satu efek
          paling berat untuk GPU HP. Sekarang memakai gradasi radial dengan
          posisi dan warna yang sama, hasil visualnya setara tanpa filter. */}
      <div className="pf-hero-glow pf-hero-glow-teal opacity-50 dark:opacity-100" aria-hidden />
      <div className="print-halftone absolute inset-0 -z-10 hidden md:block" />

      <div className="relative flex flex-col gap-4 p-5 [text-shadow:0_1px_2px_rgba(255,255,255,.5)] dark:[text-shadow:0_1px_10px_rgba(0,0,0,.55)] md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
              <Greeting /> <Hand size={20} className="inline text-amber-700 dark:text-amber-300" aria-hidden />
            </p>
            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.1em] text-[#07384f]/75 dark:text-white/50">
              <LocalDateTime />
            </p>
          </div>
          <BrandMark compact />
        </div>

        <div className="max-w-md">
          <h1 className="text-xl font-black leading-tight tracking-tight md:text-[1.75rem]">
            Produksi cetak, <span className="text-amber-700 dark:text-amber-300">terpantau</span> tepat waktu
          </h1>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#254e5c] dark:text-white/70 md:text-sm">{summary}</p>
        </div>

        <div className="flex flex-nowrap gap-2">
          <Link
            href="/pesanan/baru"
            className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full max-[349px]:gap-1 max-[349px]:px-2 max-[349px]:text-[10px] bg-[#07384f] px-3 py-2 text-[11px] font-extrabold text-white shadow-[0_8px_18px_rgba(7,56,79,.24)] transition-[transform,background-color] hover:bg-[#0b4a63] active:scale-[0.97] dark:bg-white dark:text-[#07384f] dark:shadow-[0_8px_18px_rgba(0,0,0,.28)] dark:hover:bg-white/90 sm:flex-none sm:px-4 sm:text-xs"
          >
            <Plus size={14} strokeWidth={2.8} className="shrink-0" /> Pekerjaan Baru <ArrowRight size={12} className="shrink-0 max-[389px]:hidden" />
          </Link>
          <Link
            href="/pesanan"
            className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full max-[349px]:gap-1 max-[349px]:px-2 max-[349px]:text-[10px] border border-[#07384f]/20 bg-white/75 px-3 py-2 text-[11px] font-bold text-[#07384f] shadow-[0_4px_14px_rgba(7,56,79,.08)] transition-colors hover:bg-white/90 dark:border-white/25 dark:bg-white/10 dark:text-white dark:shadow-none dark:hover:bg-white/20 md:backdrop-blur-sm sm:flex-none sm:px-4 sm:text-xs"
          >
            <ListTodo size={14} className="shrink-0" /> Semua Pekerjaan
          </Link>
        </div>

        <div>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50/90 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-800 shadow-sm dark:border-transparent dark:bg-amber-400/15 dark:text-amber-300 dark:shadow-none">
            <Sparkles size={10} /> Insight AI
          </span>
          <HeroHighlightsCarousel items={highlights} />
        </div>
      </div>
    </section>
  );
}
