import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Building2,
  CheckCheck,
  FileText,
  Package,
  Palette,
  PackageCheck,
  PauseCircle,
  PieChart,
  Printer,
  RefreshCw,
  Scissors,
  ShieldCheck,
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

/**
 * KARTU KPI - gaya "strip datar" (revisi tampilan).
 * Tanpa kotak/border: ikon besar di kiri, lalu label, angka besar, dan
 * garis progres tipis di bawah angka. Antar-KPI dipisah garis vertikal
 * (digambar oleh kelas .pf-kpi di dashboard.css, tetap diam saat hover).
 *
 * Hover: hanya isi kartu yang naik sedikit. Tidak ada garis atas, latar,
 * atau bayangan. Ikon tetap ikon asli (dikirim dari page.tsx).
 *
 * Huruf: Inter lewat variabel --font-kpi (dimuat di layout.tsx), angka
 * semi-tebal, label tipis huruf besar. Kalau variabel tidak ada, otomatis
 * memakai font aplikasi biasa.
 *
 * bar (0-100) = panjang isi garis progres; barLabel = penjelasannya
 * (tampil saat garis di-hover). Nilainya dihitung di src/lib/kpi-bars.ts.
 */
export function KpiCard({
  label,
  value,
  hint,
  tone = "text-[#07384f]",
  icon,
  accent = "teal",
  bar = 0,
  barLabel,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  icon?: ReactNode;
  accent?: "teal" | "yellow" | "rose" | "blue";
  bar?: number;
  barLabel?: string;
}) {
  // Warna ikon memakai kelas yang sudah punya padanan mode gelap di globals.css.
  const iconTone = {
    teal: "text-teal-600",
    yellow: "text-amber-500",
    rose: "text-rose-600",
    blue: "text-sky-600",
  };
  const barTone = {
    teal: "from-teal-500 to-teal-300",
    yellow: "from-amber-500 to-amber-300",
    rose: "from-rose-500 to-rose-300",
    blue: "from-sky-500 to-sky-300",
  };
  // Angka panjang (mis. "Rp 12.500.000") dikecilkan bertahap supaya tetap
  // muat di samping ikon besar. Di layar lebar ukuran ikut lebar layar.
  const len = value.length;
  const valueSize =
    len <= 6
      ? "text-2xl md:text-[1.6rem] xl:text-[length:clamp(19px,1.6vw,26px)]"
      : len <= 10
        ? "text-xl md:text-[1.4rem] xl:text-[length:clamp(17px,1.35vw,22px)]"
        : len <= 13
          ? "text-lg md:text-[1.25rem] xl:text-[length:clamp(14px,1.05vw,17px)]"
          : "text-base md:text-lg xl:text-[length:clamp(12px,.95vw,15px)]";
  return (
    <div className="pf-kpi group relative py-3 pl-4 pr-2 md:pl-6 xl:pl-5">
      <div className="flex items-center gap-3 transition-transform duration-200 group-hover:-translate-y-0.5 md:gap-3.5">
        <div
          className={`shrink-0 ${iconTone[accent]} [&>svg]:h-8 [&>svg]:w-8 [&>svg]:[stroke-width:1.6] md:[&>svg]:h-9 md:[&>svg]:w-9`}
          aria-hidden
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="pf-kpi-label whitespace-nowrap text-[10px] font-normal uppercase leading-tight tracking-[.02em] md:text-[11px] xl:text-[length:clamp(10px,.8vw,12px)]">
            {label}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className={`whitespace-nowrap font-semibold leading-none tracking-tight ${valueSize} ${tone}`}>{value}</p>
            {hint ? <p className="min-w-0 truncate text-[11px] font-normal text-slate-400">{hint}</p> : null}
          </div>
          <div className="mt-1 w-24 py-1 md:w-[6.5rem]" title={barLabel} role={barLabel ? "img" : undefined} aria-label={barLabel} aria-hidden={barLabel ? undefined : true}>
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${barTone[accent]} transition-[width] duration-500`}
                style={{ width: `${Math.min(100, Math.max(0, bar))}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Ikon pengganti emoji status (dulu cuma `.emoji` teks) - dipakai di pill status
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

// Tahapan produksi yang ditampilkan sebagai 6 strip progres di kartu pekerjaan
// (urutannya sama dengan alur di STATUSES: antrian → ... → siap diambil).
const STAGE_FLOW = ["antrian", "desain", "cetak", "finishing", "qc", "siap"] as const;

/**
 * Strip progres 6 segmen di kartu pekerjaan.
 * - tahap yang sudah dilewati → teal
 * - tahap yang sedang berjalan → kuning/oranye
 * - tahap yang belum dikerjakan → abu gelap
 * Status "selesai" = semua strip teal. "ditunda"/"batal" tidak punya posisi di
 * alur, jadi semua strip abu dan hanya teks di kanan yang menjelaskan.
 */
function StageStrips({ status, label }: { status: string; label: string }) {
  const idx = STAGE_FLOW.indexOf(status as (typeof STAGE_FLOW)[number]);
  const allDone = status === "selesai";
  const labelTone =
    status === "ditunda" ? "text-amber-600" : status === "batal" ? "text-rose-600" : "text-slate-600";
  return (
    <div className="mt-3.5 flex items-center gap-3 pl-1" role="img" aria-label={`Tahap produksi: ${label}`}>
      <div className="flex shrink-0 items-center gap-1">
        {STAGE_FLOW.map((key, i) => {
          const tone = allDone || (idx !== -1 && i < idx) ? "bg-teal-500" : idx !== -1 && i === idx ? "bg-amber-400" : "bg-slate-200";
          return <span key={key} className={`h-1.5 w-6 rounded-full transition-colors duration-300 ${tone}`} />;
        })}
      </div>
      <p className={`min-w-0 truncate text-xs font-semibold ${labelTone}`}>{label}</p>
    </div>
  );
}

// Tombol aksi kartu pekerjaan: pil bg-slate-50/border-slate-200 - teks & ikon
// di tengah (bukan avatar bundar), dipakai untuk keempat aksi (Buka detail,
// Update status, Kirim WA, Salin teks pesan) supaya konsisten satu sama lain.
const ACTION_BTN =
  "flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[13px] font-semibold text-[color:var(--pf-ink)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100 active:translate-y-0 active:scale-[0.96]";

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
              <span className="text-[13px] font-semibold tracking-wide text-teal-700">{insight.code}</span>
              <PhotoQuickPeek orderId={insight.orderId} code={insight.code} count={photoCount} />
            </p>
            <p className="mt-1 line-clamp-2 break-words text-[15px] font-bold leading-snug text-[color:var(--pf-ink)] sm:text-lg sm:leading-tight" title={insight.title}>{insight.title}</p>
            <p className="text-xs font-medium text-slate-500">{insight.customerName}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
              <Package size={13} className="shrink-0" />
              <span className="truncate">{insight.itemsSummary}</span>
              {insight.items.length > 1 ? (
                <span className="shrink-0 rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
                  {insight.items.length}
                </span>
              ) : null}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <UserRound size={12} />
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  insight.operator ? "border-sky-200 bg-sky-50 text-sky-700" : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                PIC: {insight.operator || "Belum ditentukan"}
              </span>
            </div>
            {outsource ? (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
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
              <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${meta.badge}`}>
                <StatusIcon size={13} /> {meta.short}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${RISK_META[insight.riskLevel].badge}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {RISK_META[insight.riskLevel].label}
                {typeof insight.riskScore === "number" ? <span className="opacity-60">· {Math.round(insight.riskScore)}</span> : null}
              </span>
            </span>
          }
        />
      </div>

      <StageStrips status={insight.status} label={meta.label} />

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

// Donut chart ringan (SVG polos, tanpa library chart) yang menampilkan proporsi
// pekerjaan aktif menurut level risiko - dipasang di kolom kanan Dashboard,
// di atas panel Tanya AI, biar layout 2 kolom terasa seimbang.
export function KpiRiskDonut({
  aman,
  waspada,
  terlambat,
}: {
  aman: number;
  waspada: number;
  terlambat: number;
}) {
  const total = aman + waspada + terlambat;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { key: "aman", label: "Aman", value: aman, ring: "#10b981", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
    { key: "waspada", label: "Waspada / risiko", value: waspada, ring: "#f59e0b", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
    { key: "terlambat", label: "Terlambat", value: terlambat, ring: "#f43f5e", dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
  ];

  let drawn = 0;

  return (
    <div className="panel-glass p-5">
      <div className="flex items-center gap-3">
        <span className="icon-tile">
          <PieChart size={18} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--pf-ink)] dark:text-slate-100">Distribusi risiko pekerjaan</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {total > 0 ? `Dari ${total} pekerjaan aktif` : "Belum ada pekerjaan aktif"}
          </p>
        </div>
      </div>

      {total === 0 ? (
        <p className="mt-4 text-xs text-slate-400">Grafik akan muncul begitu ada pekerjaan berjalan.</p>
      ) : (
        <div className="mt-4 flex items-center gap-5">
          <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90" role="img" aria-label="Distribusi risiko pekerjaan aktif">
            <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="14" className="stroke-slate-100 dark:stroke-white/10" />
            {segments.map((seg) => {
              if (seg.value <= 0) return null;
              const length = (seg.value / total) * circumference;
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
                  strokeWidth="14"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={offset}
                  strokeLinecap={segments.filter((s) => s.value > 0).length > 1 ? "butt" : "round"}
                />
              );
            })}
          </svg>
          <ul className="flex-1 space-y-2.5">
            {segments.map((seg) => (
              <li key={seg.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${seg.dot}`} /> {seg.label}
                </span>
                <span className={`font-semibold ${seg.text}`}>
                  {seg.value} <span className="font-medium text-slate-400 dark:text-slate-500">· {Math.round((seg.value / total) * 100)}%</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
