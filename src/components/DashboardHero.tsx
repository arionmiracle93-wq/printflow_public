import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Lightbulb,
  ListTodo,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import type { UserRole } from "@/lib/auth-client";
import { LocalDateTime } from "@/components/LocalDateTime";
import { DeviceGreeting } from "@/components/DeviceGreeting";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { MoreMenu } from "@/components/MoreMenu";

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
      @keyframes pfKenburns{0%{transform:scale(1)}100%{transform:scale(1.09)}}
      .pf-kenburns{animation:pfKenburns 20s ease-in-out infinite alternate;will-change:transform;}
      @keyframes pfPulseDot{0%{box-shadow:0 0 0 0 rgba(244,63,94,.5)}70%{box-shadow:0 0 0 7px rgba(244,63,94,0)}100%{box-shadow:0 0 0 0 rgba(244,63,94,0)}}
      .pf-pulse-dot{animation:pfPulseDot 2.2s ease-out infinite;}
      @media (prefers-reduced-motion:reduce){.pf-kenburns{animation:none}.pf-pulse-dot{animation:none}}
    `}</style>
  );
}

/* ==========================================================================
   HERO UTAMA — gaya kartu "coffee app" referensi, diadaptasi untuk
   Percetakan: top bar terintegrasi (menu, cari, notif, tema, akun), foto
   realistis mesin cetak, teks ringkas, dan CTA "Pekerjaan Baru".
   Kartu ini SELALU tampil gelap + foto (di tema terang maupun gelap) sama
   seperti kartu hero pada referensi, sedangkan tombol-tombolnya (tema,
   akun, menu) tetap fungsional karena header utama disembunyikan khusus
   di halaman Dashboard.
   ========================================================================== */
export function DashboardHero({ name, role }: { name: string; role: UserRole }) {
  return (
    <section className="relative isolate overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#1c120d] text-[#f8f1ed] shadow-[0_20px_50px_-28px_rgba(0,0,0,.85)] sm:rounded-[2rem]">
      <HeroStyles />
      {/* Cahaya ambient coklat hangat */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-orange-900/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-14 h-80 w-80 rounded-full bg-amber-600/[0.12] blur-3xl" />
      </div>

      <div className="px-3.5 py-4 sm:px-6 sm:py-6">
        {/* TOP BAR: Menu (owner), Cari, Notif, Tema (gaya referensi, tetap fungsional
            karena header utama disembunyikan khusus di halaman Dashboard) */}
        <div className="mb-4 flex items-center gap-1.5 sm:mb-5 sm:gap-2.5">
          <MoreMenu role={role} />

          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
            <input
              type="text"
              placeholder="Cari pekerjaan…"
              className="h-9 w-full rounded-lg border-none bg-white/5 pl-8 pr-3 text-[11px] font-medium text-white placeholder:text-white/30 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-amber-500/50 sm:h-10 sm:rounded-xl sm:pl-10 sm:text-xs"
            />
          </div>

          <Link
            href="/notifikasi"
            aria-label="Notifikasi"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 transition hover:bg-white/20 active:scale-95 sm:h-9 sm:w-9 sm:rounded-xl"
          >
            <Bell size={17} className="text-[#f8f1ed]/80" />
            <span className="pf-pulse-dot absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-orange-500" />
          </Link>
          <ThemeToggle />
          <div className="hidden h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white/15 sm:block sm:rounded-xl">
            <img src={AVATAR_IMG} alt={name} className="h-full w-full object-cover" />
          </div>
        </div>

        {/* GREETING + akun ringkas */}
        <div className="mb-3.5 flex items-end justify-between gap-2 sm:mb-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="truncate text-[13px] font-medium text-[#f8f1ed]/60 sm:text-base">
              <DeviceGreeting name={name} /> 🖨️
            </h1>
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-amber-500/80 sm:text-[11px]">
              <Sparkles size={11} className="animate-pulse" />
              Status produksi terpantau
            </div>
          </div>
          <UserMenu name={name} role={role} />
        </div>

        {/* HERO CARD: Banner foto + CTA (gaya referensi) */}
        <div className="relative grid min-h-[150px] grid-cols-[1.15fr_.85fr] overflow-hidden rounded-[1.4rem] bg-[#2a1b12] shadow-2xl sm:min-h-[210px] sm:rounded-[1.8rem]">
          <div className="relative z-10 flex flex-col justify-center p-3.5 sm:p-7">
            <h2 className="text-[13px] font-bold leading-[1.25] tracking-tight text-white sm:text-2xl md:text-3xl">
              Cetak sempurna, <span className="text-amber-500">tepat waktu</span> untuk Anda.
            </h2>
            <p className="mt-1.5 max-w-[160px] text-[9px] leading-relaxed text-white/50 sm:mt-3 sm:max-w-xs sm:text-[11px]">
              Pantau status order, risiko telat, dan saran AI dalam satu layar.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-6 sm:gap-3">
              <Link
                href="/pesanan/baru"
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-amber-600 px-3.5 py-1.5 text-[9px] font-bold text-white shadow-lg transition hover:bg-amber-500 hover:shadow-amber-900/20 active:scale-95 sm:gap-2 sm:px-6 sm:py-2.5 sm:text-xs"
              >
                Pekerjaan Baru
                <ArrowRight size={12} />
              </Link>
            </div>

            {/* Carousel Dots */}
            <div className="mt-3 flex items-center gap-1.5 sm:mt-6">
              <span className="h-1.5 w-4 rounded-full bg-amber-500" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
            </div>
          </div>

          {/* Foto realistis mesin cetak (posisi kanan) */}
          <div className="relative overflow-hidden">
            <img
              src={HERO_IMG}
              alt="Mesin cetak percetakan profesional"
              className="pf-kenburns absolute inset-0 h-full w-full object-cover"
            />
            {/* Overlay gradasi agar teks di kiri terbaca */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#2a1b12] via-[#2a1b12]/55 to-transparent" />
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
