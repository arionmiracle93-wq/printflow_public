import type { ReactNode } from "react";
import { ArrowUpRight, Building2, Lightbulb, Package, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
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
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-teal-400 to-amber-300 opacity-0 transition group-hover:opacity-100" />
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg md:h-9 md:w-9 md:rounded-xl ${tiles[accent]}`}>{icon}</div>
      <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[.09em] text-slate-500 md:mt-3">{label}</p>
      <p className={`mt-1 text-lg font-black tracking-tight md:text-2xl ${tone}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] font-medium text-slate-400">{hint}</p> : null}
    </div>
  );
}

// Gaya tombol aksi kartu pekerjaan: glassmorphism simpel (border tipis +
// tint transparan + shadow), diseragamkan jadi satu warna netral untuk semua
// tombol. Teks warna solid (bukan pastel-di-atas-pastel) supaya kontrasnya jelas.
// CATATAN PERFORMA: sengaja TIDAK pakai `backdrop-blur` di sini. Kartu ini bisa
// dobel sampai 6 buah di dashboard × 4 tombol = 24 elemen blur sekaligus di satu
// halaman — backdrop-filter itu berat buat GPU/compositor, apalagi di WebView
// Android (APK), dan bikin scroll dashboard terasa patah-patah. Tint transparan
// + border + shadow saja sudah cukup buat kesan "kaca" tanpa biaya render itu.
// `text-slate-700`/`dark:text-slate-100` sengaja dipilih agar urutan warna
// Tailwind (slate → ... → teal) membuat highlight "Tersalin!" teal bawaan
// `CopyMessageQuick` tetap menang saat status copied aktif.
const GLASS_BTN_BASE =
  "flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl border text-[12px] font-extrabold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96] px-2 py-2 text-center";

const GLASS_BTN_ACCENT =
  "border-slate-300/60 bg-slate-400/15 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,.55),0_2px_10px_rgba(51,65,85,.10)] hover:bg-slate-400/25 hover:border-slate-300/80 dark:border-white/15 dark:bg-white/[0.08] dark:text-slate-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,.06)] dark:hover:bg-white/[0.14]";

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
  return (
    <div className="card group relative overflow-hidden p-3.5 transition-all hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg dark:bg-[#1a2633]">
      <div className={`absolute inset-y-0 left-0 w-1 ${meta.bar}`} />
      <div className="flex flex-wrap items-start justify-between gap-2 pl-1">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-teal-600 dark:text-teal-400">
            {insight.code}
            <PhotoQuickPeek orderId={insight.orderId} code={insight.code} count={photoCount} />
          </p>
          <p className="mt-0.5 truncate text-[13px] font-bold text-[#07384f] dark:text-slate-100">{insight.title}</p>
          <p className="text-[11px] text-slate-500">{insight.customerName}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
            <Package size={10} className="shrink-0" />
            <span className="truncate">{insight.itemsSummary}</span>
          </p>
          <p className={`mt-1 flex items-center gap-1 text-[10px] font-bold ${insight.operator ? "text-teal-600" : "text-amber-600"}`}>
            <UserRound size={10} /> {insight.operator || "No PIC"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <QuickStatusPopup
            orderId={insight.orderId}
            orderCode={insight.code}
            orderTitle={insight.title}
            currentStatus={insight.status}
            hasOutsource={Boolean(outsource)}
            trigger={
              <span className="flex flex-col items-end gap-1">
                <StatusBadge status={insight.status} />
                <RiskBadge level={insight.riskLevel} score={insight.riskScore} />
              </span>
            }
          />
        </div>
      </div>
      <p className="mt-2 text-[12px] font-medium leading-relaxed text-slate-600 dark:text-slate-300">{insight.headline}</p>
      <div className="mt-2"><ProgressBar value={insight.progress} tone={meta.bar} /></div>
      <ul className="mt-2.5 space-y-1 text-[11px] leading-relaxed text-slate-500">
        {insight.reasons.slice(0, 1).map((reason) => (
          <li key={reason} className="flex gap-1.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-400" /><span>{reason}</span></li>
        ))}
      </ul>
      {insight.recommendations[0] ? (
        <div className="mt-3 flex gap-2 rounded-xl border border-amber-100 bg-amber-50/50 px-2.5 py-1.5 text-[11px] font-medium text-amber-900 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-200">
          <Lightbulb size={12} className="mt-0.5 shrink-0 text-amber-500" />
          <span className="line-clamp-2">{insight.recommendations[0]}</span>
        </div>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <a href={`/pesanan/${insight.orderId}`} className={`${GLASS_BTN_BASE} ${GLASS_BTN_ACCENT} !min-h-[36px] !rounded-xl !text-[11px]`}>
          Detail <ArrowUpRight size={12} />
        </a>
        <QuickStatusPopup
          orderId={insight.orderId}
          orderCode={insight.code}
          orderTitle={insight.title}
          currentStatus={insight.status}
          hasOutsource={Boolean(outsource)}
          trigger={
            <span className={`${GLASS_BTN_BASE} ${GLASS_BTN_ACCENT} !min-h-[36px] !rounded-xl !text-[11px]`}>
              Update <RefreshCw size={12} />
            </span>
          }
        />
        <ShareWhatsAppQuick order={shareOrder} className={`${GLASS_BTN_BASE} ${GLASS_BTN_ACCENT} !min-h-[36px] !rounded-xl !text-[11px]`} />
        <CopyMessageQuick order={shareOrder} className={`${GLASS_BTN_BASE} ${GLASS_BTN_ACCENT} !min-h-[36px] !rounded-xl !text-[11px]`} />
      </div>
    </div>
  );
}

export function SafeIcon() {
  return <ShieldCheck size={18} />;
}
