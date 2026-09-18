import Link from "next/link";
import { ClipboardList, Filter, Package, Plus, RotateCcw, Search, SlidersHorizontal, UserRound, X } from "lucide-react";
import { ProblemScreen } from "@/components/ProblemScreen";
import { PhotoQuickPeek } from "@/components/PhotoQuickPeek";
import { QuickStatusPopup } from "@/components/QuickStatusPopup";
import { DeadlineChip, PriorityBadge, ProgressBar, RiskBadge, StageRail, StatusBadge } from "@/components/ui";
import { analyzeOrder } from "@/lib/ai";
import { safeDb } from "@/lib/dbcheck";
import { photoCounts } from "@/lib/queries";
import { outsourceCounts } from "@/lib/outsource-queries";
import { outsourceStatusMeta } from "@/lib/outsource";
import {
  MACHINES,
  STATUSES,
  deadlineOf,
  formatDateID,
  formatRupiah,
  humanDuration,
  statusMeta,
} from "@/lib/domain";
import { listOrders } from "@/lib/queries";
import { summarizeItems } from "@/lib/order-items";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ scope?: string; status?: string; q?: string; machine?: string }>;

const TABS = [
  { key: "aktif", label: "Sedang Jalan" },
  { key: "semua", label: "Semua" },
  { key: "selesai", label: "Selesai / Batal" },
];

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const scope = (sp.scope === "semua" || sp.scope === "selesai" ? sp.scope : "aktif") as
    | "aktif"
    | "semua"
    | "selesai";
  const status = sp.status ?? "all";
  const q = sp.q ?? "";
  const machine = sp.machine ?? "all";

  const result = await safeDb(async () => {
    const rows = await listOrders({ scope, status, q, machine });
    const ids = rows.map((r) => r.id);
    const [counts, outsourced] = await Promise.all([photoCounts(ids), outsourceCounts(ids)]);
    return { rows, counts, outsourced };
  });
  if (!result.ok) {
    return <ProblemScreen problem={result.problem} hint="Daftar pekerjaan disimpan di database, jadi database harus siap dulu." />;
  }
  const orders = result.data.rows;
  const photoCountsMap = result.data.counts;
  const outsourceMap = result.data.outsourced;
  const now = new Date();

  // Chip filter aktif: supaya pengguna tahu persis kenapa daftarnya sedikit,
  // dan bisa melepas satu filter tanpa mengulang dari awal.
  const activeFilters: { label: string; href: string }[] = [];
  if (status !== "all") {
    activeFilters.push({
      label: `Status: ${statusMeta(status).short}`,
      href: `/pesanan?scope=${scope}&q=${encodeURIComponent(q)}&machine=${encodeURIComponent(machine)}`,
    });
  }
  if (machine !== "all") {
    activeFilters.push({
      label: `Mesin: ${machine}`,
      href: `/pesanan?scope=${scope}&q=${encodeURIComponent(q)}&status=${status}`,
    });
  }
  if (q.trim()) {
    activeFilters.push({
      label: `Kata kunci: "${q.trim()}"`,
      href: `/pesanan?scope=${scope}&status=${status}&machine=${encodeURIComponent(machine)}`,
    });
  }
  const totalValue = orders.reduce((sum, o) => sum + (o.price || 0), 0);

  return (
    <div className="space-y-4">
      {/* ===================== JUDUL HALAMAN ===================== */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(150deg,#0d9488,#0f766e)] text-white shadow-[0_10px_24px_-12px_rgba(13,148,136,.9)] md:h-11 md:w-11">
            <ClipboardList size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-tight text-[#07384f] md:text-2xl dark:text-slate-100">
              Daftar Pekerjaan
            </h1>
            <p className="money text-xs font-semibold text-slate-500">
              {orders.length} pekerjaan ·{" "}
              <span className="text-teal-700 dark:text-teal-300">{formatRupiah(totalValue)}</span> nilai tampil ·{" "}
              <span className="hidden sm:inline">diurutkan dari deadline terdekat</span>
            </p>
          </div>
        </div>
        <Link href="/pesanan/baru" className="btn-primary shrink-0">
          <Plus size={16} strokeWidth={3} /> Pekerjaan Baru
        </Link>
      </header>

      {/* ===================== FILTER ===================== */}
      <div className="card sticky top-[3.6rem] z-20 !p-2.5 shadow-[var(--shadow-card)] md:!p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg">
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                href={`/pesanan?scope=${tab.key}`}
                data-active={scope === tab.key}
                className="seg-item"
              >
                {tab.label}
              </Link>
            ))}
          </div>

          <form className="flex min-w-0 flex-1 flex-wrap items-center gap-2" action="/pesanan" method="get">
            <input type="hidden" name="scope" value={scope} />
            <label className="relative min-w-[190px] flex-1 sm:max-w-xs">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Cari kode, pekerjaan, atau pelanggan…"
                className="input pl-9"
                aria-label="Cari pekerjaan"
              />
            </label>
            <label className="relative">
              <Filter size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select name="status" defaultValue={status} className="input appearance-none pl-8 sm:max-w-[180px]" aria-label="Saring berdasarkan status">
                <option value="all">Semua status</option>
                {STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.emoji} {s.short}
                  </option>
                ))}
              </select>
            </label>
            <label className="relative">
              <SlidersHorizontal size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select name="machine" defaultValue={machine} className="input appearance-none pl-8 sm:max-w-[190px]" aria-label="Saring berdasarkan mesin">
                <option value="all">Semua mesin</option>
                {MACHINES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-secondary btn-sm">
              Terapkan
            </button>
            {activeFilters.length > 0 ? (
              <Link href={`/pesanan?scope=${scope}`} className="btn-ghost btn-sm">
                <RotateCcw size={13} /> Reset
              </Link>
            ) : null}
          </form>
        </div>

        {activeFilters.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2 dark:border-white/[0.07]">
            <span className="text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-400">Filter aktif</span>
            {activeFilters.map((f) => (
              <Link
                key={f.label}
                href={f.href}
                className="chip !gap-1 border-teal-200 bg-teal-50 text-teal-800 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-teal-400/30 dark:bg-teal-500/12 dark:text-teal-200"
              >
                {f.label}
                <X size={11} />
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {orders.length === 0 ? (
        <div className="card flex flex-col items-center px-5 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(150deg,#f1f5f9,#e2e8f0)] text-slate-400">
            <Search size={26} />
          </span>
          <p className="mt-3 text-base font-extrabold text-[#07384f] dark:text-slate-100">Tidak ada pekerjaan yang cocok</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Coba longgarkan filter di atas, atau langsung buat pekerjaan baru supaya mulai terpantau.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href={`/pesanan?scope=${scope}`} className="btn-ghost">
              <RotateCcw size={14} /> Hapus filter
            </Link>
            <Link href="/pesanan/baru" className="btn-primary">
              <Plus size={15} strokeWidth={3} /> Buat Pekerjaan
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* ===================== MOBILE: KARTU ===================== */}
          <div className="grid gap-3 md:hidden">
            {orders.map((order) => {
              const insight = analyzeOrder(order, now);
              const outsource = outsourceMap.get(order.id);
              return (
                <Link key={order.id} href={`/pesanan/${order.id}`} className="card card-hover block overflow-hidden !p-0">
                  <span className={`block h-1 w-full ${statusMeta(order.status).bar}`} aria-hidden="true" />
                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5">
                          <span className="money text-[11px] font-black tracking-wide text-teal-700 dark:text-teal-300">{order.code}</span>
                          <PriorityBadge priority={order.priority} />
                        </p>
                        <p className="mt-1 line-clamp-2 text-[15px] font-black leading-snug text-[#07384f] dark:text-slate-100">{order.title}</p>
                        <p className="truncate text-xs font-semibold text-slate-500">{order.customerName}</p>
                      </div>
                      <QuickStatusPopup
                        orderId={order.id}
                        orderCode={order.code}
                        orderTitle={order.title}
                        currentStatus={order.status}
                        hasOutsource={Boolean(outsource)}
                        trigger={<StatusBadge status={order.status} />}
                      />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Package size={12} className="shrink-0 text-slate-400" />
                        <span className="truncate">{summarizeItems(order.items)}</span>
                        {order.items.length > 1 ? (
                          <span className="shrink-0 rounded-full bg-teal-50 px-1.5 py-px text-[10px] font-extrabold text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                            {order.items.length} produk
                          </span>
                        ) : null}
                      </span>
                      <span className={`inline-flex items-center gap-1 font-bold ${order.operator ? "text-teal-700 dark:text-teal-300" : "text-amber-600 dark:text-amber-300"}`}>
                        <UserRound size={12} /> {order.operator || "PIC belum diisi"}
                      </span>
                    </div>

                    {outsource ? (
                      <span className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${outsourceStatusMeta(outsource.status).color}`}>
                        🏭 {outsource.partnerName} · {outsourceStatusMeta(outsource.status).label}
                      </span>
                    ) : null}

                    <div className="mt-3"><StageRail status={order.status} /></div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <DeadlineChip dueDate={order.dueDate} dueTime={order.dueTime} hoursLeft={insight.hoursLeft} />
                      <span className="flex items-center gap-2">
                        <span className="money text-[11px] font-extrabold text-slate-700 dark:text-slate-200">{formatRupiah(order.price)}</span>
                        <RiskBadge level={insight.riskLevel} score={insight.riskScore} />
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <PhotoQuickPeek orderId={order.id} code={order.code} count={photoCountsMap.get(order.id) ?? 0} />
                        {order.machine}
                      </span>
                      <span className="money font-bold text-slate-500">{insight.progress}%</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* ===================== DESKTOP: TABEL ===================== */}
          <div className="card hidden overflow-hidden !p-0 md:block">
            <div className="max-h-[calc(100vh-13rem)] overflow-auto scroll-x">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,#f7fbfb,#f1f8f8)] text-[10px] uppercase tracking-[.08em] text-slate-500 shadow-[inset_0_-1px_0_var(--line)] dark:bg-[#132a37]">
                  <tr>
                    <th className="px-4 py-2.5 font-extrabold">Kode / Pekerjaan</th>
                    <th className="px-3 py-2.5 font-extrabold">Pelanggan</th>
                    <th className="px-3 py-2.5 font-extrabold">Status</th>
                    <th className="w-40 px-3 py-2.5 font-extrabold">Progres</th>
                    <th className="px-3 py-2.5 font-extrabold">Deadline</th>
                    <th className="px-3 py-2.5 font-extrabold">Prioritas</th>
                    <th className="px-3 py-2.5 text-right font-extrabold">Nilai</th>
                    <th className="px-4 py-2.5 text-right font-extrabold">Risiko</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {orders.map((order) => {
                    const insight = analyzeOrder(order, now);
                    const msLeft = deadlineOf(order.dueDate, order.dueTime).getTime() - now.getTime();
                    const late = msLeft < 0 && !statusMeta(order.status).done;
                    const outsource = outsourceMap.get(order.id);
                    const photos = photoCountsMap.get(order.id) ?? 0;
                    return (
                      <tr key={order.id} className="group/row align-top transition-colors hover:bg-teal-50/45 dark:hover:bg-white/[0.04]">
                        <td className="px-4 py-3">
                          <Link href={`/pesanan/${order.id}`} className="font-extrabold text-[#07384f] hover:text-teal-700 dark:text-slate-100 dark:hover:text-teal-300">
                            {order.title}
                          </Link>
                          <p className="money mt-0.5 text-[11px] font-extrabold text-teal-600 dark:text-teal-300">
                            {order.code}
                            {photos > 0 ? (
                              <span className="ml-1.5 rounded-full bg-sky-50 px-1.5 py-px text-[10px] font-bold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" title={`${photos} foto terlampir`}>
                                🖼️ {photos}
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                            <Package size={11} className="shrink-0 text-slate-400" />
                            {summarizeItems(order.items, 3)}
                            {order.items.length > 1 ? (
                              <span className="rounded-full bg-teal-50 px-1.5 py-px text-[10px] font-bold text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                                {order.items.length} produk
                              </span>
                            ) : null}
                          </p>
                          <p className={`mt-0.5 text-[11px] font-bold ${order.operator ? "text-teal-700 dark:text-teal-300" : "text-amber-600 dark:text-amber-300"}`}>
                            PIC: {order.operator || "Belum ditentukan"} · {order.machine}
                          </p>
                          {outsource ? (
                            <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${outsourceStatusMeta(outsource.status).color}`}>
                              🏭 {outsource.partnerName}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{order.customerName}</td>
                        <td className="px-3 py-3">
                          <QuickStatusPopup
                            orderId={order.id}
                            orderCode={order.code}
                            orderTitle={order.title}
                            currentStatus={order.status}
                            hasOutsource={Boolean(outsource)}
                            trigger={<StatusBadge status={order.status} />}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <ProgressBar value={insight.progress} tone={statusMeta(order.status).bar} />
                          <p className="money mt-1 text-[11px] font-bold text-slate-500">{insight.progress}% · {statusMeta(order.status).short}</p>
                        </td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                          {formatDateID(order.dueDate)}
                          <p className={`money text-[11px] font-semibold ${late ? "text-rose-600 dark:text-rose-300" : "text-slate-500"}`}>
                            {order.dueTime} ·{" "}
                            {msLeft < 0
                              ? `telat ${humanDuration(msLeft / 3_600_000)}`
                              : `sisa ${humanDuration(msLeft / 3_600_000)}`}
                          </p>
                        </td>
                        <td className="px-3 py-3"><PriorityBadge priority={order.priority} /></td>
                        <td className="money px-3 py-3 text-right font-extrabold text-slate-800 dark:text-slate-100">{formatRupiah(order.price)}</td>
                        <td className="px-4 py-3 text-right">
                          <RiskBadge level={insight.riskLevel} score={insight.riskScore} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.03]">
              <span>Klik badge status untuk mengubah tanpa pindah halaman.</span>
              <span className="money font-bold">
                Total nilai tampil: <span className="text-teal-700 dark:text-teal-300">{formatRupiah(totalValue)}</span>
              </span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
