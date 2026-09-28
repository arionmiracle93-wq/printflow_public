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
 */
export function DashboardHero({ summary, highlights }: { summary: string; highlights: string[] }) {
  return (
    <section className="relative isolate overflow-hidden rounded-[1.5rem] border border-white/10 text-white shadow-[0_20px_46px_rgba(3,16,23,.35)] dark:border-white/5 dark:shadow-[0_20px_46px_rgba(0,0,0,.5)]">
      {/* Foto latar + gradasi gelap. Strategi overlay beda mobile vs desktop, lihat .hero-photo-bg di globals.css */}
      <div className="hero-photo-bg absolute inset-0 -z-20" />
      {/* Aksen brand (amber + teal) sebagai cahaya lembut di belakang foto */}
      <div className="absolute -bottom-24 -right-10 -z-10 h-56 w-56 rounded-full bg-amber-300/25 blur-3xl" />
      <div className="absolute -top-16 -left-10 -z-10 h-48 w-48 rounded-full bg-teal-400/20 blur-3xl" />
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

        <div className="flex flex-wrap gap-2">
          <Link
            href="/pesanan/baru"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 py-2 text-[11px] font-extrabold text-[#07384f] shadow-[0_8px_18px_rgba(0,0,0,.28)] transition-transform active:scale-[0.97] sm:text-xs"
          >
            <Plus size={14} strokeWidth={2.8} className="shrink-0" /> Pekerjaan Baru <ArrowRight size={12} className="shrink-0" />
          </Link>
          <Link
            href="/pesanan"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:text-xs"
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
