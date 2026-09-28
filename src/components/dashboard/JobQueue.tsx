import Link from "next/link";
import { ChevronRight, RefreshCw, Users } from "lucide-react";
import { RISK_META, type OrderInsight } from "@/lib/ai";
import { humanDuration, statusMeta } from "@/lib/domain";
import { CopyMessageQuick } from "@/components/CopyMessageQuick";
import { PhotoQuickPeek } from "@/components/PhotoQuickPeek";
import { QuickStatusPopup } from "@/components/QuickStatusPopup";
import { ShareWhatsAppQuick } from "@/components/ShareWhatsAppQuick";

const FLOW = ["antrian", "desain", "cetak", "finishing", "qc", "siap"] as const;

type Outsource = { status: string; partnerName: string } | undefined;

function shareOrderOf(insight: OrderInsight, dueDate: string, dueTime: string) {
  return {
    id: insight.orderId,
    code: insight.code,
    title: insight.title,
    customerName: insight.customerName,
    status: insight.status,
    dueDate,
    dueTime,
    items: insight.items,
  };
}

/** Enam ruas tahap. Tidak memakai track berlatar penuh, hanya ruas tipis. */
function Steps({ status }: { status: string }) {
  const idx = FLOW.indexOf(status as (typeof FLOW)[number]);
  const all = status === "selesai";
  return (
    <span className="pf-steps" aria-hidden>
      {FLOW.map((key, i) => (
        <span
          key={key}
          className={`pf-step ${all || (idx !== -1 && i < idx) ? "pf-step-done" : idx !== -1 && i === idx ? "pf-step-now" : ""}`}
        />
      ))}
    </span>
  );
}

/** Sisa waktu. Warna hanya dipakai kalau kondisinya menyimpang. */
function Deadline({ hoursLeft, status }: { hoursLeft: number; status: string }) {
  if (status === "siap" || status === "selesai" || status === "batal") {
    return <span className="pf-num text-xs text-[color:var(--pf-ink-3)]">tidak dihitung</span>;
  }
  const late = hoursLeft < 0;
  const tight = !late && hoursLeft <= 8;
  return (
    <span
      className={`pf-num text-xs font-semibold ${
        late
          ? "text-[color:var(--pf-danger)]"
          : tight
            ? "text-[color:var(--pf-warn)]"
            : "text-[color:var(--pf-ink-2)]"
      }`}
    >
      {late ? `telat ${humanDuration(hoursLeft)}` : `sisa ${humanDuration(hoursLeft)}`}
    </span>
  );
}

function riskTone(level: string) {
  if (level === "terlambat") return "text-[color:var(--pf-danger)] bg-[color:var(--pf-danger-soft)]";
  if (level === "risiko") return "text-[color:var(--pf-warn)] bg-[color:var(--pf-warn-soft)]";
  if (level === "waspada") return "text-[color:var(--pf-warn)] bg-[color:var(--pf-warn-soft)]";
  return "text-[color:var(--pf-ok)] bg-[color:var(--pf-ok-soft)]";
}

/* =================================================================
   BARIS DATA (layar lebar)
   Versi sebelumnya memakai kartu tebal dua kolom, sehingga hanya
   empat pekerjaan terlihat sekaligus. Dengan baris data, delapan
   sampai sepuluh pekerjaan bisa dipindai sekali lihat, yang memang
   tugas utama layar ini.
   ================================================================= */
function JobRow({
  insight,
  rank,
  photoCount,
  outsource,
  dueDate,
  dueTime,
}: {
  insight: OrderInsight;
  rank: number;
  photoCount: number;
  outsource: Outsource;
  dueDate: string;
  dueTime: string;
}) {
  const meta = statusMeta(insight.status);
  const risk = RISK_META[insight.riskLevel];
  const order = shareOrderOf(insight, dueDate, dueTime);

  return (
    <div className="pf-row">
      <span className="pf-num text-xs font-semibold text-[color:var(--pf-ink-3)]">{rank}</span>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/pesanan/${insight.orderId}`}
            className="truncate text-[13px] font-semibold text-[color:var(--pf-ink)] hover:text-[color:var(--pf-accent-strong)] hover:underline"
          >
            {insight.title}
          </Link>
          <PhotoQuickPeek orderId={insight.orderId} code={insight.code} count={photoCount} />
        </div>
        <p className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-[color:var(--pf-ink-3)]">
          <span className="pf-mono shrink-0 text-[color:var(--pf-accent-strong)]">{insight.code}</span>
          <span className="truncate">{insight.customerName}</span>
          {outsource ? (
            <span className="pf-tag pf-tag-warn shrink-0">{outsource.partnerName}</span>
          ) : null}
        </p>
      </div>

      <div className="min-w-0">
        <Steps status={insight.status} />
        <p className="mt-1 truncate text-[11px] text-[color:var(--pf-ink-2)]">{meta.short}</p>
      </div>

      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1 text-[11px] text-[color:var(--pf-ink-2)]">
          <Users size={12} className="shrink-0 text-[color:var(--pf-ink-3)]" />
          <span className="truncate">{insight.operator || "belum ada PIC"}</span>
        </p>
        <div className="mt-0.5">
          <Deadline hoursLeft={insight.hoursLeft} status={insight.status} />
        </div>
      </div>

      <div
        className={`pf-num rounded-[10px] px-1.5 py-1 text-center text-[13px] font-semibold ${riskTone(insight.riskLevel)}`}
        title={`Risiko ${risk.label}`}
      >
        {Math.round(insight.riskScore)}
      </div>

      <div className="flex items-center justify-end gap-1">
        <QuickStatusPopup
          orderId={insight.orderId}
          orderCode={insight.code}
          orderTitle={insight.title}
          currentStatus={insight.status}
          hasOutsource={Boolean(outsource)}
          trigger={
            <span className="pf-act" title="Ubah status">
              <RefreshCw size={14} />
            </span>
          }
        />
        <ShareWhatsAppQuick order={order} className="pf-act" />
        <CopyMessageQuick order={order} className="pf-act" />
        <Link href={`/pesanan/${insight.orderId}`} className="pf-act" title="Buka detail">
          <ChevronRight size={15} />
        </Link>
      </div>
    </div>
  );
}

/* =================================================================
   KARTU (ponsel)
   ================================================================= */
function JobCardMobile({
  insight,
  rank,
  photoCount,
  outsource,
  dueDate,
  dueTime,
}: {
  insight: OrderInsight;
  rank: number;
  photoCount: number;
  outsource: Outsource;
  dueDate: string;
  dueTime: string;
}) {
  const meta = statusMeta(insight.status);
  const order = shareOrderOf(insight, dueDate, dueTime);

  return (
    <article className="pf-surface flex h-full flex-col p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2">
          <span className="pf-num text-[11px] font-semibold text-[color:var(--pf-ink-3)]">{rank}</span>
          <span className="pf-mono truncate text-xs text-[color:var(--pf-accent-strong)]">{insight.code}</span>
          <PhotoQuickPeek orderId={insight.orderId} code={insight.code} count={photoCount} />
        </p>
        <span
          className={`pf-num shrink-0 rounded-[10px] px-2 py-1 text-xs font-semibold ${riskTone(insight.riskLevel)}`}
        >
          {Math.round(insight.riskScore)}
        </span>
      </div>

      <Link
        href={`/pesanan/${insight.orderId}`}
        className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[color:var(--pf-ink)]"
      >
        {insight.title}
      </Link>
      <p className="mt-0.5 truncate text-xs text-[color:var(--pf-ink-3)]">{insight.customerName}</p>

      <div className="mt-2.5 flex items-center gap-2">
        <Steps status={insight.status} />
        <span className="truncate text-[11px] font-medium text-[color:var(--pf-ink-2)]">{meta.short}</span>
        <span className="ml-auto shrink-0">
          <Deadline hoursLeft={insight.hoursLeft} status={insight.status} />
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="pf-tag">
          <Users size={11} /> {insight.operator || "belum ada PIC"}
        </span>
        {outsource ? <span className="pf-tag pf-tag-warn">{outsource.partnerName}</span> : null}
      </div>

      <div className="pf-act-grid mt-3 border-t border-[color:var(--pf-line-soft)] pt-3">
        <QuickStatusPopup
          orderId={insight.orderId}
          orderCode={insight.code}
          orderTitle={insight.title}
          currentStatus={insight.status}
          hasOutsource={Boolean(outsource)}
          trigger={
            <span className="pf-act-wide">
              Ubah status <RefreshCw size={13} />
            </span>
          }
        />
        <ShareWhatsAppQuick order={order} className="pf-act-wide" />
        <span className="col-span-2">
          <CopyMessageQuick order={order} className="pf-act-wide" />
        </span>
      </div>
    </article>
  );
}

/* =================================================================
   ANTREAN
   ================================================================= */
export function JobQueue({
  jobs,
  photoCounts,
  outsource,
  due,
}: {
  jobs: OrderInsight[];
  photoCounts: Map<number, number>;
  outsource: Map<number, { status: string; partnerName: string }>;
  due: Map<number, { dueDate: string; dueTime: string }>;
}) {
  return (
    <>
      {/* Ponsel: geser samping, satu kartu hampir penuh layar. */}
      <div className="pf-swipe -mx-3 px-3 sm:-mx-4 sm:px-4 lg:hidden">
        {jobs.map((job, i) => (
          <JobCardMobile
            key={job.orderId}
            insight={job}
            rank={i + 1}
            photoCount={photoCounts.get(job.orderId) ?? 0}
            outsource={outsource.get(job.orderId)}
            dueDate={due.get(job.orderId)?.dueDate ?? ""}
            dueTime={due.get(job.orderId)?.dueTime ?? ""}
          />
        ))}
      </div>

      {/* Layar lebar: baris data. */}
      <div className="pf-surface hidden overflow-hidden lg:block">
        <div className="pf-row-head">
          <span>#</span>
          <span>Pekerjaan</span>
          <span>Tahap</span>
          <span>PIC dan tenggat</span>
          <span className="text-center">Skor</span>
          <span className="text-right">Aksi</span>
        </div>
        {jobs.map((job, i) => (
          <JobRow
            key={job.orderId}
            insight={job}
            rank={i + 1}
            photoCount={photoCounts.get(job.orderId) ?? 0}
            outsource={outsource.get(job.orderId)}
            dueDate={due.get(job.orderId)?.dueDate ?? ""}
            dueTime={due.get(job.orderId)?.dueTime ?? ""}
          />
        ))}
      </div>
    </>
  );
}
