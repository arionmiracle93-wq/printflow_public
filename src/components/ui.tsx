import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Flame,
  Info,
  Lightbulb,
  OctagonAlert,
  Package,
  Palette,
  PackageCheck,
  PauseCircle,
  Printer,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Target,
  UserRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { RISK_META, type OrderInsight, type RiskLevel } from "@/lib/ai";
import { priorityMeta, statusMeta } from "@/lib/domain";
import { CopyMessageQuick } from "@/components/CopyMessageQuick";
import { PhotoQuickPeek } from "@/components/PhotoQuickPeek";
import { QuickStatusPopup } from "@/components/QuickStatusPopup";
import { ShareWhatsAppQuick } from "@/components/ShareWhatsAppQuick";

export function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return <span className={`chip ${meta.badge}`}>{meta.short}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const meta = priorityMeta(priority);
  return <span className={`chip ${meta.badge}`}>{meta.label}</span>;
}

export function RiskBadge({ level, score }: { level: RiskLevel; score?: number }) {
  const meta = RISK_META[level];
  return (
    <span className={`chip ${meta.badge}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
      {typeof score === "number" ? <span className="opacity-60">· {Math.round(score)}</span> : null}
    </span>
  );
}

export function ProgressBar({ value, tone = "bg-teal-500" }: { value: number; tone?: string }) {
  return (
    <div className="progress-track">
      <div className={`h-full rounded-full ${tone} transition-all duration-500`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "text-[#07384f]",
  icon,
  accent = "teal",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  icon?: ReactNode;
  accent?: "teal" | "yellow" | "rose" | "blue";
}) {
  const tiles = {
    teal: "bg-teal-50 text-teal-700",
    yellow: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    blue: "bg-sky-50 text-sky-600",
  };
  return (
    <div className="card group relative overflow-hidden p-2.5 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,75,84,.11)] md:p-4">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-teal-400 to-amber-300 opacity-30 transition group-hover:opacity-100" />
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg md:h-9 md:w-9 md:rounded-xl ${tiles[accent]}`}>{icon}</div>
      <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[.09em] text-slate-500 md:mt-3">{label}</p>
      <p className={`mt-1 text-lg font-black tracking-tight md:text-2xl ${tone}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] font-medium text-slate-400">{hint}</p> : null}
    </div>
  );
}

// Ikon pengganti emoji status (dulu cuma `.emoji` teks) — dipakai di pill status
// kanan-atas kartu pekerjaan supaya terasa seperti ikon garis, bukan emoji.
export const STATUS_ICONS: Record<string, LucideIcon> = {
  antrian: UserRound,
  desain: Palette,
  cetak: Printer,
  finishing: Scissors,
  qc: ShieldCheck,
  siap: PackageCheck,
  selesai: CheckCheck,
  ditunda: PauseCircle,
  batal: XCircle,
};

// Kotak highlight headline (ikon + warna) berdasarkan level risiko AI —
// dipisah dari warna status pekerjaan karena maknanya berbeda (risiko waktu,
// bukan tahap produksi). Progress bar di dalamnya tetap ikut warna STATUS
// (meta.bar), bukan warna kotak ini, supaya adaptif per tahap produksi.
const RISK_BOX: Record<RiskLevel, { box: string; iconBg: string; Icon: LucideIcon }> = {
  aman: { box: "border-emerald-200 bg-emerald-50", iconBg: "bg-emerald-500", Icon: Check },
  waspada: { box: "border-amber-200 bg-amber-50", iconBg: "bg-amber-500", Icon: AlertTriangle },
  risiko: { box: "border-orange-200 bg-orange-50", iconBg: "bg-orange-500", Icon: Flame },
  terlambat: { box: "border-rose-200 bg-rose-50", iconBg: "bg-rose-500", Icon: OctagonAlert },
};

// Ikon + warna untuk baris "alasan" (maks. 2 baris ditampilkan) — baris
// pertama selalu ringkasan progres/waktu, baris kedua konteks tambahan.
const REASON_ICON_TONE: { Icon: LucideIcon; bg: string }[] = [
  { Icon: Clock, bg: "bg-sky-500" },
  { Icon: Info, bg: "bg-violet-500" },
];

/** Buang emoji dari headline AI (🟢/🟡/🟠/🔴/✅/⛔) — sekarang diwakili ikon di kotak highlight, bukan teks emoji. */
function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pecah kalimat rekomendasi jadi baris tebal (kalimat pertama) + baris biasa (sisanya). */
function splitRecommendation(text: string): [string, string] {
  const idx = text.indexOf(". ");
  if (idx === -1) return [text, ""];
  return [text.slice(0, idx + 1), text.slice(idx + 2)];
}

// Tombol aksi kartu pekerjaan: pil dengan warna senada panel "alasan"
// (progres & kapasitas waktu) — bg-slate-50/border-slate-200 — teks & ikon
// di tengah (bukan avatar bundar), dipakai untuk keempat aksi (Buka detail,
// Update status, Kirim WA, Salin teks pesan) supaya konsisten satu sama lain.
const ACTION_BTN =
  "flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[13px] font-extrabold text-[#07384f] transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100 active:translate-y-0 active:scale-[0.96]";

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
  const StatusIcon = STATUS_ICONS[insight.status] ?? UserRound;
  const riskBox = RISK_BOX[insight.riskLevel];
  const RiskIcon = riskBox.Icon;
  const cleanHeadline = stripEmoji(insight.headline);
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
  return (
    <div className="card group relative overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_12px_30px_rgba(15,75,84,.1)]">
      <div className={`absolute inset-y-0 left-0 w-1 ${meta.bar}`} />

      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="icon-tile shrink-0">
            <FileText size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="text-[13px] font-extrabold tracking-wide text-teal-700">{insight.code}</span>
              <PhotoQuickPeek orderId={insight.orderId} code={insight.code} count={photoCount} />
            </p>
            <p className="mt-1 truncate text-lg font-black leading-tight text-[#07384f]">{insight.title}</p>
            <p className="text-xs font-medium text-slate-500">{insight.customerName}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
              <Package size={13} className="shrink-0" />
              <span className="truncate">{insight.itemsSummary}</span>
              {insight.items.length > 1 ? (
                <span className="shrink-0 rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-extrabold text-teal-700">
                  {insight.items.length}
                </span>
              ) : null}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <UserRound size={12} />
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${
                  insight.operator ? "border-sky-200 bg-sky-50 text-sky-700" : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                PIC: {insight.operator || "Belum ditentukan"}
              </span>
            </div>
            {outsource ? (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">
                <Building2 size={10} /> Mitra: {outsource.partnerName}
              </span>
            ) : null}
          </div>
        </div>

        <QuickStatusPopup
          orderId={insight.orderId}
          orderCode={insight.code}
          orderTitle={insight.title}
          currentStatus={insight.status}
          hasOutsource={Boolean(outsource)}
          trigger={
            <span className="flex flex-col items-end gap-1.5">
              <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-extrabold ${meta.badge}`}>
                <StatusIcon size={13} /> {meta.short}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-extrabold ${RISK_META[insight.riskLevel].badge}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {RISK_META[insight.riskLevel].label}
                {typeof insight.riskScore === "number" ? <span className="opacity-60">· {Math.round(insight.riskScore)}</span> : null}
              </span>
            </span>
          }
        />
      </div>

      <div className={`mt-3.5 rounded-2xl border px-4 py-3 ${riskBox.box}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${riskBox.iconBg}`}>
              <RiskIcon size={16} />
            </span>
            <p className="min-w-0 text-sm font-extrabold leading-snug text-[#07384f]">{cleanHeadline}</p>
          </div>
          <Target size={18} className="shrink-0 text-slate-400" />
        </div>
        <div className="mt-2.5">
          <ProgressBar value={insight.progress} tone={meta.bar} />
        </div>
      </div>

      {insight.reasons.length > 0 ? (
        <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50">
          {insight.reasons.slice(0, 2).map((reason, i) => {
            const tone = REASON_ICON_TONE[i] ?? REASON_ICON_TONE[REASON_ICON_TONE.length - 1];
            const ReasonIcon = tone.Icon;
            return (
              <div key={reason} className="flex items-start gap-2.5 px-3.5 py-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${tone.bg}`}>
                  <ReasonIcon size={13} />
                </span>
                <p className="text-xs font-medium leading-relaxed text-slate-700">{reason}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {insight.recommendations[0]
        ? (() => {
            const [lead, rest] = splitRecommendation(insight.recommendations[0]);
            return (
              <div className="mt-3 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                  <Lightbulb size={15} />
                </span>
                <span className="mt-0.5 w-px self-stretch bg-amber-400/30" />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-amber-900">{lead}</p>
                  {rest ? <p className="mt-0.5 text-xs text-amber-800">{rest}</p> : null}
                </div>
              </div>
            );
          })()
        : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={`/pesanan/${insight.orderId}`} className={ACTION_BTN}>
          Buka detail <ArrowUpRight size={14} />
        </a>
        <QuickStatusPopup
          orderId={insight.orderId}
          orderCode={insight.code}
          orderTitle={insight.title}
          currentStatus={insight.status}
          hasOutsource={Boolean(outsource)}
          trigger={
            <span className={ACTION_BTN}>
              Update status <RefreshCw size={14} />
            </span>
          }
        />
        <ShareWhatsAppQuick order={shareOrder} className={ACTION_BTN} />
        <CopyMessageQuick order={shareOrder} className={ACTION_BTN} />
      </div>
    </div>
  );
}

export function SafeIcon() {
  return <ShieldCheck size={18} />;
}
