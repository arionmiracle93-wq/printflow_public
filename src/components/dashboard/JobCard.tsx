import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  Package,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { RISK_META, type OrderInsight } from "@/lib/ai";
import { humanDuration, statusMeta } from "@/lib/domain";
import { CopyMessageQuick } from "@/components/CopyMessageQuick";
import { PhotoQuickPeek } from "@/components/PhotoQuickPeek";
import { QuickStatusPopup } from "@/components/QuickStatusPopup";
import { ShareWhatsAppQuick } from "@/components/ShareWhatsAppQuick";
import { STATUS_ICONS } from "@/components/ui";

const STAGE_FLOW = ["antrian", "desain", "cetak", "finishing", "qc", "siap"] as const;
const STAGE_SHORT: Record<string, string> = {
  antrian: "Antri",
  desain: "Desain",
  cetak: "Cetak",
  finishing: "Finish",
  qc: "QC",
  siap: "Siap",
};

/** Strip 6 tahap + label kecil di bawah tiap strip (revisi: sekarang ada namanya). */
function StageStrips({ status, label }: { status: string; label: string }) {
  const idx = STAGE_FLOW.indexOf(status as (typeof STAGE_FLOW)[number]);
  const allDone = status === "selesai";
  return (
    <div className="mt-3" role="img" aria-label={`Tahap produksi: ${label}`}>
      <div className="flex items-center gap-1.5">
        {STAGE_FLOW.map((key, i) => {
          const done = allDone || (idx !== -1 && i < idx);
          const now = idx !== -1 && i === idx;
          return (
            <span
              key={key}
              className={`pf-stage ${done ? "pf-stage-done" : now ? "pf-stage-now" : ""}`}
            />
          );
        })}
      </div>
      <div className="mt-1.5 hidden justify-between sm:flex">
        {STAGE_FLOW.map((key, i) => {
          const done = allDone || (idx !== -1 && i < idx);
          const now = idx !== -1 && i === idx;
          return (
            <span
              key={key}
              className={`flex-1 text-center text-[9px] font-bold uppercase tracking-wide ${
                now
                  ? "text-amber-600 dark:text-amber-300"
                  : done
                    ? "text-teal-600 dark:text-teal-300"
                    : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {STAGE_SHORT[key]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Info sisa waktu — ringkas & berwarna sesuai urgensi. */
function TimeLeft({ hoursLeft, status }: { hoursLeft: number; status: string }) {
  const parked = status === "siap" || status === "selesai" || status === "batal";
  if (parked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-extrabold text-teal-700 dark:border-teal-500/25 dark:bg-teal-500/10 dark:text-teal-300">
        <CalendarClock size={11} /> Tidak dihitung telat
      </span>
    );
  }
  const late = hoursLeft < 0;
  const tight = !late && hoursLeft <= 8;
  const cls = late
    ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300"
    : tight
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300"
      : "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${cls}`}>
      <CalendarClock size={11} />
      {late ? `Telat ${humanDuration(hoursLeft)}` : `Sisa ${humanDuration(hoursLeft)}`}
    </span>
  );
}

/**
 * KARTU PEKERJAAN DASHBOARD (revisi UI)
 * --------------------------------------------------------------
 *  1. Nomor prioritas (#1, #2, ...) supaya urutan kerja AI jelas.
 *  2. Header dua baris: kode + skor risiko di kanan, judul besar di bawah.
 *  3. Baris meta jadi "chip" rapi: produk, PIC, mitra, sisa waktu.
 *  4. Strip tahap kini ada label nama tahap (Antri…Siap).
 *  5. Tombol aksi: "Buka detail" jadi tombol utama (teal),
 *     tiga lainnya netral — semuanya sudah rapi di mode gelap.
 *
 * Fungsional TIDAK berubah: tetap memakai QuickStatusPopup,
 * ShareWhatsAppQuick, CopyMessageQuick, dan PhotoQuickPeek yang sama.
 */
export function JobCard({
  insight,
  rank,
  photoCount = 0,
  outsource,
  dueDate,
  dueTime,
}: {
  insight: OrderInsight;
  rank?: number;
  photoCount?: number;
  outsource?: { status: string; partnerName: string };
  dueDate: string;
  dueTime: string;
}) {
  const meta = statusMeta(insight.status);
  const risk = RISK_META[insight.riskLevel];
  const StatusIcon = STATUS_ICONS[insight.status] ?? UserRound;
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

  return (
    <article className="pf-card pf-card-accent group h-full overflow-hidden p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(15,75,84,.13)] md:p-4.5">
      {/* rel warna status di sisi kiri */}
      <div className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${meta.bar}`} />

      {/* ---------- Header ---------- */}
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="flex min-w-0 items-center gap-2">
          {rank ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#07384f] text-[11px] font-black text-amber-300 dark:bg-white/10">
              {rank}
            </span>
          ) : null}
          <span className="text-[13px] font-extrabold tracking-wide text-teal-700 dark:text-teal-300">
            {insight.code}
          </span>
          <PhotoQuickPeek orderId={insight.orderId} code={insight.code} count={photoCount} />
        </div>

        <QuickStatusPopup
          orderId={insight.orderId}
          orderCode={insight.code}
          orderTitle={insight.title}
          currentStatus={insight.status}
          hasOutsource={Boolean(outsource)}
          trigger={
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${meta.badge}`}
              >
                <StatusIcon size={12} /> {meta.short}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${risk.badge}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {risk.label}
                <span className="opacity-60">· {Math.round(insight.riskScore)}</span>
              </span>
            </span>
          }
        />
      </div>

      {/* ---------- Judul & pelanggan ---------- */}
      <div className="mt-2 pl-2">
        <h3
          className="line-clamp-2 break-words text-[15px] font-black leading-snug text-[#07384f] dark:text-slate-100 sm:text-base"
          title={insight.title}
        >
          {insight.title}
        </h3>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <UserRound size={12} className="shrink-0" /> {insight.customerName}
        </p>
      </div>

      {/* ---------- Chip meta ---------- */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-2">
        <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <Package size={11} className="shrink-0" />
          <span className="truncate">{insight.itemsSummary}</span>
          {insight.items.length > 1 ? (
            <span className="shrink-0 rounded-full bg-teal-100 px-1 text-[9px] font-extrabold text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
              {insight.items.length}
            </span>
          ) : null}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${
            insight.operator
              ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300"
              : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300"
          }`}
        >
          <UserRound size={11} /> PIC: {insight.operator || "Belum ada"}
        </span>
        <TimeLeft hoursLeft={insight.hoursLeft} status={insight.status} />
        {outsource ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
            <Building2 size={11} /> Mitra: {outsource.partnerName}
          </span>
        ) : null}
      </div>

      {/* ---------- Tahap produksi ---------- */}
      <div className="pl-2">
        <StageStrips status={insight.status} label={meta.label} />
      </div>

      {/* ---------- Aksi cepat ---------- */}
      <div className="mt-3.5 grid grid-cols-2 gap-2 pl-2">
        <a href={`/pesanan/${insight.orderId}`} className="pf-action pf-action-primary">
          Buka detail <ArrowUpRight size={14} />
        </a>
        <QuickStatusPopup
          orderId={insight.orderId}
          orderCode={insight.code}
          orderTitle={insight.title}
          currentStatus={insight.status}
          hasOutsource={Boolean(outsource)}
          trigger={
            <span className="pf-action">
              Update status <RefreshCw size={14} />
            </span>
          }
        />
        <ShareWhatsAppQuick order={shareOrder} className="pf-action" />
        <CopyMessageQuick order={shareOrder} className="pf-action" />
      </div>
    </article>
  );
}
