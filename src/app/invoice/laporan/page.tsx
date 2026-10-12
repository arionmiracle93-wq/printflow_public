import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowUp, BarChart3, ChevronLeft, ChevronRight, Download, Minus } from "lucide-react";
import { InvoiceFrame, InvoiceSidebar } from "@/components/InvoiceSidebar";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { formatRupiah, jakartaDateISO } from "@/lib/domain";
import { getInvoiceAccess } from "@/lib/invoice-access";
import { addDays, buildBuckets, buildPeriod, shiftMonthKey, shortcuts, type Period } from "@/lib/invoice-period";
import { getReport, type RankRow } from "@/lib/invoice-reports";
import { getInvoiceSettings } from "@/lib/invoice-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Laporan Invoice - Print Flow" };

type SP = { mode?: string; bulan?: string; tanggal?: string; dari?: string; sampai?: string };

function qs(params: Record<string, string>) {
  return new URLSearchParams(params).toString();
}

function periodParams(p: Period): Record<string, string> {
  if (p.mode === "daily") return { mode: "daily", tanggal: p.from };
  if (p.mode === "range") return { mode: "range", dari: p.from, sampai: p.to };
  return { mode: "monthly", bulan: p.from.slice(0, 7) };
}

function Delta({ cur, prev, label }: { cur: number; prev: number; label: string }) {
  if (prev === 0 && cur === 0) return <p className="text-[11px] text-slate-400">— sama seperti {label}</p>;
  if (prev === 0) return <p className="text-[11px] font-semibold text-emerald-600">Baru · {label} kosong</p>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return <p className="flex items-center gap-1 text-[11px] text-slate-500"><Minus size={11} /> Sama dengan {label}</p>;
  const up = pct > 0;
  return (
    <p className={`flex items-center gap-1 text-[11px] font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />} {Math.abs(pct)}% vs {label}
    </p>
  );
}

function RankList({ rows, money, extra }: { rows: RankRow[]; money?: boolean; extra: (r: RankRow) => string }) {
  if (!rows.length) return <p className="text-xs text-slate-400">Belum ada data pada periode ini.</p>;
  const max = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="min-w-0 truncate font-semibold text-[color:var(--pf-ink)]">{r.name}</span>
            <span className="shrink-0 font-bold text-[color:var(--pf-ink)]">{money === false ? "" : formatRupiah(r.amount)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/50">
            <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.max(4, Math.round((r.amount / max) * 100))}%` }} />
          </div>
          <p className="mt-0.5 text-[10.5px] text-slate-400">{extra(r)}</p>
        </li>
      ))}
    </ul>
  );
}

export default async function InvoiceReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const today = jakartaDateISO();
  const period = buildPeriod(sp, today);

  const loaded = await safeDb(async () => {
    const access = await getInvoiceAccess();
    // Laporan omzet hanya untuk Owner.
    if (!access || !access.isOwner) return null;
    const [settings, rep, prev] = await Promise.all([
      getInvoiceSettings(),
      getReport(period.from, period.to),
      getReport(period.prevFrom, period.prevTo),
    ]);
    return { settings, rep, prev };
  });
  if (!loaded.ok) return <ProblemScreen problem={loaded.problem} hint="Laporan dihitung dari data invoice di database." />;
  if (!loaded.data) redirect("/tidak-diizinkan");
  const { settings, rep, prev } = loaded.data;

  const { buckets, weekly } = buildBuckets(period, rep.byDay);
  const maxBar = Math.max(...buckets.map((b) => b.value), 1);
  const best = buckets.reduce((a, b) => (b.value > a.value ? b : a), { label: "", title: "", value: 0 });
  const csvHref = `/api/invoices/report-csv?${qs(periodParams(period))}`;

  const modeLink = (mode: "monthly" | "daily" | "range") => {
    const base: Record<string, string> = mode === "monthly" ? { mode, bulan: today.slice(0, 7) } : mode === "daily" ? { mode, tanggal: today } : { mode, dari: addDays(today, -29), sampai: today };
    return `/invoice/laporan?${qs(period.mode === mode ? periodParams(period) : base)}`;
  };

  const monthKey = period.from.slice(0, 7);
  const nav: { prev: Record<string, string>; next: Record<string, string> } | null =
    period.mode === "monthly"
      ? { prev: { mode: "monthly", bulan: shiftMonthKey(monthKey, -1) }, next: { mode: "monthly", bulan: shiftMonthKey(monthKey, 1) } }
      : period.mode === "daily"
        ? { prev: { mode: "daily", tanggal: addDays(period.from, -1) }, next: { mode: "daily", tanggal: addDays(period.from, 1) } }
        : null;

  return (
    <InvoiceFrame sidebar={<InvoiceSidebar businessName={settings.businessName} isOwner docType="semua" modeBehavior="filter" />}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <BarChart3 size={22} strokeWidth={2.3} /> Laporan
            </h1>
            <p className="text-sm text-slate-500">Dihitung dari Invoice yang sudah terbit (draft, batal, estimasi, SJ, dan PO tidak dihitung).</p>
          </div>
          <a href={csvHref} className="btn-secondary px-3 py-2 text-xs">
            <Download size={14} /> Export CSV
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {([["monthly", "Bulanan"], ["daily", "Harian"], ["range", "Rentang"]] as const).map(([m, l]) => (
            <Link
              key={m}
              href={modeLink(m)}
              className={`chip px-3 py-1.5 text-xs font-semibold ${period.mode === m ? "border-teal-500 bg-teal-500 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {l}
            </Link>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:inline-block" />
          {shortcuts(today).map((s) => (
            <Link key={s.key} href={`/invoice/laporan?${qs(s.params)}`} className="chip border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-teal-50">
              {s.label}
            </Link>
          ))}
        </div>

        <form action="/invoice/laporan" method="get" className="card flex flex-wrap items-end gap-2 p-3">
          <input type="hidden" name="mode" value={period.mode} />
          {period.mode === "monthly" ? (
            <label className="min-w-0 flex-[1_1_180px]">
              <span className="label">Bulan</span>
              <input type="month" name="bulan" defaultValue={monthKey} className="input w-full" />
            </label>
          ) : null}
          {period.mode === "daily" ? (
            <label className="min-w-0 flex-[1_1_180px]">
              <span className="label">Tanggal</span>
              <input type="date" name="tanggal" defaultValue={period.from} className="input w-full" />
            </label>
          ) : null}
          {period.mode === "range" ? (
            <>
              <label className="min-w-0 flex-[1_1_150px]">
                <span className="label">Dari</span>
                <input type="date" name="dari" defaultValue={period.from} className="input w-full" />
              </label>
              <label className="min-w-0 flex-[1_1_150px]">
                <span className="label">Sampai</span>
                <input type="date" name="sampai" defaultValue={period.to} className="input w-full" />
              </label>
            </>
          ) : null}
          <button className="btn-primary px-4">Tampilkan</button>
        </form>

        <div className="flex items-center justify-between gap-2">
          {nav ? (
            <Link href={`/invoice/laporan?${qs(nav.prev)}`} className="btn-ghost px-2.5 py-2" aria-label="Periode sebelumnya"><ChevronLeft size={16} /></Link>
          ) : <span />}
          <p className="text-center text-base font-extrabold text-[color:var(--pf-ink)]">{period.label}</p>
          {nav ? (
            <Link href={`/invoice/laporan?${qs(nav.next)}`} className="btn-ghost px-2.5 py-2" aria-label="Periode berikutnya"><ChevronRight size={16} /></Link>
          ) : <span />}
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="card p-3">
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">Omzet</p>
            <p className="mt-0.5 text-lg font-extrabold text-[color:var(--pf-ink)]">{formatRupiah(rep.omzet)}</p>
            <Delta cur={rep.omzet} prev={prev.omzet} label={period.prevLabel} />
          </div>
          <div className="card p-3">
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">Jumlah invoice</p>
            <p className="mt-0.5 text-lg font-extrabold text-[color:var(--pf-ink)]">{rep.count}</p>
            <Delta cur={rep.count} prev={prev.count} label={period.prevLabel} />
          </div>
          <div className="card p-3">
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">Rata-rata / invoice</p>
            <p className="mt-0.5 text-lg font-extrabold text-[color:var(--pf-ink)]">{formatRupiah(Math.round(rep.avg))}</p>
            <p className="text-[11px] text-slate-400">{rep.lunasCount} dari {rep.count} sudah lunas</p>
          </div>
          <div className="card p-3">
            <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-rose-700">Belum dibayar</p>
            <p className="mt-0.5 text-lg font-extrabold text-rose-600">{formatRupiah(rep.piutang)}</p>
            <p className="text-[11px] text-slate-400">sudah masuk {formatRupiah(rep.terbayar)}</p>
          </div>
        </div>

        {period.mode !== "daily" ? (
          <section className="card p-4">
            <p className="text-sm font-bold text-[color:var(--pf-ink)]">Penjualan {weekly ? "per minggu" : "per hari"}</p>
            <div className="mt-3 flex h-36 items-end gap-[3px]" role="img" aria-label="Grafik penjualan">
              {buckets.map((b, i) => (
                <div key={i} className="flex h-full min-w-0 flex-1 items-end" title={`${b.title}: ${formatRupiah(b.value)}`}>
                  <div
                    className={`w-full rounded-t ${b.value ? "bg-teal-500" : "bg-slate-200 dark:bg-slate-700"}`}
                    style={{ height: `${b.value ? Math.max(4, Math.round((b.value / maxBar) * 100)) : 2}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>{buckets[0]?.label}</span>
              <span>{buckets[Math.floor(buckets.length / 2)]?.label}</span>
              <span>{buckets[buckets.length - 1]?.label}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {best.value > 0 ? `Tertinggi ${best.title} · ${formatRupiah(best.value)}` : "Belum ada invoice pada periode ini."}
              {weekly ? " · Periode lebih dari 60 hari, grafik per minggu (Senin–Minggu)." : ""}
            </p>
          </section>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <section className="card p-4">
            <p className="mb-3 text-sm font-bold text-[color:var(--pf-ink)]">Produk terlaris</p>
            <RankList rows={rep.products} extra={(r) => `${Number.isInteger(r.qty) ? r.qty : r.qty.toFixed(1).replace(".", ",")} pcs · ${r.count} transaksi`} />
          </section>
          <section className="card p-4">
            <p className="mb-3 text-sm font-bold text-[color:var(--pf-ink)]">Pelanggan teratas</p>
            <RankList rows={rep.customers} extra={(r) => `${r.count} invoice`} />
          </section>
        </div>
      </div>
    </InvoiceFrame>
  );
}
