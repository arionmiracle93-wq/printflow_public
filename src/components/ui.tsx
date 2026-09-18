import type { ReactNode } from "react";
import {
  AlarmClock,
  ArrowUpRight,
  Building2,
  Camera,
  Flag,
  Hourglass,
  Lightbulb,
  Package,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { RISK_META, type OrderInsight, type RiskLevel } from "@/lib/ai";
import { STATUSES, formatDateID, humanDuration, priorityMeta, statusMeta } from "@/lib/domain";
import { CopyMessageQuick } from "@/components/CopyMessageQuick";
import { PhotoQuickPeek } from "@/components/PhotoQuickPeek";
import { QuickStatusPopup } from "@/components/QuickStatusPopup";
import { ShareWhatsAppQuick } from "@/components/ShareWhatsAppQuick";

/* ------------------------------------------------------------------ *
 * Badge status / prioritas / risiko
 * ------------------------------------------------------------------ */

export function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span className={`chip ${meta.badge} !gap-1.5 !px-2.5`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
      {meta.short}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const meta = priorityMeta(priority);
  const urgent = priority === "urgent";
  return (
    <span className={`chip ${meta.badge} !gap-1 ${urgent ? "animate-none" : ""}`}>
      <Flag size={10} className="shrink-0" />
      {meta.label}
    </span>
  );
}

export function RiskBadge({ level, score }: { level: RiskLevel; score?: number }) {
  const meta = RISK_META[level];
  return (
    <span className={`chip ${meta.badge} !gap-1.5`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
      {typeof score === "number" ? (
        <span className="money opacity-60">· {Math.round(score)}</span>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Progres
 * ------------------------------------------------------------------ */

export function ProgressBar({ value, tone = "bg-teal-500" }: { value: number; tone?: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="progress-track" role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`h-full rounded-full ${tone} transition-all duration-500`}
        style={{ width: `${clamped}%`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}
      />
    </div>
  );
}

/**
 * Penanda tahap produksi: 7 titik (Antrian → Selesai) dengan tahap yang sudah
 * dilewati ikutTerisi. Diganti dari sekadar bar angka menjadi bar bertahap
 * supaya operator yang cuma sekilas melihat tetap tahu pekerjaan berhenti di
 * tahap mana.
 */
export function StageRail({ status }: { status: string }) {
  const activeIndex = STATUSES.findIndex((s) => s.key === status);
  const meta = statusMeta(status);
  const stalled = status === "ditunda" || status === "batal";
  const track = STATUSES.filter((s) => s.key !== "ditunda" && s.key !== "batal");
  const currentIndex = track.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 items-center gap-1" aria-hidden="true">
        {track.map((stage, index) => {
          const filled = !stalled && currentIndex >= index;
          return (
            <span
              key={stage.key}
              title={`${stage.emoji} ${stage.label}`}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                filled ? stage.bar : "bg-slate-200/80 dark:bg-white/10"
              } ${currentIndex === index ? "scale-y-[1.6]" : ""}`}
            />
          );
        })}
      </div>
      <span className={`shrink-0 whitespace-nowrap text-[10px] font-extrabold ${stalled ? "text-orange-600 dark:text-orange-300" : "text-slate-500"}`}>
        {stalled ? meta.short : `${Math.max(0, currentIndex) + 1}/${track.length} · ${meta.short}`}
      </span>
      {activeIndex === -1 ? <span className="sr-only">Status tidak dikenal</span> : null}
    </div>
  );
}

/** Kartu kecil sisa waktu / keterlambatan deadline. */
export function DeadlineChip({
  dueDate,
  hoursLeft,
  dueTime,
}: {
  dueDate: string;
  hoursLeft: number;
  dueTime?: string;
}) {
  const late = hoursLeft < 0;
  const soon = !late && hoursLeft <= 8;
  const tone = late
    ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/12 dark:text-rose-200"
    : soon
      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/35 dark:bg-amber-400/12 dark:text-amber-200"
      : "border-teal-200/80 bg-teal-50/70 text-teal-800 dark:border-teal-400/25 dark:bg-teal-500/10 dark:text-teal-200";
  const Icon = late ? AlarmClock : Hourglass;
  return (
    <span className={`inline-flex items-start gap-1.5 rounded-xl border px-2 py-1 ${tone}`}>
      <Icon size={13} className="mt-0.5 shrink-0" />
      <span className="leading-tight">
        <span className="block text-[11px] font-extrabold">
          {formatDateID(dueDate)}
          {dueTime ? ` · ${dueTime}` : ""}
        </span>
        <span className="block text-[10px] font-bold opacity-80">
          {late ? `Telat ${humanDuration(hoursLeft)}` : `Sisa ${humanDuration(hoursLeft)}`}
        </span>
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Kartu KPI dashboard
 * ------------------------------------------------------------------ */

export function KpiCard({
  label,
  value,
  hint,
  tone = "text-[#07384f]",
  icon,
  accent = "teal",
  trailing,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  icon?: ReactNode;
  accent?: "teal" | "yellow" | "rose" | "blue";
  /** Elemen tambahan di kanan bawah (mis. tautan "Lihat"). */
  trailing?: ReactNode;
}) {
  const tiles = {
    teal: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    yellow: "bg-amber-50 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
    blue: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  };
  const rail = {
    teal: "from-teal-400 to-emerald-400",
    yellow: "from-amber-300 to-orange-400",
    rose: "from-rose-400 to-red-500",
    blue: "from-sky-400 to-cyan-400",
  };
  return (
    <div className="card card-hover group relative overflow-hidden !p-3 md:!p-4">
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${rail[accent]} opacity-80 transition-opacity duration-300 group-hover:opacity-100`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-gradient-to-br ${rail[accent]} opacity-[.07] blur-2xl transition-opacity duration-300 group-hover:opacity-[.14]`}
      />
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg shadow-sm ring-1 ring-inset ring-black/[.03] md:h-9 md:w-9 md:rounded-xl ${tiles[accent]}`}>
          {icon}
        </span>
        {trailing ? <span className="shrink-0">{trailing}</span> : null}
      </div>
      <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[.09em] text-slate-500 md:mt-3">{label}</p>
      <p className={`money mt-0.5 text-lg font-black leading-none tracking-tight md:text-[1.7rem] ${tone}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] font-medium text-slate-400">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Kartu pekerjaan (dipakai di dashboard)
 * ------------------------------------------------------------------ */

const GBTN = "gbtn";

export function InsightCard({
  insight,
  photoCount = 0,
  outsource,
  dueDate,
  dueTime,
}: {
  insight: OrderInsight;
  photoCount?: number;
  outsource?: { status: string; partnerName: string };
  dueDate: string;
  dueTime: string;
}) {
  const meta = statusMeta(insight.status);
  // Dipakai bersama oleh tombol "Kirim WA" dan "Salin teks pesan" agar isi pesannya identik.
  // `items` ikut dibawa supaya pesan memuat seluruh produk dalam pekerjaan ini.
  const shareOrder = {
    id: insight.orderId,
    code: insight.code,
    title: insight.title,
    customerName: insight.customerName,
    status: insight.status,
    dueDate,
    dueTime,
    items: insight.items,
  };
  const noPic = !insight.operator;

  return (
    <article className="card card-hover group relative overflow-hidden !p-0">
      {/* rel kiri: warna = status, jadi tahap kerja terbaca dari kejauhan */}
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${meta.bar}`} />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full opacity-[0.07] transition-transform duration-500 group-hover:scale-125 ${meta.dot}`}
      />

      <div className="pl-[1.15rem] pr-3.5 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="money text-[11px] font-black tracking-wide text-teal-700 dark:text-teal-300">
                {insight.code}
              </span>
              <PhotoQuickPeek orderId={insight.orderId} code={insight.code} count={photoCount} />
              {outsource ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-extrabold text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                  <Building2 size={9} /> {outsource.partnerName}
                </span>
              ) : null}
            </p>
            <h3 className="mt-1 line-clamp-2 text-[15px] font-black leading-snug tracking-tight text-[#07384f] dark:text-slate-100">
              {insight.title}
            </h3>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{insight.customerName}</p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <QuickStatusPopup
              orderId={insight.orderId}
              orderCode={insight.code}
              orderTitle={insight.title}
              currentStatus={insight.status}
              hasOutsource={Boolean(outsource)}
              trigger={
                <span className="flex cursor-pointer flex-col items-end gap-1 rounded-xl transition group-hover:-translate-y-px">
                  <StatusBadge status={insight.status} />
                  <RiskBadge level={insight.riskLevel} score={insight.riskScore} />
                </span>
              }
            />
          </div>
        </div>

        {/* Meta penting dalam satu baris agar kartu tetap ringkas */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
          <span className="inline-flex min-w-0 items-center gap-1 text-slate-500">
            <Package size={12} className="shrink-0 text-slate-400" />
            <span className="truncate">{insight.itemsSummary}</span>
            {insight.items.length > 1 ? (
              <span className="shrink-0 rounded-full bg-teal-50 px-1.5 py-px text-[10px] font-extrabold text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                {insight.items.length}
              </span>
            ) : null}
          </span>
          <span className={`inline-flex items-center gap-1 font-bold ${noPic ? "text-amber-600 dark:text-amber-300" : "text-teal-700 dark:text-teal-300"}`}>
            <UserRound size={12} /> {insight.operator || "PIC belum diisi"}
          </span>
          {photoCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Camera size={12} /> {photoCount}
            </span>
          ) : null}
        </div>

        <p className="mt-2.5 text-[13px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
          {insight.headline}
        </p>

        <div className="mt-2.5">
          <StageRail status={insight.status} />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <DeadlineChip dueDate={dueDate} dueTime={dueTime} hoursLeft={insight.hoursLeft} />
          <span className="money text-[11px] font-bold text-slate-400">{insight.progress}%</span>
        </div>

        {insight.reasons[0] ? (
          <ul className="mt-2.5 space-y-1 border-l-2 border-teal-200/80 pl-2.5 text-[11px] leading-relaxed text-slate-500 dark:border-teal-500/30">
            {insight.reasons.slice(0, 2).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}

        {insight.recommendations[0] ? (
          <p className="mt-2.5 flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-2.5 py-2 text-[11px] font-semibold leading-snug text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
            <Lightbulb size={13} className="mt-px shrink-0 text-amber-500 dark:text-amber-300" />
            <span>{insight.recommendations[0]}</span>
          </p>
        ) : null}
      </div>

      {/* Aksi: satu baris, tiap tombol punya warna sendiri supaya tidak perlu dibaca dulu */}
      <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-slate-100 bg-slate-50/60 p-2 sm:grid-cols-4 dark:border-white/[0.07] dark:bg-white/[0.03]">
        <a href={`/pesanan/${insight.orderId}`} className={`${GBTN} gbtn-sky`} onClick={(e) => e.stopPropagation()}>
          Detail <ArrowUpRight size={13} />
        </a>
        <QuickStatusPopup
          orderId={insight.orderId}
          orderCode={insight.code}
          orderTitle={insight.title}
          currentStatus={insight.status}
          hasOutsource={Boolean(outsource)}
          trigger={
            <span className={`${GBTN} gbtn-teal`}>
              <RefreshCw size={13} /> Status
            </span>
          }
        />
        <ShareWhatsAppQuick order={shareOrder} className={`${GBTN} gbtn-green`} />
        <CopyMessageQuick order={shareOrder} className={`${GBTN} gbtn-amber`} />
      </div>
    </article>
  );
}

export function SafeIcon() {
  return <ShieldCheck size={18} />;
}

/** Ikon kecil untuk header bagian halaman. */
export function SectionIcon({ children }: { children: ReactNode }) {
  return <span className="icon-tile">{children}</span>;
}
