import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Hand,
  ListTodo,
  PackageCheck,
  Plus,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Greeting } from "@/components/Greeting";
import { HeroHighlightsCarousel } from "@/components/HeroHighlightsCarousel";
import { LocalDateTime } from "@/components/LocalDateTime";

/**
 * HERO DASHBOARD (revisi UI)
 * --------------------------------------------------------------
 * Perubahan dibanding versi lama:
 *  1. Tinggi hero lebih terkendali & hierarki teks lebih jelas
 *     (sapaan → judul → ringkasan → aksi → sorotan AI).
 *  2. Ada "papan status kaca" berisi 3 angka terpenting
 *     (aktif / telat / siap diambil) supaya kondisi percetakan
 *     benar-benar kebaca dalam 3 detik, bukan 30 detik.
 *  3. Overlay gelap tambahan (.pf-hero-veil) → teks tetap terbaca
 *     di foto apa pun, tanpa mengubah .hero-photo-bg yang lama.
 *  4. Tombol aksi lebih besar (target sentuh 44px) & sejajar rapi
 *     di HP maupun desktop.
 *
 * Fungsional TIDAK berubah: foto tetap dari /public/images/
 * dashboard-hero.jpg (desktop) & dashboard-hero-mobile.jpg (HP).
 */
export function DashboardHero({
  summary,
  highlights,
  totalActive,
  late,
  ready,
  risky,
}: {
  summary: string;
  highlights: string[];
  totalActive: number;
  late: number;
  ready: number;
  risky: number;
}) {
  const pills = [
    {
      label: "Aktif",
      value: totalActive,
      icon: <ListTodo size={14} />,
      tone: "text-white",
    },
    {
      label: "Telat",
      value: late,
      icon: <Clock3 size={14} />,
      tone: late > 0 ? "text-rose-300" : "text-emerald-300",
    },
    {
      label: "Waspada",
      value: risky,
      icon: <ShieldAlert size={14} />,
      tone: risky > 0 ? "text-amber-300" : "text-emerald-300",
    },
    {
      label: "Siap",
      value: ready,
      icon: <PackageCheck size={14} />,
      tone: "text-teal-200",
    },
  ];

  return (
    <section className="pf-rise relative isolate overflow-hidden rounded-[1.75rem] border border-white/10 text-white shadow-[0_22px_50px_rgba(3,16,23,.34)] dark:border-white/5 dark:shadow-[0_22px_50px_rgba(0,0,0,.5)]">
      {/* Foto latar (file sama seperti sebelumnya) + kerudung gelap baru */}
      <div className="hero-photo-bg absolute inset-0 -z-20" />
      <div className="pf-hero-veil absolute inset-0 -z-10" />
      {/* Cahaya brand: amber di kanan-bawah, teal di kiri-atas */}
      <div className="pointer-events-none absolute -bottom-24 -right-12 -z-10 h-60 w-60 rounded-full bg-amber-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -top-20 -left-12 -z-10 h-52 w-52 rounded-full bg-teal-400/20 blur-3xl" />
      <div className="print-halftone absolute inset-0 -z-10 hidden opacity-70 md:block" />

      <div className="relative grid gap-5 p-5 [text-shadow:0_1px_12px_rgba(0,0,0,.55)] md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-8 md:p-8">
        {/* ---------- Kolom kiri: sapaan, judul, ringkasan, aksi ---------- */}
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-extrabold text-amber-300 md:text-sm">
                <Greeting /> <Hand size={16} className="inline shrink-0 text-amber-300" aria-hidden />
              </p>
              <p className="mt-1 text-[9px] font-semibold uppercase tracking-[.12em] text-white/55 md:text-[10px]">
                <LocalDateTime />
              </p>
            </div>
            <BrandMark compact />
          </div>

          <h1 className="mt-4 max-w-lg text-[1.35rem] font-black leading-[1.15] tracking-tight md:text-[2rem]">
            Produksi cetak, <span className="text-amber-300">terpantau</span> tepat waktu
          </h1>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-white/75 md:text-sm">{summary}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href="/pesanan/baru"
              className="inline-flex min-h-[42px] items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 py-2 text-xs font-extrabold text-[#07384f] shadow-[0_10px_22px_rgba(0,0,0,.3)] transition-transform hover:-translate-y-0.5 active:scale-[0.97] md:text-sm"
            >
              <Plus size={15} strokeWidth={2.8} className="shrink-0" /> Pekerjaan Baru
              <ArrowRight size={13} className="shrink-0" />
            </Link>
            <Link
              href="/pesanan"
              className="inline-flex min-h-[42px] items-center gap-1.5 whitespace-nowrap rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20 md:text-sm"
            >
              <ListTodo size={15} className="shrink-0" /> Semua Pekerjaan
            </Link>
          </div>

          <div className="mt-5 max-w-xl">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-300">
              <Sparkles size={10} /> Insight AI
            </span>
            <HeroHighlightsCarousel items={highlights} />
          </div>
        </div>

        {/* ---------- Kolom kanan: papan angka kaca ---------- */}
        <div className="grid grid-cols-4 gap-2 md:w-[19rem] md:grid-cols-2 md:gap-2.5">
          {pills.map((p) => (
            <div key={p.label} className="pf-hero-chip rounded-2xl px-2.5 py-2.5 text-center md:px-3 md:py-3 md:text-left">
              <p className="flex items-center justify-center gap-1 text-[9px] font-extrabold uppercase tracking-[.1em] text-white/60 md:justify-start md:text-[10px]">
                <span className="shrink-0">{p.icon}</span> {p.label}
              </p>
              <p className={`pf-num mt-0.5 text-xl font-black md:text-2xl ${p.tone}`}>{p.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
