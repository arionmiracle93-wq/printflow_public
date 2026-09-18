import Link from "next/link";
import { ClipboardList, Plus, Search, SearchX } from "lucide-react";
import { ProblemScreen } from "@/components/ProblemScreen";
import { PhotoQuickPeek } from "@/components/PhotoQuickPeek";
import { QuickStatusPopup } from "@/components/QuickStatusPopup";
import { PriorityBadge, ProgressBar, StatusBadge } from "@/components/ui";
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="icon-tile h-11 w-11 rounded-[var(--r-lg)]">
            <ClipboardList size={20} />
          </span>
          <div>
            <h1 className="page-title">Daftar Pekerjaan</h1>
            <p className="page-subtitle">
              <span className="font-bold tabular-nums text-teal-700 dark:text-teal-300">{orders.length}</span> pekerjaan
              ditampilkan · diurutkan dari deadline terdekat
            </p>
          </div>
        </div>
        <Link href="/pesanan/baru" className="btn-primary">
          <Plus size={16} strokeWidth={2.7} /> Pekerjaan Baru
        </Link>
      </div>

      {/* FILTER */}
      <div className="card p-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="segmented w-full overflow-x-auto scroll-x lg:w-auto">
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                href={`/pesanan?scope=${tab.key}`}
                className={`segmented-item whitespace-nowrap ${scope === tab.key ? "segmented-item-active" : ""}`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <form className="flex flex-1 flex-wrap items-center gap-2" action="/pesanan" method="get">
            <input type="hidden" name="scope" value={scope} />
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                name="q"
                defaultValue={q}
                placeholder="Cari kode / pekerjaan / pelanggan…"
                className="input pl-9"
              />
            </div>
            <select name="status" defaultValue={status} className="input sm:max-w-[190px]">
              <option value="all">Semua status</option>
              {STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.emoji} {s.short}
                </option>
              ))}
            </select>
            <select name="machine" defaultValue={machine} className="input sm:max-w-[200px]">
              <option value="all">Semua mesin</option>
              {MACHINES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-ghost">
              <Search size={15} /> Filter
            </button>
          </form>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <span className="flex h-16 w-16 items-center justify-center rounded-[var(--r-xl)] bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
            <SearchX size={30} />
          </span>
          <p className="mt-4 text-sm font-extrabold text-[#07384f]">Tidak ada pekerjaan yang cocok</p>
          <p className="mt-1 text-xs text-slate-500">Coba ubah filter di atas, atau buat pekerjaan baru.</p>
          <Link href="/pesanan/baru" className="btn-primary mt-4">
            <Plus size={16} strokeWidth={2.7} /> Buat Pekerjaan
          </Link>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS */}
          <div className="grid gap-3 md:hidden">
            {orders.map((order) => {
              const insight = analyzeOrder(order, now);
              return (
                <Link key={order.id} href={`/pesanan/${order.id}`} className="card card-hover block p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold text-indigo-600">{order.code}</p>
                      <p className="text-sm font-bold text-slate-900">{order.title}</p>
                      <p className="text-xs text-slate-500">{order.customerName}</p>
                      <p className="text-[11px] text-slate-500">
                        📦 {summarizeItems(order.items)}
                        {order.items.length > 1 ? (
                          <span className="ml-1 rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-700">
                            {order.items.length} produk
                          </span>
                        ) : null}
                      </p>
                      <p className={`mt-1 text-[11px] font-bold ${order.operator ? "text-teal-700" : "text-amber-600"}`}>
                        👤 PIC: {order.operator || "Belum ditentukan"}
                      </p>
                      {outsourceMap.get(order.id) ? (
                        <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${outsourceStatusMeta(outsourceMap.get(order.id)!.status).color}`}>
                          🏭 Mitra: {outsourceMap.get(order.id)!.partnerName}
                        </span>
                      ) : null}
                    </div>
                    <QuickStatusPopup
                      orderId={order.id}
                      orderCode={order.code}
                      orderTitle={order.title}
                      currentStatus={order.status}
                      hasOutsource={Boolean(outsourceMap.get(order.id))}
                      trigger={<StatusBadge status={order.status} />}
                    />
                  </div>
                  <div className="mt-3">
                    <ProgressBar value={insight.progress} tone={statusMeta(order.status).bar} />
                  </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        ⏰ {formatDateID(order.dueDate)} {order.dueTime}
                        <PhotoQuickPeek
                          orderId={order.id}
                          code={order.code}
                          count={photoCountsMap.get(order.id) ?? 0}
                        />
                      </span>
                      <span className={insight.hoursLeft < 0 ? "font-bold text-rose-600" : "font-semibold"}>
                        {insight.hoursLeft < 0
                          ? `telat ${humanDuration(insight.hoursLeft)}`
                          : `sisa ${humanDuration(insight.hoursLeft)}`}
                      </span>
                    </div>
                </Link>
              );
            })}
          </div>

          {/* DESKTOP TABLE */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200/80 bg-slate-50 text-[10.5px] font-extrabold uppercase tracking-[.07em] text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Kode / Pekerjaan</th>
                  <th className="px-4 py-3.5">Pelanggan</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Progres</th>
                  <th className="px-4 py-3.5">Deadline</th>
                  <th className="px-4 py-3.5">Prioritas</th>
                  <th className="px-4 py-3.5 text-right">Nilai</th>
                  <th className="px-4 py-3.5">Risiko AI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => {
                  const insight = analyzeOrder(order, now);
                  const hoursLeft = deadlineOf(order.dueDate, order.dueTime).getTime() - now.getTime();
                  return (
                    <tr key={order.id} className="transition-colors hover:bg-teal-50/40">
                      <td className="px-4 py-3">
                        <Link href={`/pesanan/${order.id}`} className="font-semibold text-slate-900 hover:text-indigo-600">
                          {order.title}
                        </Link>
                        <p className="text-[11px] font-bold text-indigo-500">{order.code}</p>
                        <p className="text-[11px] text-slate-500">
                          📦 {summarizeItems(order.items, 3)}
                          {order.items.length > 1 ? (
                            <span className="ml-1 rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-700">
                              {order.items.length} produk
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-slate-400">{order.machine}</p>
                        <p className={`mt-0.5 text-[11px] font-bold ${order.operator ? "text-teal-700" : "text-amber-600"}`}>
                          👤 PIC: {order.operator || "Belum ditentukan"}
                        </p>
                        {outsourceMap.get(order.id) ? (
                          <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${outsourceStatusMeta(outsourceMap.get(order.id)!.status).color}`}>
                            🏭 {outsourceMap.get(order.id)!.partnerName}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {order.customerName}
                        {(photoCountsMap.get(order.id) ?? 0) > 0 ? (
                          <span
                            className="ml-1.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600"
                            title={`${photoCountsMap.get(order.id)} foto terlampir`}
                          >
                            🖼️ {photoCountsMap.get(order.id)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <QuickStatusPopup
                          orderId={order.id}
                          orderCode={order.code}
                          orderTitle={order.title}
                          currentStatus={order.status}
                          hasOutsource={Boolean(outsourceMap.get(order.id))}
                          trigger={<StatusBadge status={order.status} />}
                        />
                      </td>
                      <td className="w-32 px-4 py-3">
                        <ProgressBar value={insight.progress} tone={statusMeta(order.status).bar} />
                        <p className="mt-1 text-[11px] text-slate-500">{insight.progress}%</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDateID(order.dueDate)}
                        <p
                          className={`text-[11px] font-semibold ${
                            hoursLeft < 0 && !statusMeta(order.status).done ? "text-rose-600" : "text-slate-500"
                          }`}
                        >
                          {order.dueTime} ·{" "}
                          {hoursLeft < 0
                            ? `telat ${humanDuration(hoursLeft / 3_600_000)}`
                            : `sisa ${humanDuration(hoursLeft / 3_600_000)}`}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={order.priority} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatRupiah(order.price)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`chip ${
                            insight.riskLevel === "terlambat"
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : insight.riskLevel === "risiko"
                                ? "border-orange-200 bg-orange-50 text-orange-700"
                                : insight.riskLevel === "waspada"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {insight.riskScore}/100
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
