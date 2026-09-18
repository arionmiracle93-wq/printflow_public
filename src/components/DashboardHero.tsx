import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Lightbulb,
  ListTodo,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { LocalDateTime } from "@/components/LocalDateTime";
import { DeviceGreeting } from "@/components/DeviceGreeting";

const HERO_IMG = "/images/dashboard/hero-cetak-v2.jpg";
const AI_IMG = "/images/dashboard/ringkasan-ai-v2.jpg";
const AVATAR_IMG = "/images/dashboard/user-avatar.jpg";

/**
 * Animasi kecil di-scope lewat nama kelas khusus (pf-*) supaya tidak menyentuh
 * globals.css. Tidak ada backdrop-blur berat di area foto (hemat GPU di APK).
 */
function HeroStyles() {
  return (
    <style>{`
      @keyframes pfKenburns{0%{transform:scale(1)}100%{transform:scale(1.09)}}}
      .pf-kenburns{animation:pfKenburns 20s ease-in-out infinite alternate;will-change:transform;}
      @keyframes pfPulseDot{0%{box-shadow:0 0 0 0 rgba(244,63,94,.5)}70%{box-shadow:0 0 0 7px rgba(244,63,94,0)}100%{box-shadow:0 0 0 0 rgba(244,63,94,0)}}
      .pf-pulse-dot{animation:pfPulseDot 2.2s ease-out infinite;}
      @media (prefers-reduced-motion:reduce){.pf-kenburns{animation:none}.pf-pulse-dot{animation:none}}
    `}</style>
  );
}

/* ==========================================================================
   HERO UTAMA — Gaya Aplikasi Kopi Premium (Referensi)
   Diadaptasi untuk Percetakan: Top Bar Terintegrasi, Foto Realistis,
   Tipografi Lebih Ringkas, dan CTA "Pekerjaan Baru".
   ========================================================================== */
export function DashboardHero({ name }: { name: string }) {
  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[#1c120d] text-[#f8f1ed] shadow-[0_26px_60px_-32px_rgba(0,0,0,.9)]">
      <HeroStyles />
      {/* Cahaya ambient coklat hangat */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-orange-900/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-14 h-80 w-80 rounded-full bg-amber-600/[0.12] blur-3xl" />
      </div>

      <div className="px-4 py-6 sm:px-6 sm:py-8">
        {/* TOP BAR: Menu, Search, Notif, Avatar (Gaya Referensi) */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 transition hover:bg-white/10 active:scale-95">
            <Menu size={20} className="text-[#f8f1ed]/80" />
          </button>
          
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input 
              type="text" 
              placeholder="Cari pekerjaan..." 
              className="h-10 w-full rounded-xl border-none bg-white/5 pl-10 pr-4 text-xs font-medium placeholder:text-white/30 focus:bg-white/10 focus:ring-1 focus:ring-amber-500/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <button className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 transition hover:bg-white/10 active:scale-95">
              <Bell size={20} className="text-[#f8f1ed]/80" />
              <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-orange-500" />
            </button>
            <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10">
              <img src={AVATAR_IMG} alt={name} className="h-full w-full object-cover" />
            </div>
          </div>
        </div>

        {/* GREETING */}
        <div className="mb-5 flex flex-col gap-0.5">
          <h1 className="text-base font-medium text-[#f8f1ed]/60 sm:text-lg">
            Selamat pagi, {name}! 🖨️
          </h1>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-500/80 sm:text-xs">
            <Sparkles size={12} className="animate-pulse" />
            Status Produksi Terpantau
          </div>
        </div>

        {/* HERO CARD: Banner foto + CTA (Gaya Referensi) */}
        <div className="relative grid min-h-[180px] grid-cols-[1.1fr_.9fr] overflow-hidden rounded-[1.8rem] bg-[#2a1b12] shadow-2xl sm:min-h-[220px]">
          <div className="relative z-10 flex flex-col justify-center p-5 sm:p-7">
            <h2 className="text-[17px] font-bold leading-[1.2] tracking-tight text-white sm:text-2xl md:text-3xl">
              Cetak sempurna, <span className="text-amber-500">tepat waktu</span> untuk Anda.
            </h2>
            <p className="mt-2 max-w-[200px] text-[10px] leading-relaxed text-white/50 sm:mt-3 sm:max-w-xs sm:text-[11px]">
              Pantau status tiap order, risiko keterlambatan, dan rekomendasi AI dalam satu layar.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-6">
              <Link
                href="/pesanan/baru"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-600 px-5 py-2 text-[11px] font-bold text-white shadow-lg transition hover:bg-amber-500 hover:shadow-amber-900/20 active:scale-95 sm:px-6 sm:py-2.5 sm:text-xs"
              >
                Pekerjaan Baru
                <ArrowRight size={14} />
              </Link>
            </div>
            
            {/* Carousel Dots */}
            <div className="mt-6 flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full bg-amber-500" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
            </div>
          </div>

          {/* Foto Realistis (Posisi Kanan) */}
          <div className="relative overflow-hidden">
            <img
              src={HERO_IMG}
              alt="Professional printing shop"
              className="pf-kenburns absolute inset-0 h-full w-full object-cover"
            />
            {/* Overlay gradasi agar teks di kiri terbaca */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#2a1b12] via-[#2a1b12]/60 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   KPI — Ditata ulang seperti "Category Tiles" di aplikasi kopi:
   Ikon minimalis, angka yang jelas, dan label yang rapi.
   ========================================================================== */
const TILE_TONES = {
  teal: "text-teal-600 dark:text-teal-400",
  yellow: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
  blue: "text-sky-600 dark:text-sky-400",
} as const;

export function StatTile({
  label,
  value,
  hint,
  icon,
  accent = "teal",
  tone = "text-[#07384f]",
  alert = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  accent?: keyof typeof TILE_TONES;
  tone?: string;
  alert?: boolean;
}) {
  return (
    <div className="card group flex flex-col items-center justify-center p-3 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-[#1a2633] md:p-4">
      <div className="relative mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 shadow-inner transition-colors group-hover:bg-white dark:bg-white/5 md:h-14 md:w-14">
        <span className={`${TILE_TONES[accent]}`}>
          {icon}
        </span>
        {alert ? (
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500"></span>
          </span>
        ) : null}
      </div>
      <p className={`text-base font-bold leading-none tracking-tight tabular-nums md:text-xl ${tone}`}>
        {value}
      </p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 md:text-[10px]">
        {label}
      </p>
      {hint ? (
        <p className="mt-1 text-[8px] font-medium text-slate-400/80 md:text-[9px]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   RINGKASAN AI — dipindah dari dalam hero & ditata seperti "promo band"
   referannya: panel gelap dengan foto hasil produksi di kanan. Seluruh
   informasi lama (ringkasan, poin penting, saran tindakan) tetap utuh.
   ========================================================================== */
export function AiSummaryBand({
  summary,
  source,
  highlights,
  actions,
}: {
  summary: string;
  source: string;
  highlights: string[];
  actions: string[];
}) {
  const sourceLabel = source === "engine" ? "mesin lokal" : source;
  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[#2d1e17] text-[#f8f1ed] shadow-xl">
      <div className="grid md:grid-cols-[1.4fr_1fr]">
        <div className="p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-500">
              <Sparkles size={14} />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80">Analisis AI</span>
          </div>

          <h2 className="mt-3 text-lg font-bold leading-tight sm:text-xl">
            Optimasi produksi <span className="text-amber-500">hari ini</span>
          </h2>
          <p className="mt-2 text-[11px] leading-relaxed text-[#f8f1ed]/60 sm:text-xs">
            {summary}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button className="rounded-full bg-white/10 px-4 py-1.5 text-[10px] font-bold text-white transition hover:bg-white/20">
              Detail Analisis
            </button>
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[9px] font-medium text-white/40">
              <RefreshCw size={10} /> {sourceLabel}
            </div>
          </div>
        </div>

        {/* Foto hasil produksi (Gaya "Promo" Card) */}
        <div className="relative min-h-[140px] overflow-hidden md:min-h-full">
          <img
            src={AI_IMG}
            alt="Hasil cetakan berkualitas"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#2d1e17] via-[#2d1e17]/40 to-transparent" />
        </div>
      </div>
    </section>
  );
}
