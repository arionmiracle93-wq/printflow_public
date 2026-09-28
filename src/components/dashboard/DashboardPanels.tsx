import type { ReactNode } from "react";
import Link from "next/link";
import {
  CalendarClock,
  ChevronRight,
  PieChart,
  Sparkles,
  Workflow,
} from "lucide-react";
import { STATUSES, statusMeta } from "@/lib/domain";
import { STATUS_ICONS } from "@/components/ui";

/* ============================================================
   1. PANEL PIPELINE — "Posisi pekerjaan per tahap"
   Revisi: dari daftar 9 baris memanjang menjadi grid kartu-kartu
   kecil yang bisa diklik. Lebih padat, lebih mudah dipindai,
   dan tetap menampilkan jumlah + bar proporsi seperti sebelumnya.
   ============================================================ */
export function PipelinePanel({ counts }: { counts: Map<string, number> }) {
  const total = STATUSES.reduce((sum, s) => sum + (counts.get(s.key) ?? 0), 0);
  const max = Math.max(1, ...STATUSES.map((s) => counts.get(s.key) ?? 0));

  return (
    <section className="pf-card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/10">
        <span className="icon-tile">
          <Workflow size={17} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-[#07384f] dark:text-slate-100">Posisi pekerjaan per tahap</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Ketuk satu tahap untuk melihat daftarnya</p>
        </div>
        <span className="ml-auto shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-extrabold text-slate-500 dark:border-white/10 dark:text-slate-400">
          {total} total
        </span>
      </header>

      <ul className="grid gap-1.5 p-3 sm:grid-cols-2 xl:grid-cols-3">
        {STATUSES.map((status) => {
          const count = counts.get(status.key) ?? 0;
          const StageIcon = STATUS_ICONS[status.key] ?? Workflow;
          const pct = (count / max) * 100;
          return (
            <li key={status.key}>
              <Link
                href={`/pesanan?status=${status.key}`}
                className={`group flex items-center gap-2.5 rounded-xl border px-2.5 py-2.5 transition-all hover:-translate-y-0.5 ${
                  count > 0
                    ? "border-slate-200/80 bg-white/70 hover:border-teal-300 dark:border-white/10 dark:bg-white/[0.04]"
                    : "border-transparent bg-slate-50/60 opacity-70 hover:opacity-100 dark:bg-white/[0.02]"
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${status.dot}`}>
                  <StageIcon size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11.5px] font-extrabold text-slate-700 group-hover:text-teal-700 dark:text-slate-200 dark:group-hover:text-teal-300">
                      {status.short}
                    </span>
                    <span className="pf-num shrink-0 text-sm font-black text-[#07384f] dark:text-slate-100">{count}</span>
                  </span>
                  <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    <span
                      className={`block h-full rounded-full ${status.bar} transition-all duration-500`}
                      style={{ width: `${Math.min(100, Math.max(count > 0 ? 8 : 0, pct))}%` }}
                    />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ============================================================
   2. DONUT RISIKO
   Revisi: total di tengah donat, segmen lebih tebal & bercelah,
   legenda jadi baris yang bisa dibaca cepat + persentase.
   ============================================================ */
export function RiskDonut({
  aman,
  waspada,
  terlambat,
}: {
  aman: number;
  waspada: number;
  terlambat: number;
}) {
  const total = aman + waspada + terlambat;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { key: "aman", label: "Aman", value: aman, ring: "#10b981", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
    { key: "waspada", label: "Waspada", value: waspada, ring: "#f59e0b", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
    { key: "terlambat", label: "Terlambat", value: terlambat, ring: "#f43f5e", dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
  ];
  const visible = segments.filter((s) => s.value > 0);
  let drawn = 0;

  return (
    <section className="pf-card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/10">
        <span className="icon-tile">
          <PieChart size={17} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-[#07384f] dark:text-slate-100">Distribusi risiko</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {total > 0 ? `Dari ${total} pekerjaan aktif` : "Belum ada pekerjaan aktif"}
          </p>
        </div>
      </header>

      {total === 0 ? (
        <p className="px-4 py-6 text-xs text-slate-400 dark:text-slate-500">
          Grafik akan muncul begitu ada pekerjaan berjalan.
        </p>
      ) : (
        <div className="flex items-center gap-4 p-4">
          <div className="relative h-28 w-28 shrink-0">
            <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90" role="img" aria-label="Distribusi risiko pekerjaan aktif">
              <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="13" className="stroke-slate-100 dark:stroke-white/10" />
              {visible.map((seg) => {
                const length = (seg.value / total) * circumference;
                const gap = visible.length > 1 ? 2 : 0;
                const offset = -drawn;
                drawn += length;
                return (
                  <circle
                    key={seg.key}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={seg.ring}
                    strokeWidth="13"
                    strokeDasharray={`${Math.max(0, length - gap)} ${circumference - Math.max(0, length - gap)}`}
                    strokeDashoffset={offset}
                    strokeLinecap={visible.length > 1 ? "butt" : "round"}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="pf-donut-total text-xl font-black text-[#07384f] dark:text-slate-100">{total}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">aktif</span>
            </div>
          </div>

          <ul className="flex-1 space-y-2">
            {segments.map((seg) => (
              <li key={seg.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${seg.dot}`} /> {seg.label}
                </span>
                <span className={`pf-num font-extrabold ${seg.text}`}>
                  {seg.value}
                  <span className="ml-1 font-medium text-slate-400 dark:text-slate-500">
                    {Math.round((seg.value / total) * 100)}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ============================================================
   3. DEADLINE HARI INI
   Revisi: baris jadi kartu kecil dengan jam besar di kiri.
   ============================================================ */
export function DueTodayPanel({
  orders,
}: {
  orders: { id: number; code: string; title: string; status: string; dueTime: string; customerName: string }[];
}) {
  if (!orders.length) return null;
  return (
    <section className="pf-card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-amber-50/70 to-transparent px-4 py-3 dark:border-white/10 dark:from-amber-400/10">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300">
          <CalendarClock size={17} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-[#07384f] dark:text-slate-100">Deadline hari ini</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{orders.length} pekerjaan jatuh tempo</p>
        </div>
      </header>
      <ul className="grid gap-1.5 p-3 md:grid-cols-2">
        {orders.map((o) => {
          const meta = statusMeta(o.status);
          return (
            <li key={o.id}>
              <Link
                href={`/pesanan/${o.id}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:border-amber-300 dark:border-white/10 dark:bg-white/[0.04]"
              >
                <span className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-[#07384f] px-1 py-1.5 text-white dark:bg-white/10">
                  <span className="pf-num text-sm font-black leading-none">{o.dueTime}</span>
                  <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-300">wib</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-extrabold text-slate-700 dark:text-slate-100">
                    {o.code} — {o.title}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{o.customerName}</span>
                </span>
                <span className={`chip shrink-0 ${meta.badge}`}>{meta.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ============================================================
   4. PANEL "CARA KERJA MONITORING AI"
   Revisi: langkah jadi timeline bergaris, skala risiko jadi
   baris berwarna yang lebih mudah dibaca.
   ============================================================ */
export function HowItWorksPanel() {
  const steps: [string, string][] = [
    ["Masukkan pekerjaan", "Isi pelanggan, jenis cetak, jumlah, deadline, dan harga."],
    ["Update setiap tahap", "Antrian → desain → cetak → finishing → QC → siap."],
    ["AI menghitung risiko", "Sisa pekerjaan dibandingkan dengan sisa waktu."],
    ["Anda fokus memutuskan", "Kerjakan yang paling berisiko dan kabari pelanggan."],
  ];
  const scale: [string, string, string][] = [
    ["0–34", "Aman", "bg-emerald-500"],
    ["35–64", "Waspada", "bg-amber-500"],
    ["65–89", "Berisiko", "bg-orange-500"],
    ["90–100", "Terlambat", "bg-rose-500"],
  ];
  return (
    <section className="pf-card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/10">
        <span className="icon-tile">
          <Sparkles size={17} />
        </span>
        <div>
          <h3 className="text-sm font-extrabold text-[#07384f] dark:text-slate-100">Cara kerja monitoring AI</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Empat langkah sederhana</p>
        </div>
      </header>

      <ol className="space-y-0 p-4">
        {steps.map(([title, desc], i) => (
          <li key={title} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 ? (
              <span className="absolute left-[11px] top-6 h-full w-px bg-gradient-to-b from-teal-300 to-transparent dark:from-teal-500/40" />
            ) : null}
            <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-[11px] font-black text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
              {i + 1}
            </span>
            <span className="min-w-0 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <strong className="text-slate-800 dark:text-slate-100">{title}.</strong> {desc}
            </span>
          </li>
        ))}
      </ol>

      <div className="mx-4 mb-4 rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]">
        <p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-500 dark:text-slate-400">
          Skala skor risiko
        </p>
        <ul className="mt-2 space-y-1.5">
          {scale.map(([range, label, color]) => (
            <li key={range} className="flex items-center gap-2 text-[11px]">
              <span className={`h-1.5 w-6 shrink-0 rounded-full ${color}`} />
              <span className="font-extrabold text-slate-600 dark:text-slate-300">{range}</span>
              <span className="text-slate-400 dark:text-slate-500">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Judul seksi kecil yang dipakai berulang di dashboard. */
export function SectionHead({
  icon,
  title,
  subtitle,
  href,
  hrefLabel = "Lihat semua",
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#07384f] to-teal-700 text-amber-300 shadow-[0_6px_16px_rgba(7,56,79,.25)]">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold tracking-tight text-[#07384f] dark:text-slate-100 md:text-lg">
            {title}
          </h2>
          {subtitle ? <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
        </div>
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-teal-200 bg-white/70 px-3 py-1.5 text-[11px] font-extrabold text-teal-700 transition-colors hover:bg-teal-50 dark:border-teal-500/25 dark:bg-white/5 dark:text-teal-300 dark:hover:bg-teal-500/10"
        >
          {hrefLabel} <ChevronRight size={13} />
        </Link>
      ) : null}
    </div>
  );
}
