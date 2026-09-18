import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  ListTodo,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { LocalDateTime } from "@/components/LocalDateTime";
import { DeviceGreeting } from "@/components/DeviceGreeting";

const HERO_IMG = "/images/dashboard/hero-cetak.jpg";
const AI_IMG = "/images/dashboard/ringkasan-ai.jpg";

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
   HERO UTAMA — gaya banner aplikasi referensi: sapaan, foto percetakan
   realistis di kanan, judul dengan satu kata aksen amber, CTA pill + dot.
   Kartu ini sengaja berpermukaan gelap di tema terang MAUPUN gelap (foto
   terlihat paling hidup di atas latar gelap), sama seperti banner referensi.
   ========================================================================== */
export function DashboardHero({ name }: { name: string }) {
  return (
    <section className="relative isolate overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0b1420] text-white shadow-[0_26px_60px_-32px_rgba(2,18,28,.95)]">
      <HeroStyles />
      {/* Cahaya ambient */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-14 h-80 w-80 rounded-full bg-amber-400/[0.16] blur-3xl" />
      </div>

      <div className="p-3.5 sm:p-5 md:p-6">
        {/* Baris sapaan + jam lokal (ditumpuk di HP agar tidak berdesakan) */}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2.5">
          <h1 className="text-[13px] font-extrabold tracking-tight sm:text-lg md:text-xl">
            <DeviceGreeting name={name} />
          </h1>
          <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[9px] font-bold text-cyan-50/85 sm:gap-2 sm:text-[10px] [&_svg]:hidden sm:[&_svg]:block">
            <LocalDateTime />
          </span>
        </div>

        {/* Banner foto + pesan */}
        <div className="mt-3 grid grid-cols-[1.06fr_.94fr] overflow-hidden rounded-2xl border border-white/10 bg-[#0c1826] shadow-[inset_0_1px_0_rgba(255,255,255,.05)] sm:mt-4 md:grid-cols-[1.12fr_1fr]">
          <div className="relative flex flex-col justify-center p-3.5 sm:p-5 md:p-6">
            <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[.14em] text-amber-300 sm:text-[10px]">
              <Sparkles size={10} /> Monitoring produksi
            </p>
            <h2 className="mt-2 text-[15px] font-black leading-[1.16] tracking-tight sm:mt-2.5 sm:text-2xl md:text-[1.7rem] md:leading-[1.12]">
              Setiap order cetak, <span className="text-amber-400">terpantau</span> sampai siap.
            </h2>
            <p className="mt-1.5 max-w-md text-[10.5px] leading-relaxed text-white/70 sm:mt-2 sm:text-xs">
              Status produksi, sisa waktu, dan risiko keterlambatan dalam satu layar yang ringkas.
            </p>

            <div className="mt-3 flex flex-col gap-1.5 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/pesanan/baru"
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2 text-[11px] font-extrabold text-[#0b1420] shadow-[0_8px_20px_rgba(0,0,0,.28)] transition hover:bg-amber-300 active:scale-[.98] sm:gap-2 sm:text-sm"
              >
                <Plus size={14} strokeWidth={2.8} className="sm:h-4 sm:w-4" />
                Pekerjaan Baru
                <ArrowRight size={13} className="sm:h-4 sm:w-4" />
              </Link>
              <Link
                href="/pesanan"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-extrabold text-white transition hover:bg-white/20 active:scale-[.98] sm:gap-2 sm:text-sm"
              >
                <ListTodo size={13} className="sm:h-4 sm:w-4" />
                Lihat Semua
              </Link>
            </div>

            {/* Dot (gaya indikator carousel referensi) */}
            <div className="mt-4 hidden items-center gap-1.5 sm:flex">
              <span className="h-1.5 w-5 rounded-full bg-amber-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
            </div>
          </div>

          {/* Foto realistis */}
          <div className="relative min-h-[168px] overflow-hidden sm:min-h-[212px] md:min-h-[258px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={HERO_IMG}
              alt="Mesin cetak digital sedang memproduksi brosur dan kartu nama"
              loading="eager"
              fetchPriority="high"
              className="pf-kenburns absolute inset-0 h-full w-full object-cover object-center"
            />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#0c1826] via-[#0c1826]/25 to-transparent" />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#0b1420]/60 via-transparent to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   KPI — ditata ulang seperti "category tiles" referensi: ikon dalam kotak
   lembut, angka besar, label kecil. Warna semantik dipertahankan dan ikut
   berubah di mode gelap lewat kelas yang sudah di-override di globals.css.
   ========================================================================== */
const TILE_TONES = {
  teal: "bg-teal-50 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
  yellow: "bg-amber-50 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
  blue: "bg-sky-50 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300",
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
    <div className="card group relative flex flex-col overflow-hidden p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(15,75,84,.13)] md:p-4">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-teal-400 to-amber-300 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-[0.85rem] md:h-10 md:w-10 ${TILE_TONES[accent]}`}>
          {icon}
        </span>
        {alert ? <span className="pf-pulse-dot mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" /> : null}
      </div>
      <p className={`mt-2.5 text-lg font-black leading-none tracking-tight tabular-nums md:text-[1.55rem] ${tone}`}>
        {value}
      </p>
      <p className="mt-1.5 text-[9.5px] font-extrabold uppercase leading-tight tracking-[.07em] text-slate-500 md:text-[10px]">
        {label}
      </p>
      {hint ? <p className="mt-0.5 text-[9.5px] font-semibold text-slate-400 md:text-[10.5px]">{hint}</p> : null}
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
    <section className="relative isolate overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0c1826] text-white shadow-[0_26px_60px_-34px_rgba(2,18,28,.95)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-400/[0.12] blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-teal-500/[0.16] blur-3xl" />
      </div>

      <div className="grid md:grid-cols-[1.28fr_.82fr]">
        <div className="p-4 sm:p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-amber-300">
              <Sparkles size={11} /> Ringkasan AI
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[9.5px] font-bold text-cyan-50/80">
              <RefreshCw size={10} /> Update otomatis
            </span>
          </div>

          <h2 className="mt-3 text-lg font-black leading-tight tracking-tight sm:text-2xl">
            Kondisi produksi <span className="text-amber-400">hari ini</span>
          </h2>
          <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-white/80 sm:text-[13px]">
            {summary}
          </p>

          {highlights.length ? (
            <ul className="mt-3 grid gap-x-4 gap-y-1.5 text-[10.5px] text-white/75 sm:grid-cols-2 sm:text-[11.5px]">
              {highlights.slice(0, 4).map((h) => (
                <li key={h} className="flex items-start gap-1.5">
                  <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-teal-300" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {actions.length ? (
            <div className="mt-3.5 rounded-xl border border-amber-300/25 bg-amber-300/[0.1] p-3">
              <p className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-[.09em] text-amber-300 sm:text-[10px]">
                <Lightbulb size={12} /> Tindakan yang disarankan
              </p>
              <ul className="mt-1.5 space-y-1 text-[10.5px] font-medium text-amber-50/90 sm:text-[11.5px]">
                {actions.slice(0, 3).map((a) => (
                  <li key={a} className="flex items-start gap-1.5">
                    <ArrowRight size={11} className="mt-0.5 shrink-0 text-amber-300" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Foto hasil produksi */}
        <div className="relative min-h-[176px] overflow-hidden md:min-h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={AI_IMG}
            alt="Hasil cetakan yang sudah selesai dan siap diambil pelanggan"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#0c1826] via-transparent to-[#0c1826]/70 md:bg-gradient-to-r md:from-[#0c1826] md:via-transparent md:to-transparent"
          />
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[9.5px] font-bold text-white/90 backdrop-blur-sm md:bottom-4 md:left-4">
            <Sparkles size={10} className="text-amber-300" /> Analisis {sourceLabel}
          </span>
        </div>
      </div>
    </section>
  );
}
