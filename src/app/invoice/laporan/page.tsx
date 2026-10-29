import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  Info,
  Landmark,
  Minus,
  MoreHorizontal,
  Package,
  CircleAlert,
  PieChart,
  ReceiptText,
  RotateCcw,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { InvoiceFrame, InvoiceSidebar, SideButton } from "@/components/InvoiceSidebar";
import { ProblemScreen } from "@/components/ProblemScreen";
import { DateInputForm } from "@/components/DateInputForm";
import { MonthFieldID } from "@/components/MonthFieldID";
import { Select } from "@/components/Select";
import { DonutLegendItem, StatusDonut, TrendChart, pctStr, type SeriesData } from "@/components/reports/LaporanCharts";
import { TipsBanner } from "@/components/reports/TipsBanner";
import { safeDb } from "@/lib/dbcheck";
import { formatRupiah, jakartaDateISO } from "@/lib/domain";
import { getInvoiceAccess } from "@/lib/invoice-access";
import { addDays, buildBuckets, buildPeriod, dateLabel, monthEnd, monthLabel, shiftMonthKey, shortcuts, type Period } from "@/lib/invoice-period";
import { getPayMethodLedger, getRefundReport, getReport, getReportLite, getSalesTransactions, type PayMethodLedger, type PayMethodRow, type RankRow, type RefundReport } from "@/lib/invoice-reports";
import { getInvoiceSettings } from "@/lib/invoice-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Laporan Invoice - Print Flow" };

type SP = { mode?: string; bulan?: string; tanggal?: string; dari?: string; sampai?: string; banding?: string; tab?: string; metode?: string; hal?: string; per?: string };

type Banding = "sebelumnya" | "tahun-lalu" | "tanpa";
type ContentTab = "ringkasan" | "penjualan" | "produk" | "pelanggan" | "pembayaran" | "refund";

/* Daftar tampilan laporan. Default `ringkasan`. */
const CONTENT_TABS: { key: ContentTab; label: string; icon: LucideIcon }[] = [
  { key: "ringkasan", label: "Ringkasan", icon: PieChart },
  { key: "penjualan", label: "Penjualan", icon: BarChart3 },
  { key: "produk", label: "Produk", icon: Package },
  { key: "pelanggan", label: "Pelanggan", icon: Users },
  { key: "pembayaran", label: "Pembayaran", icon: Wallet },
  { key: "refund", label: "Refund", icon: RotateCcw },
];

/* Kalimat kecil di bawah judul panel kepala (mengikuti tab aktif). */
const TAB_SUBTITLES: Record<ContentTab, string> = {
  ringkasan: "Gambaran umum kinerja bisnis Anda.",
  penjualan: "Daftar transaksi penjualan dalam periode ini.",
  produk: "Produk yang paling menyumbang omzet.",
  pelanggan: "Pelanggan paling aktif dalam periode ini.",
  pembayaran: "Pantau transaksi dan pembayaran bisnis Anda.",
  refund: "Uang yang kembali ke pelanggan dan kas masuk netonya.",
};

/* Kartu "cara menghitung" (pengganti TabBar): ikon + subjudul ringkas, centang saat aktif. */
const MODE_CARDS_DEF: { key: Period["mode"]; label: string; sub: string; icon: LucideIcon }[] = [
  { key: "monthly", label: "Bulanan", sub: "Per bulan", icon: CalendarDays },
  { key: "daily", label: "Harian", sub: "Per hari", icon: CalendarClock },
  { key: "range", label: "Rentang", sub: "Kustom", icon: CalendarRange },
];

/* Jangkar kartu Pembayaran. Navigasi yang masih dalam area Pembayaran
   (kartu metode <-> buku metode) melengkapi alamatnya dengan #jangkar ini
   supaya layar LANGSUNG kembali berfokus di kartu tersebut setelah
   halaman berganti - tidak melompat ke ujung atas yang memaksa scroll
   ulang ke bawah di monitor pendek (diminta owner). scroll-mt-24 pada
   section-nya memberi jarak aman dari app bar sticky. */
const BAYAR_ANCHOR = "laporan-pembayaran";

function qs(params: Record<string, string>) {
  /* Nilai kosong dibuang, bukan dikirim sebagai `key=`. Ini dipakai
     tautan "Semua metode" yang sengaja melewatkan metode: "" supaya
     metode terpilih LENYAP dari alamat - barulah balik ke rekap. */
  const out = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "") out.set(k, v);
  });
  return out.toString();
}

function periodParams(p: Period): Record<string, string> {
  if (p.mode === "daily") return { mode: "daily", tanggal: p.from };
  if (p.mode === "range") return { mode: "range", dari: p.from, sampai: p.to };
  return { mode: "monthly", bulan: p.from.slice(0, 7) };
}

/* ==== badge perbandingan (persen, satu desimal) ======================== */

function Delta({ cur, prev, label, goodUp = true }: { cur: number; prev: number; label: string; goodUp?: boolean }) {
  if (!prev && !cur) return <p className="text-[11px] text-slate-400">— sama seperti {label}</p>;
  if (!prev) return <p className="text-[11px] font-semibold text-emerald-600">Baru · {label} kosong</p>;
  const pct = ((cur - prev) / prev) * 100;
  if (Math.round(pct * 10) === 0) {
    return (
      <p className="flex items-center gap-1 text-[11px] text-slate-500">
        <Minus size={11} /> Sama dengan {label}
      </p>
    );
  }
  const up = pct > 0;
  const good = up === goodUp;
  const fmt = Math.abs(pct).toLocaleString("id-ID", { maximumFractionDigits: 1 });
  return (
    <p className={`flex items-center gap-1 text-[11px] font-semibold ${good ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />} {fmt}% vs {label}
    </p>
  );
}

/* ==== baris peringkat produk & pelanggan =============================== */

const PROD_TINT = [
  "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
];
const AVATAR_BG = ["bg-teal-500", "bg-sky-500", "bg-rose-500", "bg-violet-500", "bg-amber-500", "bg-emerald-500"];

function productQtyLabel(r: RankRow): string {
  const qty = Number.isInteger(r.qty) ? String(r.qty) : r.qty.toFixed(1).replace(".", ",");
  return `${qty} pcs · ${r.count} transaksi`;
}

function RankList({ rows, kind }: { rows: RankRow[]; kind: "produk" | "pelanggan" }) {
  if (!rows.length) return <p className="text-xs text-slate-400">Belum ada data pada periode ini.</p>;
  const max = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <ul className="space-y-3.5">
      {rows.map((r, i) => (
        <li key={`${r.name}-${i}`}>
          <div className="flex items-center gap-2.5">
            {kind === "produk" ? (
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${PROD_TINT[i % PROD_TINT.length]}`}>
                <Package size={15} />
              </span>
            ) : (
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${AVATAR_BG[i % AVATAR_BG.length]}`}>
                {(r.name.trim()[0] ?? "?").toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] font-semibold text-[color:var(--pf-ink)]">{r.name}</span>
                <span className="shrink-0 text-[13px] font-bold text-[color:var(--pf-ink)]">{formatRupiah(r.amount)}</span>
              </div>
              <p className="text-[10.5px] text-slate-400">{kind === "produk" ? productQtyLabel(r) : `${r.count} invoice`}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/50">
                <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.max(4, Math.round((r.amount / max) * 100))}%` }} />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ==== kartu KPI ========================================================= */

function KpiCard({ tint, labelCls, iconCls, icon: Icon, label, value, valueCls, delta }: {
  tint: string;
  labelCls: string;
  iconCls: string;
  icon: LucideIcon;
  label: string;
  value: string;
  valueCls: string;
  delta: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-3.5 shadow-sm ${tint}`}>
      <p className="flex items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconCls}`}>
          <Icon size={15} />
        </span>
        <span className={`truncate text-[10.5px] font-extrabold uppercase tracking-wider ${labelCls}`}>{label}</span>
      </p>
      <p className={`mt-1.5 text-[21px] font-extrabold tracking-tight ${valueCls}`}>{value}</p>
      <div className="mt-0.5">{delta}</div>
    </div>
  );
}

/* ==== ikon metode pembayaran =========================================== */

/* Elemen ikon metode dibangun langsung (bukan tipe komponen dipilih
   saat render) supaya tidak ada komponen yang "dibuat" setiap render. */
function methodIconEl(name: string): ReactNode {
  const s = name.toLowerCase();
  if (/transfer|bank|trf|bca|bri|bni|mandiri|permata|cimb/.test(s)) return <Landmark size={14} />;
  if (/tunai|cash|qris|gopay|ovo|shopee|dana|linkaja|ewallet/.test(s)) return <Wallet size={14} />;
  return <MoreHorizontal size={14} />;
}

/* Baris metode pembayaran: sekarang TINJAHAN - klik menuju tab
   Pembayaran berisi daftar transaksi metode tsb. */
function MethodRow({ row, omzet, href }: { row: PayMethodRow; omzet: number; href: string }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-2.5 rounded-lg py-0.5 pr-1 -ml-1 pl-1 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {methodIconEl(row.name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-[color:var(--pf-ink-2)] group-hover:text-[color:var(--pf-ink)] group-hover:underline decoration-dotted">{row.name}</span>
        <span className="shrink-0 text-[13px] font-bold text-[color:var(--pf-ink)]">{formatRupiah(row.amount)}</span>
        <span className="w-12 shrink-0 text-right text-[11px] text-slate-400">({pctStr(row.amount, omzet)}%)</span>
        <ChevronRight size={13} className="shrink-0 text-slate-300 group-hover:text-teal-600" aria-hidden />
      </Link>
    </li>
  );
}

/* Pil status pembayaran satu invoice. */
function payStatusChip(r: { lunas: boolean; paid: number }): ReactNode {
  if (r.lunas) {
    return <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">Lunas</span>;
  }
  if (r.paid > 0) {
    return <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">Sebagian</span>;
  }
  return <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10.5px] font-bold text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">Belum Bayar</span>;
}

/* Baris transaksi pada buku metode pembayaran. */
function TxRow({ r }: { r: { number: string; issueDate: string; customer: string; amount: number; remaining: number; lunas: boolean; paid: number } }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
      <span className="w-[86px] shrink-0 text-[11px] text-slate-400">{r.issueDate ? dateLabel(r.issueDate) : "-"}</span>
      <span className="shrink-0 text-[13px] font-bold text-[color:var(--pf-ink)]">{r.number || "-"}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-[color:var(--pf-ink-2)]">{r.customer}</span>
      <span className="shrink-0 text-[13px] font-bold text-[color:var(--pf-ink)]">{formatRupiah(r.amount)}</span>
      {r.remaining > 0 ? <span className="shrink-0 text-[11px] font-semibold text-rose-600">sisa {formatRupiah(r.remaining)}</span> : null}
      {payStatusChip(r)}
    </li>
  );
}

/* ==== tabel transaksi penjualan (tab penjualan) ========================= */

/* "YYYY-MM-DD HH:MI" (WIB dari SQL) → "1 Okt 2026, 08:23". */
function tsLabel(v: string): string {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v)) return "-";
  return `${dateLabel(v.slice(0, 10))}, ${v.slice(11, 16)}`;
}

/* Urutan tombol nomor halaman dengan elips, gaya rekap kasir POS:
   1 sampai lebar tengah tetap terlihat, celah jarak jauh jadi "…". */
function pageList(cur: number, pages: number): Array<number | "..."> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const start = cur <= 3 ? 2 : cur - 1;
  const end = cur >= pages - 2 ? pages - 1 : Math.max(cur + 1, 4);
  const out: Array<number | "..."> = [1];
  if (start > 2) out.push("...");
  for (let n = start; n <= end; n += 1) out.push(n);
  if (end < pages - 1) out.push("...");
  out.push(pages);
  return out;
}

/* ==== refund (KPI + tab khusus + kartu di tab pembayaran) =============== */

/* Tiga sel ringkasan uang keluar: dipakai tab Pembayaran dan halaman Refund
   supaya angkanya tidak pernah berbeda cerita di dua tempat. */
function RefundTiles({ dibayar, refund }: { dibayar: number; refund: RefundReport }) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
      <div className="rounded-xl bg-emerald-50 p-2.5 dark:bg-emerald-950/40">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-700/80 dark:text-emerald-300/80">Dibayar (dari invoice terbit)</p>
        <p className="mt-0.5 text-[15px] font-extrabold text-emerald-700 dark:text-emerald-300">{formatRupiah(dibayar)}</p>
      </div>
      <div className="rounded-xl bg-rose-50 p-2.5 dark:bg-rose-950/40">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-rose-700/80 dark:text-rose-300/80">Dikurangi refund terkirim ({refund.count})</p>
        <p className="mt-0.5 text-[15px] font-extrabold text-rose-600">{formatRupiah(refund.total)}</p>
      </div>
      <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Kas masuk neto</p>
        <p className="mt-0.5 text-[15px] font-extrabold text-[color:var(--pf-ink)]">{formatRupiah(dibayar - refund.total)}</p>
      </div>
    </div>
  );
}

/* Daftar refund terkirim (maksimal 60 terbaru), sisa dihitung di kartu atas. */
function RefundRows({ refund }: { refund: RefundReport }) {
  if (!refund.rows.length) return <p className="py-4 text-xs text-slate-400">Belum ada refund terkirim pada periode ini.</p>;
  return (
    <>
      <ul className="divide-y divide-[color:var(--pf-line-soft)] border-t border-[color:var(--pf-line-soft)]">
        {refund.rows.map((r, i) => (
          <li key={`${r.invoiceId}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            <span className="w-[86px] shrink-0 text-[11px] text-slate-400">{r.paidOutAt ? dateLabel(r.paidOutAt) : "-"}</span>
            <span className="w-[110px] shrink-0 text-[13px] font-bold text-[color:var(--pf-ink)]">{r.number || "-"}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-[color:var(--pf-ink-2)]">{r.customer}</span>
            <span className="shrink-0 text-[11px] text-slate-500">{r.method}</span>
            <span className="shrink-0 text-[13px] font-bold text-rose-600">− {formatRupiah(r.amount)}</span>
            {r.reason ? (
              <span className="min-w-full truncate text-[11px] text-slate-400 sm:min-w-0 sm:basis-full" title={r.reason}>
                {r.reason}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {refund.count > refund.rows.length ? (
        <p className="mt-2 text-[11px] text-slate-400">Menampilkan 60 terbaru dari {refund.count} refund. Total lengkapnya di kartu di atas.</p>
      ) : null}
    </>
  );
}

/* ==== bar chart mingguan (penjualan) =================================== */

function BucketBars({ buckets, label }: { buckets: { label: string; title: string; value: number }[]; label: string }) {
  const maxBar = Math.max(...buckets.map((b) => b.value), 1);
  return (
    <div>
      <p className="text-sm font-bold text-[color:var(--pf-ink)]">{label}</p>
      <div className="mt-3 flex h-36 items-end gap-[3px]" role="img" aria-label="Grafik penjualan">
        {buckets.map((b, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 items-end" title={`${b.title}: ${formatRupiah(b.value)}`}>
            <div className={`w-full rounded-t ${b.value ? "bg-teal-500" : "bg-slate-200 dark:bg-slate-700"}`} style={{ height: `${b.value ? Math.max(4, Math.round((b.value / maxBar) * 100)) : 2}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{buckets[0]?.label}</span>
        <span>{buckets[Math.floor(buckets.length / 2)]?.label}</span>
        <span>{buckets[buckets.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/* ====================================================================== */

export default async function InvoiceReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const today = jakartaDateISO();
  const period = buildPeriod(sp, today);

  const tab = CONTENT_TABS.some((t) => t.key === sp.tab) ? (sp.tab as ContentTab) : "ringkasan";
  const banding: Banding = sp.banding === "tanpa" || sp.banding === "tahun-lalu" ? sp.banding : "sebelumnya";

  /* Metode terpilih hanya relevan di tab Pembayaran (bentuk bebas, mengikuti
     pengisian invoice: "Transfer Bank", "Tunai", dst). Semua tautan di
     halaman mempertahankan pasangan metode+tab ini lewat `carry`. */
  const metode = (sp.metode ?? "").trim().slice(0, 60);
  const carry: Record<string, string> = { tab, ...(tab === "pembayaran" && metode ? { metode } : {}) };

  /* Periode pembanding. Bawaannya periode.setara sebelumnya dari
     buildPeriod; "tahun-lalu" menggeser satu tahun (rentang minang sama
     panjang), "tanpa" tidak memanggil query pembanding sama sekali. */
  let cmpFrom = period.prevFrom;
  let cmpTo = period.prevTo;
  let cmpLabel = period.prevLabel;
  if (banding === "tahun-lalu") {
    if (period.mode === "monthly") {
      const yoyKey = shiftMonthKey(period.from.slice(0, 7), -12);
      cmpFrom = `${yoyKey}-01`;
      cmpTo = monthEnd(yoyKey);
      cmpLabel = monthLabel(yoyKey);
    } else if (period.mode === "daily") {
      cmpFrom = cmpTo = addDays(period.from, -365);
      cmpLabel = dateLabel(cmpFrom);
    } else {
      cmpTo = addDays(period.to, -365);
      cmpFrom = addDays(cmpTo, -(period.days - 1));
      cmpLabel = `${dateLabel(cmpFrom)} – ${dateLabel(cmpTo)}`;
    }
  }

  /* Peringkat yang dimuat mengikuti tab yang tampil. Tab Penjualan tidak
     memakai peringkat sama sekali. Pembanding memakai versi ringan
     (1 query), karena yang dipakai dari periode itu hanya angka KPI dan
     omzet per hari. Query yang tersisa saling bebas, jadi berjalan paralel. */
  const reportParts = {
    products: tab === "ringkasan" || tab === "produk",
    customers: tab === "ringkasan" || tab === "pelanggan",
    methods: tab === "ringkasan" || tab === "pembayaran",
  };
  const cmpPromise = banding === "tanpa" ? Promise.resolve(null) : getReportLite(cmpFrom, cmpTo);
  const ledgerPromise =
    tab === "pembayaran" && metode ? getPayMethodLedger(period.from, period.to, metode) : Promise.resolve(null);
  /* Refund terkirim dibaca untuk kartu KPI "Refund · Uang Keluar" (semua tab)
     dan kartu detail di tab Pembayaran — uang keluar per tanggal keluar uang.
     Gagal ambil dilapangkan jadi null: angka invoice tidak pernah tergantung
     refund, jadi laporan lama tidak mungkin rusak oleh kartu baru. */
  const refundPromise = getRefundReport(period.from, period.to).catch(() => null);
  /* TABEL TRANSAKSI PENJUALAN (tab Penjualan): mode halaman lewat URL —
     `per` dibatasi {10,25,50}, `hal` dipaksa bilangan sehat. Di tab lain
     tidak ditarik sama sekali (nol query tambahan). */
  const txPer = sp.per === "25" || sp.per === "50" ? Number(sp.per) : 10;
  const txPage = Math.max(1, Number.parseInt(sp.hal ?? "", 10) || 1);
  const salesPromise =
    tab === "penjualan" ? getSalesTransactions(period.from, period.to, txPage, txPer).catch(() => null) : Promise.resolve(null);
  const loaded = await safeDb(async () => {
    const [access, settings, rep, cmp, ledger, refund, sales] = await Promise.all([
      getInvoiceAccess(),
      getInvoiceSettings(),
      getReport(period.from, period.to, { productLimit: 12, customerLimit: 10, parts: reportParts }),
      cmpPromise,
      ledgerPromise,
      refundPromise,
      salesPromise,
    ]);
    if (!access || !access.isOwner) return null;
    return { settings, rep, cmp, ledger, refund, sales };
  });
  if (!loaded.ok) return <ProblemScreen problem={loaded.problem} hint="Laporan dihitung dari data invoice di database." />;
  if (!loaded.data) redirect("/tidak-diizinkan?dari=invoice");
  const { settings, rep, cmp, ledger, refund, sales } = loaded.data;

  const showCmp = banding !== "tanpa" && cmp !== null;
  const { buckets, weekly } = buildBuckets(period, rep.byDay);
  const best = buckets.reduce((a, b) => (b.value > a.value ? b : a), { label: "", title: "", value: 0 });
  const csvHref = `/api/invoices/report-csv?${qs(periodParams(period))}`;

  /* Deret grafik: periode aktif harian (atau mingguan untuk rentang
     panjang); periode pembanding diselaraskan per urutan hari, jadi
     1 Oktober digandeng dengan 1 September, dst. */
  const chartSeries: SeriesData = {
    label: period.label,
    values: buckets.map((b) => ({ label: b.label, value: b.value, title: b.title })),
  };
  let cmpSeries: SeriesData | null = null;
  if (cmp) {
    const step = weekly ? 7 : 1;
    const vals = buckets.map((_, i) => {
      let sum = 0;
      for (let k = 0; k < step; k += 1) sum += cmp.byDay[addDays(cmpFrom, i * step + k)] ?? 0;
      return sum;
    });
    cmpSeries = { label: cmpLabel, values: vals.map((v, i) => ({ label: buckets[i]?.label ?? "", value: v, title: buckets[i]?.title ?? "" })) };
  }

  /* Semua tautan mempertahankan pembanding + tab (dan metode di tab
     Pembayaran) supaya orang tidak "tersentak" kembali ke Ringkasan saat
     hanya mengganti periode. Tautan yang PINDAH tab melepas metode, dan
     pemberian metode: "" menghapusnya (jalur tautan "Semua metode"). */
  const laporanUrl = (over: Record<string, string>) => {
    const base: Record<string, string> = { ...periodParams(period), banding, ...carry, ...over };
    if (over.tab && over.tab !== "pembayaran") delete base.metode;
    return `/invoice/laporan?${qs(base)}`;
  };
  /* Sama seperti laporanUrl tetapi diakhiri jangkar kartu Pembayaran:
     dipakai semua navigasi di dalam area Pembayaran (balik ke rekap,
     klik kartu/baris metode). */
  const bayarUrl = (over: Record<string, string>) => `${laporanUrl(over)}#${BAYAR_ANCHOR}`;
  const modeLink = (mode: "monthly" | "daily" | "range") => {
    const base: Record<string, string> = mode === "monthly" ? { mode, bulan: today.slice(0, 7) } : mode === "daily" ? { mode, tanggal: today } : { mode, dari: addDays(today, -29), sampai: today };
    return `/invoice/laporan?${qs(period.mode === mode ? { ...periodParams(period), ...carry } : { ...base, banding, ...carry })}`;
  };
  const periodModes = MODE_CARDS_DEF.map((m) => ({ ...m, href: modeLink(m.key) }));
  /* Kepala panel: judul + ikon mengikuti tab aktif. */
  const activeTab = CONTENT_TABS.find((t) => t.key === tab) ?? CONTENT_TABS[0];
  /* Chip pintasan yang persis sama dengan periode aktif ditandai: cocokkan
     mode + tanggal dari/ke masing-masing pintasan terhadap periode
     sekarang (buildPeriod murni, tanpa DB). */
  const activeShortcutKeys = new Set(
    shortcuts(today)
      .filter((s) => {
        const p = buildPeriod(s.params, today);
        return p.mode === period.mode && p.from === period.from && p.to === period.to;
      })
      .map((s) => s.key),
  );
  const nav: { prev: Record<string, string>; next: Record<string, string> } | null =
    period.mode === "monthly"
      ? { prev: { mode: "monthly", bulan: shiftMonthKey(period.from.slice(0, 7), -1) }, next: { mode: "monthly", bulan: shiftMonthKey(period.from.slice(0, 7), 1) } }
      : period.mode === "daily"
        ? { prev: { mode: "daily", tanggal: addDays(period.from, -1) }, next: { mode: "daily", tanggal: addDays(period.from, 1) } }
        : null;
  const monthKey = period.from.slice(0, 7);
  const lunasPct = pctStr(rep.terbayar, rep.omzet);
  const topKirimTop5 = rep.products.slice(0, 5);
  const topCustTop5 = rep.customers.slice(0, 5);

  /* header kartu KPI */
  const noCmpNote = <p className="text-[11px] text-slate-400">Pembanding dimatikan</p>;
  const deltaOr = (cur: number, prev: number | undefined, goodUp?: boolean) =>
    showCmp && cmp ? <Delta cur={cur} prev={prev ?? 0} label={cmpLabel} goodUp={goodUp} /> : noCmpNote;

  return (
    <InvoiceFrame
      sidebar={
        <InvoiceSidebar
          businessName={settings.businessName}
          isOwner
          docType="semua"
          modeBehavior="filter"
          actionsPosition="top"
          actions={
            /* Tab tampilan laporan (Ringkasan/Penjualan/Produk/Pelanggan/
               Pembayaran) dipindah dari baris di atas kartu - permintaan
               owner: di HP dibuka lewat drawer tiga garis, di layar lebar
               berdiri paling atas kolom samping. Tombol Export CSV tidak
               ikut di sini (dihapus per permintaan owner) - ekspornya
               cukup di kop judul halaman. */
            <>
              <nav aria-label="Tampilan laporan" className="space-y-0.5">
                {CONTENT_TABS.map((t) => (
                  <SideButton
                    key={t.key}
                    href={laporanUrl({ tab: t.key })}
                    icon={<t.icon size={15} />}
                    active={tab === t.key}
                  >
                    {t.label}
                  </SideButton>
                ))}
              </nav>
              {/* Pemisah antar grup menu: baris tab laporan di atas, menu
                  utama Invoice (Invoice Baru/Riwayat/Katalog) di bawah.
                  Warna dibuat tegas (bukan garis super-lunak) supaya batas
                  antargrup langsung terlihat - permintaan owner. */}
              <div className="my-2.5 h-px bg-slate-300 dark:bg-slate-600/70" aria-hidden />
            </>
          }
        />
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <BarChart3 size={22} strokeWidth={2.3} /> Laporan
            </h1>
            <p className="text-sm text-slate-500">Dihitung dari Invoice yang sudah terbit (draft, batal, estimasi, SJ, dan PO tidak dihitung).</p>
          </div>
          {/* Ekspor dibuat polos sesuai permintaan owner: teks + ikon dengan
              border tipis, bukan tombol penuh yang berat. */}
          <a href={csvHref} className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white/60 px-2.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-[color:var(--pf-accent)] hover:bg-[color:var(--pf-accent-soft)] hover:text-[color:var(--pf-accent-strong)] lg:inline-flex dark:border-slate-700 dark:bg-transparent dark:text-slate-300 dark:hover:border-teal-500/60 dark:hover:bg-teal-950/30 dark:hover:text-teal-300">
            <Download size={14} /> Export CSV
          </a>
        </div>

        {/* KARTU FILTER
            Isi: kepala panel (desktop), papan atur - periodo, pembanding,
            tombol Terapkan, cara menghitung (Bulanan/Harian/Rentang),
            pintasan periode. Tab tampilan (Ringkasan/Penjualan/...)
            sudah pindah ke sidebar/drawer tiga garis. */}
        <section className="card p-4">
            <div className="space-y-3">
              {/* KEPALA PANEL (hanya desktop): ikon polos + judul tab aktif +
                  penjelasannya. Di HP dibuang - tab Ringkasan/Penjualan di
                  atas kartu sudah menandai tab aktif, jadi judulnya dobel
                  (permintaan owner). Di kanan: panah kembali/maju periode
                  dan kapsul label periode, DITINGGIKAN SAMA (h-9 = 36px,
                  sama dengan kolom input di papan atur). */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="hidden min-w-0 items-center gap-2.5 lg:flex">
                  {/*polos sesuai permintaan owner: ikon tunggal, tanpa lencana/latar. */}
                  <activeTab.icon size={22} strokeWidth={2.2} className="shrink-0 text-[color:var(--pf-accent-strong)]" />
                  <div className="min-w-0">
                    <h2 className="truncate text-[17px] font-extrabold leading-tight text-[color:var(--pf-ink)]">{activeTab.label}</h2>
                    <p className="truncate text-[11.5px] text-slate-500 dark:text-slate-400">{TAB_SUBTITLES[tab]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {nav ? (
                    <Link href={`/invoice/laporan?${qs({ ...nav.prev, banding, ...carry })}`} className="btn-ghost flex h-9 w-9 min-h-9 items-center justify-center px-0" aria-label="Periode sebelumnya"><ChevronLeft size={16} /></Link>
                  ) : <span className="hidden h-9 w-9 lg:block" />}
                  <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--pf-line-soft)] bg-white/70 px-3 text-xs font-bold text-[color:var(--pf-ink)] dark:bg-slate-900/50">
                    <CalendarDays size={14} className="text-[color:var(--pf-accent-strong)]" />
                    {period.label}
                  </span>
                  {nav ? (
                    <Link href={`/invoice/laporan?${qs({ ...nav.next, banding, ...carry })}`} className="btn-ghost flex h-9 w-9 min-h-9 items-center justify-center px-0" aria-label="Periode berikutnya"><ChevronRight size={16} /></Link>
                  ) : <span className="hidden h-9 w-9 lg:block" />}
                </div>
              </div>

              {/* PAPAN ATUR: filter + cara hitung + pin rentang cepat + catatan, dalam satu lembar halus. */}
              <div className="space-y-3 rounded-2xl border border-[color:var(--pf-line-soft)] bg-slate-50/70 p-3 dark:bg-slate-900/40">
                <form action="/invoice/laporan" method="get" className="flex flex-wrap items-end gap-1.5">
                  <input type="hidden" name="mode" value={period.mode} />
                  <input type="hidden" name="tab" value={tab} />
                  <div className="min-w-0 flex-[2_1_200px]">
                    <span className="label text-[10.5px]">Periode</span>
                    {period.mode === "monthly" ? <MonthFieldID name="bulan" defaultValue={monthKey} className="input min-h-9 w-full py-1 text-xs" label="Pilih bulan" /> : null}
                    {period.mode === "daily" ? <DateInputForm name="tanggal" defaultValue={period.from} className="input min-h-9 w-full py-1 text-xs" /> : null}
                    {period.mode === "range" ? (
                      <div className="flex items-center gap-1.5">
                        <DateInputForm name="dari" defaultValue={period.from} className="input min-h-9 w-full py-1 text-xs" />
                        <span className="pb-1.5 text-[10px] text-slate-400">s/d</span>
                        <DateInputForm name="sampai" defaultValue={period.to} className="input min-h-9 w-full py-1 text-xs" />
                      </div>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-[1_1_190px]">
                    <span className="label text-[10.5px]">Bandingkan dengan</span>
                    <Select defaultValue={banding} name="banding" className="input min-h-9 w-full text-xs" aria-label="Periode pembanding">
                      <option value="sebelumnya">Periode sebelumnya · {period.prevLabel}</option>
                      <option value="tahun-lalu">Tahun lalu</option>
                      <option value="tanpa">Tanpa perbandingan</option>
                    </Select>
                  </div>
                  {tab === "pembayaran" ? (
                    /* Dropdown metode hanya di tab Pembayaran, sesuai permintaan
                       owner: cash / transfer / qris mengikuti data invoice
                       (bukan daftar tetap). "Semua metode" = tampilan rekap.
                       Nilainya ikut terkirim oleh Select saat Terapkan Filter -
                       dinormalisasi di sisi baca, kosong = semua. */
                    <div className="min-w-0 flex-[1_1_170px]">
                      <span className="label text-[10.5px]">Metode Pembayaran</span>
                      <Select defaultValue={metode || ""} name="metode" className="input min-h-9 w-full text-xs" aria-label="Filter metode pembayaran">
                        <option value="">Semua metode</option>
                        {rep.methods.map((m) => (
                          <option key={m.name} value={m.name}>{m.name}</option>
                        ))}
                      </Select>
                    </div>
                  ) : null}
                  <button className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-teal-900 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-800">
                    <Filter size={13} /> Terapkan Filter
                  </button>
                </form>

                {/* KARTU CARA HITUNG: Bulanan / Harian / Rentang, lencana terpilih memakai lingkaran
                    centang. Di HP disusun ke bawah (satu kolom) supaya nama & subjudul tidak
                    terpotong - permintaan owner; dari sm ke atas kembali tiga kolom berdampingan. */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {periodModes.map((m) => {
                    const Icon = m.icon;
                    const active = m.key === period.mode;
                    return (
                      <Link
                        key={m.key}
                        href={m.href}
                        aria-current={active ? "true" : undefined}
                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors ${
                          active
                            ? "border-[color:var(--pf-accent)] bg-[color:var(--pf-accent-soft)] text-[color:var(--pf-accent-strong)]"
                            : "border-[color:var(--pf-line-soft)] text-[color:var(--pf-ink)] hover:border-[color:var(--pf-accent)] hover:bg-white dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <Icon size={15} className={active ? "shrink-0 text-[color:var(--pf-accent-strong)]" : "shrink-0 text-slate-400"} />
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[11px] font-bold leading-tight ${active ? "text-[color:var(--pf-accent-strong)]" : ""}`}>{m.label}</span>
                          <span className="block truncate text-[9.5px] leading-tight text-slate-400">{m.sub}</span>
                        </span>
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${active ? "bg-[color:var(--pf-accent)] text-white" : "invisible"}`} aria-hidden>
                          <Check size={10} strokeWidth={3.5} />
                        </span>
                      </Link>
                    );
                  })}
                </div>

                {/* Pin rentang cepat: desain persis sebelumnya (permintaan owner), hanya diberi label. */}
                <div>
                  <p className="mb-2 text-[11px] font-bold text-slate-400 dark:text-slate-500">Pilih Rentang Cepat</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {shortcuts(today).map((s) => {
                      const on = activeShortcutKeys.has(s.key);
                      return (
                        <Link
                          key={s.key}
                          href={laporanUrl({ ...s.params })}
                          aria-current={on ? "true" : undefined}
                          className={`chip shrink-0 transition-colors ${
                            on
                              ? "flex items-center gap-1.5 border-[color:var(--pf-accent)] bg-[color:var(--pf-accent-soft)] text-[color:var(--pf-accent-strong)]"
                              : "border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-teal-50"
                          } px-2.5 py-1.5 text-[11px] font-semibold`}
                        >
                          {on ? <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--pf-accent-strong)]" aria-hidden /> : null}
                          {s.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-slate-100/70 px-3 py-2.5 text-[11.5px] font-medium text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <Info size={13} className="shrink-0 text-[color:var(--pf-accent-strong)]" />
                  Data dihitung dari invoice berstatus Terbit — draft, batal, estimasi, SJ, dan PO tidak dihitung.
                </div>
              </div>
            </div>
        </section>

        {/* ==== KPI ==== 5 kartu: refund ikut ringkasan supaya uang keluar
            terlihat di samping omzet, bukan sesudah mengejar tab Pembayaran. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard
            tint="bg-teal-50 border-teal-100 dark:bg-teal-950/40 dark:border-teal-900/60"
            labelCls="text-teal-700 dark:text-teal-300"
            iconCls="bg-white text-teal-600 shadow-sm dark:bg-teal-900/60 dark:text-teal-300"
            icon={Wallet}
            label="Omzet"
            value={formatRupiah(rep.omzet)}
            valueCls="text-[color:var(--pf-ink)]"
            delta={deltaOr(rep.omzet, cmp?.omzet)}
          />
          <KpiCard
            tint="bg-emerald-50 border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900/60"
            labelCls="text-emerald-700 dark:text-emerald-300"
            iconCls="bg-white text-emerald-600 shadow-sm dark:bg-emerald-900/60 dark:text-emerald-300"
            icon={ReceiptText}
            label="Jumlah Invoice"
            value={String(rep.count)}
            valueCls="text-[color:var(--pf-ink)]"
            delta={deltaOr(rep.count, cmp?.count)}
          />
          <KpiCard
            tint="bg-violet-50 border-violet-100 dark:bg-violet-950/40 dark:border-violet-900/60"
            labelCls="text-violet-700 dark:text-violet-300"
            iconCls="bg-white text-violet-600 shadow-sm dark:bg-violet-900/60 dark:text-violet-300"
            icon={TrendingUp}
            label="Rata-rata / Invoice"
            value={formatRupiah(Math.round(rep.avg))}
            valueCls="text-[color:var(--pf-ink)]"
            delta={deltaOr(rep.avg, cmp?.avg)}
          />
          <KpiCard
            tint="bg-rose-50 border-rose-100 dark:bg-rose-950/40 dark:border-rose-900/60"
            labelCls="text-rose-700 dark:text-rose-300"
            iconCls="bg-white text-rose-600 shadow-sm dark:bg-rose-900/60 dark:text-rose-300"
            icon={CircleAlert}
            label="Belum Dibayar"
            value={formatRupiah(rep.piutang)}
            valueCls="text-rose-600"
            delta={deltaOr(rep.piutang, cmp?.piutang, false)}
          />
          <KpiCard
            tint="bg-amber-50 border-amber-100 dark:bg-amber-950/40 dark:border-amber-900/60"
            labelCls="text-amber-700 dark:text-amber-300"
            iconCls="bg-white text-amber-600 shadow-sm dark:bg-amber-900/60 dark:text-amber-300"
            icon={RotateCcw}
            label="Refund · Keluar"
            value={formatRupiah(refund?.total ?? 0)}
            valueCls="text-amber-700 dark:text-amber-300"
            delta={<p className="text-[11px] text-slate-400">{refund?.count ?? 0} pengajuan terkirim</p>}
          />
        </div>

        {/* ==== ISI PER TAB ==== */}
        {tab === "ringkasan" ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
              <section className="card flex flex-col p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Tren Penjualan per {weekly ? "Minggu" : "Hari"}</h2>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-500" aria-hidden /> {period.label}</span>
                    {showCmp && cmpSeries ? (
                      <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-slate-300" aria-hidden /> {cmpSeries.label}</span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 flex-1">
                  <TrendChart series={chartSeries} cmpSeries={cmpSeries} showCmp={showCmp} dailyMode={period.mode === "daily"} />
                </div>
                <p className="mt-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-[color:var(--pf-ink-2)] dark:bg-slate-800/60">
                  <TrendingUp size={14} className="shrink-0 text-teal-600 dark:text-teal-400" />
                  {best.value > 0 ? `Tertinggi ${best.title} · ${formatRupiah(best.value)}` : `Belum ada invoice pada periode ini${weekly ? " · grafik per minggu" : ""}.`}
                </p>
              </section>

              <section className="card flex flex-col p-4">
                <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Distribusi Status Pembayaran</h2>
                <div className="mt-2 flex flex-1 flex-col items-center justify-center gap-4 lg:flex-row">
                  <StatusDonut count={rep.count} lunas={rep.lunasCount} />
                  <ul className="w-full max-w-[260px] space-y-2">
                    <DonutLegendItem dotClass="bg-teal-600 dark:bg-teal-500" label="Lunas" count={rep.lunasCount} pct={pctStr(rep.lunasCount, rep.count)} />
                    <DonutLegendItem dotClass="bg-teal-100 dark:bg-teal-900/60" label="Belum Dibayar" count={Math.max(0, rep.count - rep.lunasCount)} pct={pctStr(Math.max(0, rep.count - rep.lunasCount), rep.count)} />
                  </ul>
                </div>
                <p className="mt-2 flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 dark:bg-teal-950/50 dark:text-teal-200">
                  <TrendingUp size={14} className="shrink-0" />
                  Tingkat pelunasan: {lunasPct}%
                </p>
              </section>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <section className="card flex flex-col p-4">
                <header className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Produk Terlaris</h2>
                  <Link href={laporanUrl({ tab: "produk" })} className="text-xs font-semibold text-[color:var(--pf-accent-strong)] hover:underline">Lihat semua</Link>
                </header>
                <div className="flex-1">
                  <RankList rows={topKirimTop5} kind="produk" />
                </div>
                <Link href={laporanUrl({ tab: "produk" })} className="mt-4 flex items-center justify-between rounded-xl border border-[color:var(--pf-line-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--pf-ink-2)] transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  Lihat semua produk <ArrowRight size={13} />
                </Link>
              </section>

              <section className="card flex flex-col p-4">
                <header className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Pelanggan Teratas</h2>
                  <Link href={laporanUrl({ tab: "pelanggan" })} className="text-xs font-semibold text-[color:var(--pf-accent-strong)] hover:underline">Lihat semua</Link>
                </header>
                <div className="flex-1">
                  <RankList rows={topCustTop5} kind="pelanggan" />
                </div>
                <Link href={laporanUrl({ tab: "pelanggan" })} className="mt-4 flex items-center justify-between rounded-xl border border-[color:var(--pf-line-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--pf-ink-2)] transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  Lihat semua pelanggan <ArrowRight size={13} />
                </Link>
              </section>

              <section className="card flex flex-col p-4 md:col-span-2 xl:col-span-1">
                <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Ringkasan Pembayaran</h2>
                <dl className="mt-2">
                  <div className="flex items-center justify-between border-b border-[color:var(--pf-line-soft)] py-2 text-[13px]">
                    <dt className="text-[color:var(--pf-ink-2)]">Total Tagihan</dt>
                    <dd className="font-bold text-[color:var(--pf-ink)]">{formatRupiah(rep.omzet)}</dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-[color:var(--pf-line-soft)] py-2 text-[13px]">
                    <dt className="text-[color:var(--pf-ink-2)]">Total Dibayar</dt>
                    <dd className="font-bold text-[color:var(--pf-ink)]">{formatRupiah(rep.terbayar)}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2 text-[13px]">
                    <dt className="text-[color:var(--pf-ink-2)]">Sisa Tagihan</dt>
                    <dd className={`font-bold ${rep.piutang > 0 ? "text-rose-600" : "text-[color:var(--pf-ink)]"}`}>{formatRupiah(rep.piutang)}</dd>
                  </div>
                </dl>
                <div className="mt-1.5 rounded-xl bg-teal-50 px-3 py-2.5 dark:bg-teal-950/50">
                  <div className="flex items-center justify-between text-[12.5px] font-semibold text-teal-900 dark:text-teal-200">
                    <span>Tingkat Pelunasan</span>
                    <span>{lunasPct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-teal-100 dark:bg-teal-900/60">
                    <div className="h-full rounded-full bg-teal-600 dark:bg-teal-500" style={{ width: `${Math.max(2, Math.min(100, Math.round((rep.omzet ? (rep.terbayar / rep.omzet) * 100 : 0))))}%` }} />
                  </div>
                </div>
                <p className="mt-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Metode Pembayaran</p>
                <p className="text-[10px] text-slate-400">Klik metode untuk melihat daftar transaksinya.</p>
                <ul className="mt-1.5 space-y-1.5">
                  {rep.methods.length ? (
                    rep.methods.map((m, i) => <MethodRow key={`${m.name}-${i}`} row={m} omzet={rep.omzet} href={bayarUrl({ tab: "pembayaran", metode: m.name })} />)
                  ) : (
                    <li className="text-xs text-slate-400">Belum ada data pada periode ini.</li>
                  )}
                </ul>
              </section>
            </div>
          </>
        ) : null}

        {tab === "penjualan" ? (
          /* ==== TABEL TRANSAKSI PENJUALAN (pengganti grafik, diminta owner)
             ==== Daftar per transaksi dengan mode halaman seperti rekap
             kasir di aplikasi POS. Sumber data sama dengan kartu KPI
             (invoice terbit per issue_date), diurut dari yang terbaru. */
          <section className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Transaksi Penjualan</h2>
              <p className="text-xs text-slate-500">{period.label} · dari yang terbaru</p>
            </div>

            {!sales ? (
              <p className="py-6 text-center text-xs text-slate-400">Data transaksi tidak terbaca — coba muat ulang halaman.</p>
            ) : !sales.rows.length ? (
              sales.count > 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  Halaman melewati daftar.{" "}
                  <Link href={laporanUrl({ hal: "1", per: String(sales.per) })} className="font-bold text-[color:var(--pf-accent-strong)] hover:underline">
                    Kembali ke halaman 1
                  </Link>
                  .
                </p>
              ) : (
                <p className="py-6 text-center text-xs text-slate-400">Belum ada transaksi pada periode ini.</p>
              )
            ) : (
              <>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[color:var(--pf-line-soft)] text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-2 pr-3">No Transaksi</th>
                        <th className="py-2 pr-3">Waktu Order</th>
                        <th className="py-2 pr-3">Waktu Bayar</th>
                        <th className="py-2 pr-3">Pelanggan</th>
                        <th className="py-2 pr-3 text-right">Total Penjualan (Rp)</th>
                        <th className="py-2 pr-3">Metode</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Bayar</th>
                        <th className="py-2 pr-3">Order</th>
                        <th className="py-2"><span className="sr-only">Lihat</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[color:var(--pf-line-soft)]">
                      {sales.rows.map((r) => (
                        <tr key={r.id} className="align-middle hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 pr-3 font-bold text-[color:var(--pf-ink)]">
                            <Link href={`/invoice/${r.id}`} className="hover:underline">{r.number || `#${r.id}`}</Link>
                          </td>
                          <td className="whitespace-nowrap py-2.5 pr-3 text-[12px] text-slate-500">{tsLabel(r.createdAt)}</td>
                          <td className="whitespace-nowrap py-2.5 pr-3 text-[12px] text-slate-500">{r.paidAt ? tsLabel(r.paidAt) : "—"}</td>
                          <td className="max-w-[190px] truncate py-2.5 pr-3 text-[color:var(--pf-ink-2)]" title={r.customer}>{r.customer}</td>
                          <td className="whitespace-nowrap py-2.5 pr-3 text-right font-bold text-[color:var(--pf-ink)]">{formatRupiah(r.total)}</td>
                          <td className="py-2.5 pr-3 text-[12px] text-slate-600 dark:text-slate-300">{r.method}</td>
                          <td className="py-2.5 pr-3">{payStatusChip({ lunas: r.status === "lunas", paid: r.status === "sebagian" ? 1 : 0 })}</td>
                          <td className="py-2.5 pr-3 text-[12px] text-slate-600 dark:text-slate-300">{r.paidBy || "—"}</td>
                          <td className="py-2.5 pr-3 text-[12px] text-slate-600 dark:text-slate-300">{r.orderedBy || "—"}</td>
                          <td className="py-2.5">
                            <Link href={`/invoice/${r.id}`} aria-label={`Buka invoice ${r.number || r.id}`} title="Lihat invoice" className="inline-flex text-slate-400 transition-colors hover:text-[color:var(--pf-accent-strong)]">
                              <Eye size={15} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {(() => {
                  /* ==== MODE HALAMAN (seperti rekap kasir POS): pilihan isi
                     halaman + rentang baris + nomor + Selanjutnya + Ke
                     Halaman. Semua form GET murni HTML — pilihan terlihat
                     di alamat dan bisa dibagikan. */
                  const pageBase = { ...periodParams(period), banding, ...carry };
                  const hidden = Object.entries(pageBase).map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                  ));
                  const firstRow = (sales.page - 1) * sales.per + 1;
                  const lastRow = firstRow + sales.rows.length - 1;
                  const pageHref = (n: number) => laporanUrl({ hal: String(n), per: String(sales.per) });
                  const num = (n: number) => n.toLocaleString("id-ID");
                  const chipIdle = "min-w-[26px] rounded-lg px-2 py-1 text-center font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800";
                  return (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-t border-[color:var(--pf-line-soft)] pt-3 text-xs text-slate-500">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <form action="/invoice/laporan" method="get" className="flex items-center gap-1.5">
                          {hidden}
                          <label htmlFor="tx-per" className="whitespace-nowrap">Tampilkan:</label>
                          <select id="tx-per" name="per" defaultValue={String(sales.per)} className="rounded-lg border border-[color:var(--pf-line-soft)] bg-white px-1.5 py-1 text-xs text-[color:var(--pf-ink)] dark:bg-slate-900">
                            <option value="10">10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                          </select>
                          <button type="submit" className="whitespace-nowrap rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">Terapkan</button>
                        </form>
                        <span>
                          Ditampilkan {num(firstRow)} – {num(lastRow)} dari <span className="font-bold text-[color:var(--pf-ink)]">{num(sales.count)}</span> data
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {sales.page > 1 ? (
                          <Link href={pageHref(sales.page - 1)} className="whitespace-nowrap rounded-lg px-2 py-1 font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">‹ Sebelumnya</Link>
                        ) : null}
                        {pageList(sales.page, sales.pages).map((n, i) =>
                          n === "..." ? (
                            <span key={`gap-${i}`} className="px-0.5 text-slate-400">…</span>
                          ) : n === sales.page ? (
                            <span key={`cur-${n}`} aria-current="page" className="rounded-lg bg-[color:var(--pf-accent)] px-2 py-1 text-center font-bold text-white">{n}</span>
                          ) : (
                            <Link key={`n-${n}`} href={pageHref(n)} className={chipIdle}>{n}</Link>
                          ),
                        )}
                        {sales.page < sales.pages ? (
                          <Link href={pageHref(sales.page + 1)} className="flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                            Selanjutnya <ArrowRight size={12} />
                          </Link>
                        ) : null}
                        <form action="/invoice/laporan" method="get" className="flex items-center gap-1 pl-1" title={`1 – ${sales.pages}`}>
                          {hidden}
                          <input type="hidden" name="per" value={String(sales.per)} />
                          <input type="number" name="hal" min={1} max={sales.pages} defaultValue={sales.page} aria-label="Ke halaman" className="w-14 rounded-lg border border-[color:var(--pf-line-soft)] bg-white px-1.5 py-1 text-xs text-[color:var(--pf-ink)] dark:bg-slate-900" />
                          <button type="submit" title="Ke Halaman" aria-label="Ke Halaman" className="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                            <ArrowRight size={13} />
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </section>
        ) : null}

        {tab === "produk" ? (
          <section className="card p-4">
            <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Produk Terlaris</h2>
            <p className="mb-4 text-xs text-slate-500">Urut berdasarkan nilai penjualan terbesar pada {period.label.toLowerCase()}.</p>
            <RankList rows={rep.products} kind="produk" />
          </section>
        ) : null}

        {tab === "pelanggan" ? (
          <section className="card p-4">
            <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Pelanggan Teratas</h2>
            <p className="mb-4 text-xs text-slate-500">Pemilik invoice dengan tagihan terbesar pada {period.label.toLowerCase()}.</p>
            <RankList rows={rep.customers} kind="pelanggan" />
          </section>
        ) : null}

        {tab === "pembayaran" ? (
          metode && ledger ? (
            /* ==== BUKU SATU METODE: rekap + daftar transaksi ==== */
            <section id={BAYAR_ANCHOR} className="card scroll-mt-24 p-4">
              <header className="flex flex-wrap items-center gap-2">
                <Link href={bayarUrl({ tab: "pembayaran", metode: "" })} className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-semibold text-[color:var(--pf-ink-2)] hover:bg-slate-50 hover:text-[color:var(--pf-ink)] dark:hover:bg-slate-800/60">
                  <ChevronLeft size={14} /> Semua metode
                </Link>
                <span aria-hidden className="text-slate-300">/</span>
                <h2 className="flex items-center gap-2 text-sm font-bold text-[color:var(--pf-ink)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{methodIconEl(metode)}</span>
                  {metode}
                </h2>
              </header>
              <p className="text-xs text-slate-500">Transaksi metode pembayaran ini pada {period.label.toLowerCase()}.</p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Invoice</p>
                  <p className="mt-0.5 text-[15px] font-extrabold text-[color:var(--pf-ink)]">{ledger.count}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-2.5 dark:bg-emerald-950/40">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-700/80 dark:text-emerald-300/80">Dibayar</p>
                  <p className="mt-0.5 text-[15px] font-extrabold text-emerald-700 dark:text-emerald-300">{formatRupiah(ledger.paid)}</p>
                </div>
                <div className="rounded-xl bg-rose-50 p-2.5 dark:bg-rose-950/40">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-rose-700/80 dark:text-rose-300/80">Sisa</p>
                  <p className="mt-0.5 text-[15px] font-extrabold text-rose-600">{formatRupiah(ledger.due)}</p>
                </div>
              </div>

              <p className="mt-4 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Daftar Transaksi</p>
              {ledger.rows.length ? (
                <>
                  <ul className="divide-y divide-[color:var(--pf-line-soft)] border-t border-[color:var(--pf-line-soft)]">
                    {ledger.rows.map((r) => (
                      <TxRow key={r.number} r={r} />
                    ))}
                  </ul>
                  {ledger.count > ledger.rows.length ? (
                    <p className="mt-2 text-[11px] text-slate-400">Menampilkan 60 terbaru dari {ledger.count} transaksi. Rekap lengkapnya di kartu di atas.</p>
                  ) : null}
                </>
              ) : (
                <p className="py-4 text-xs text-slate-400">Belum ada transaksi metode ini pada periode ini.</p>
              )}
            </section>
          ) : (
            /* ==== BUKTI ALAMAT: kartu per metode ==== */
            <section id={BAYAR_ANCHOR} className="card scroll-mt-24 p-4">
              <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Metode Pembayaran</h2>
              <p className="mt-0.5 mb-3 text-xs text-slate-500">Pilih metode untuk melihat daftar transaksinya pada {period.label.toLowerCase()}.</p>
              {rep.methods.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {rep.methods.map((m) => (
                    <Link
                      key={m.name}
                      href={bayarUrl({ tab: "pembayaran", metode: m.name })}
                      className="group flex items-start gap-3 rounded-xl border border-[color:var(--pf-line-soft)] p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {methodIconEl(m.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center justify-between gap-2 text-[13px] font-semibold text-[color:var(--pf-ink)]">
                          <span className="min-w-0 truncate">{m.name}</span>
                          <ChevronRight size={14} className="shrink-0 text-slate-300 transition-colors group-hover:text-teal-600" aria-hidden />
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">{m.count} invoice</p>
                        <p className="mt-1 text-[13px] font-bold text-[color:var(--pf-ink)]">{formatRupiah(m.amount)}</p>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/50">
                          <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.max(4, Math.round((rep.omzet ? (m.amount / rep.omzet) * 100 : 0)))}%` }} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-xs text-slate-400">Belum ada invoice pada periode ini.</p>
              )}
            </section>
          )
        ) : null}

        {tab === "pembayaran" && refund ? (
          /* ==== REFUND · UANG KELUAR (Mode A) ====
             Tagihan tidak berubah oleh refund — kartu ini menunjukkan arus
             keluarnya lalu menyimpulkan kas masuk neto. Riwayatnya punya
             tab tersendiri: Refund. */
          <section className="card scroll-mt-24 p-4">
            <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Refund · Uang Keluar</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Uang yang kembali ke pelanggan pada {period.label.toLowerCase()} — dibaca per tanggal uang benar-benar keluar, bukan tanggal ajukan. Nilai invoice dan sisa tagihan tidak berubah oleh refund.
            </p>
            <RefundTiles dibayar={rep.terbayar} refund={refund} />
            <p className="mt-4 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Daftar Refund Terkirim</p>
            <RefundRows refund={refund} />
          </section>
        ) : null}

        {tab === "refund" ? (
          /* ==== HALAMAN REFUND — diminta owner: detail uang keluar jadi
             tab sendiri di bawah Pembayaran. Ringkasan neto + daftar per
             pengajuan, angkanya dihitung ulang server setiap muat. */
          <div className="space-y-4">
            <section className="card p-4">
              <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Ringkasan Uang Keluar</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Kas masuk neto = uang yang dibayar invoice terbit dikurangi refund yang sudah terkirim pada {period.label.toLowerCase()}.
              </p>
              {refund ? <RefundTiles dibayar={rep.terbayar} refund={refund} /> : null}
            </section>

            <section className="card p-4">
              <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Daftar Refund Terkirim</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Refund diajukan dari panel Refund di halaman detail invoice, disetujui Owner, lalu ditandai terkirim. Pengajuan yang belum terkirim tidak dihitung di sini.
              </p>
              {refund ? (
                <div className="mt-2">
                  <RefundRows refund={refund} />
                </div>
              ) : (
                <p className="py-4 text-xs text-slate-400">Data refund tidak terbaca — coba muat ulang halaman.</p>
              )}
            </section>
          </div>
        ) : null}

        <TipsBanner title="Tips Membaca Laporan" body="Gunakan filter periode dan pilihan Bandingkan Dengan untuk melihat tren dari waktu ke waktu. Semua data dihitung langsung dari database aplikasi." />

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <p className="flex items-center gap-1.5">
            <Info size={13} /> Data diperbarui real-time. Dihitung dari invoice berstatus Terbit.
          </p>
          <p>{period.label}{showCmp ? ` · pembanding: ${cmpLabel}` : ""}</p>
        </div>
      </div>
    </InvoiceFrame>
  );
}
