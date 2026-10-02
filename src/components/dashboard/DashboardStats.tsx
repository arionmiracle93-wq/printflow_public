import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";

type Accent = "teal" | "amber" | "rose" | "sky" | "slate";

const ACCENTS: Record<Accent, { tile: string; value: string; rail: string }> = {
  teal: {
    tile: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    value: "text-[#07384f] dark:text-slate-100",
    rail: "from-teal-400/80 to-teal-500/0",
  },
  amber: {
    tile: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    value: "text-amber-600 dark:text-amber-300",
    rail: "from-amber-400/80 to-amber-400/0",
  },
  rose: {
    tile: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
    value: "text-rose-600 dark:text-rose-300",
    rail: "from-rose-400/80 to-rose-400/0",
  },
  sky: {
    tile: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
    value: "text-sky-700 dark:text-sky-300",
    rail: "from-sky-400/80 to-sky-400/0",
  },
  slate: {
    tile: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
    value: "text-slate-700 dark:text-slate-200",
    rail: "from-slate-300/80 to-slate-300/0",
  },
};

/**
 * KARTU KPI (revisi UI)
 * - Bisa diklik (menuju daftar pekerjaan yang relevan) → dashboard jadi navigasi,
 *   bukan cuma pajangan angka.
 * - Rel warna vertikal + ikon kotak = mudah dibedakan sekilas.
 * - Sudah rapi di mode gelap (versi lama masih pakai warna terang saja).
 */
export function StatTile({
  label,
  value,
  hint,
  icon,
  accent = "teal",
  href,
  delay = 0,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  accent?: Accent;
  href?: string;
  delay?: number;
}) {
  const a = ACCENTS[accent];
  const inner = (
    <>
      <span
        className={`pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${a.rail}`}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl md:h-9 md:w-9 ${a.tile}`}>{icon}</div>
        {href ? (
          <ArrowRight
            size={14}
            className="mt-1 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-500 dark:text-slate-600"
          />
        ) : null}
      </div>
      <p className="mt-2.5 text-[9.5px] font-extrabold uppercase tracking-[.1em] text-slate-500 dark:text-slate-400 md:text-[10px]">
        {label}
      </p>
      <p className={`pf-num mt-0.5 text-lg font-black leading-tight md:text-[1.45rem] ${a.value}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">{hint}</p> : null}
    </>
  );

  const cls =
    "pf-card pf-card-accent pf-rise group relative block overflow-hidden p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(15,75,84,.12)] md:p-4";

  return href ? (
    <Link href={href} className={cls} style={{ "--pf-delay": `${delay}ms` } as CSSProperties}>
      {inner}
    </Link>
  ) : (
    <div className={cls} style={{ "--pf-delay": `${delay}ms` } as CSSProperties}>
      {inner}
    </div>
  );
}

/**
 * PANEL "FOKUS HARI INI" (revisi UI)
 * Dulu: daftar bullet kecil abu-abu yang gampang terlewat.
 * Sekarang: kartu bernomor dengan aksen amber, lebih mengundang dibaca,
 * dan tetap memakai data yang sama (insight.actions).
 */
export function FocusActions({ actions }: { actions: string[] }) {
  if (!actions.length) return null;
  return (
    <section className="pf-card pf-rise overflow-hidden" style={{ "--pf-delay": "60ms" } as CSSProperties}>
      <div className="flex items-center gap-2.5 border-b border-slate-100 bg-gradient-to-r from-amber-50/80 to-transparent px-4 py-3 dark:border-white/10 dark:from-amber-400/10">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300">
          <Lightbulb size={17} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold text-[#07384f] dark:text-slate-100">Fokus &amp; tindakan hari ini</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Disusun otomatis dari analisa risiko AI</p>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-[#07384f] px-2 py-0.5 text-[10px] font-extrabold text-amber-300 dark:bg-white/10">
          {actions.length}
        </span>
      </div>
      <ol className="grid gap-1.5 p-3 sm:grid-cols-2">
        {actions.map((a, i) => (
          <li
            key={a}
            className="flex items-start gap-2.5 rounded-xl border border-transparent bg-slate-50/70 px-3 py-2.5 text-xs font-medium leading-relaxed text-slate-600 transition-colors hover:border-amber-200 hover:bg-amber-50/60 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-amber-400/20 dark:hover:bg-amber-400/[0.07]"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-400/90 text-[10px] font-black text-[#07384f]">
              {i + 1}
            </span>
            <span className="min-w-0">{a}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
