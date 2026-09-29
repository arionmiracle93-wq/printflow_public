import Link from "next/link";
import { ClipboardCheck, ClipboardList, Clock, Factory, FilterX, Image as ImageIcon, Package, Plus, Search, SearchX, User } from "lucide-react";
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
import { EmptyState } from "@/components/EmptyState";

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ClipboardList size={22} strokeWidth={2.3} /> Daftar Pekerjaan
          </h1>
          <p className="text-sm text-slate-500">
            {orders.length} pekerjaan ditampilkan · diurutkan dari deadline terdekat
          </p>
        </div>
        <Link href="/pesanan/baru" className="btn-primary inline-flex items-center gap-1.5">
          <Plus size={15} strokeWidth={2.5} /> Pekerjaan Baru
        </Link>
      </div>

      {/* FILTER */}
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1">
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                href={`/pesanan?scope=${tab.key}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  scope === tab.key ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <form className="flex flex-1 flex-wrap items-center gap-2" action="/pesanan" method="get">
            <input type="hidden" name="scope" value={scope} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Cari kode / nama pekerjaan / pelanggan…"
              className="input sm:max-w-xs"
            />
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
            <button type="submit" className="btn-ghost inline-flex items-center gap-1.5">
              <Search size={14} /> Filter
            </button>
          </form>
        </div>
      </div>

      {orders.length === 0 ? (
        // Dua keadaan kosong yang berbeda langkah lanjutnya:
        // filter/pencarian tidak menemukan apa pun, atau memang belum ada pekerjaan.
        q || status !== "all" || machine !== "all" || scope === "selesai" ? (
          <EmptyState
            icon={<SearchX size={26} />}
            title="Tidak ada pekerjaan yang cocok"
            description={
              q ? (
                <>
                  Tidak ada hasil untuk &ldquo;{q}&rdquo;
                  {scope === "aktif" ? " di pekerjaan aktif" : ""}. Periksa ejaan, atau cari di semua pekerjaan.
                </>
              ) : (
                "Tidak ada pekerjaan dengan kombinasi filter ini."
              )
            }
            action={{ href: "/pesanan", label: "Hapus filter", icon: <FilterX size={15} />, variant: "ghost" }}
            secondary={
              q && scope !== "semua"
                ? { href: `/pesanan?scope=semua&q=${encodeURIComponent(q)}`, label: "Cari di semua pekerjaan", icon: <Search size={15} /> }
                : undefined
            }
          />
        ) : scope === "aktif" ? (
          <EmptyState
            icon={<ClipboardCheck size={26} />}
            title="Tidak ada pekerjaan aktif"
            description="Semua pekerjaan sudah selesai, atau belum ada yang dicatat. Pekerjaan baru akan langsung muncul di sini."
            action={{ href: "/pesanan/baru", label: "Buat pekerjaan", icon: <Plus size={15} /> }}
            secondary={{ href: "/pesanan?scope=selesai", label: "Lihat yang selesai" }}
          />
        ) : (
          <EmptyState
            icon={<ClipboardList size={26} />}
            title="Belum ada pekerjaan"
            description="Catat pekerjaan pertama, lalu pantau tahap, tenggat, dan risikonya dari sini."
            action={{ href: "/pesanan/baru", label: "Buat pekerjaan pertama", icon: <Plus size={15} /> }}
          />
        )
      ) : (
        <>
          {/* MOBILE CARDS */}
          <div className="grid gap-3 md:hidden">
            {orders.map((order) => {
              const insight = analyzeOrder(order, now);
              return (
                <Link key={order.id} href={`/pesanan/${order.id}`} className="card block p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-teal-700">{order.code}</p>
                      <p className="text-sm font-bold text-slate-900">{order.title}</p>
                      <p className="text-xs text-slate-500">{order.customerName}</p>
                      {/* Chip jumlah produk dikunci satu baris (shrink-0 + whitespace-nowrap).
                          Yang boleh turun baris hanya teks ringkasan produknya. */}
                      <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
                        <Package size={12} className="mt-0.5 shrink-0" />
                        <span className="min-w-0 flex-1">{summarizeItems(order.items)}</span>
                        {order.items.length > 1 ? (
                          <span className="shrink-0 whitespace-nowrap rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold leading-4 text-teal-700">
                            {order.items.length} produk
                          </span>
                        ) : null}
                      </p>
                      <p className={`mt-1 flex items-center gap-1 text-[11px] font-bold ${order.operator ? "text-teal-700" : "text-amber-600"}`}>
                        <User size={12} className="shrink-0" /> PIC: {order.operator || "Belum ditentukan"}
                      </p>
                      {outsourceMap.get(order.id) ? (
                        <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${outsourceStatusMeta(outsourceMap.get(order.id)!.status).color}`}>
                          <Factory size={11} /> Mitra: {outsourceMap.get(order.id)!.partnerName}
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
                        <Clock size={12} className="shrink-0" /> {formatDateID(order.dueDate)} {order.dueTime}
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
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kode / Pekerjaan</th>
                  <th className="px-4 py-3">Pelanggan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Progres</th>
                  <th className="px-4 py-3">Deadline</th>
                  <th className="px-4 py-3">Prioritas</th>
                  <th className="px-4 py-3 text-right">Nilai</th>
                  <th className="px-4 py-3">Risiko AI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => {
                  const insight = analyzeOrder(order, now);
                  const hoursLeft = deadlineOf(order.dueDate, order.dueTime).getTime() - now.getTime();
                  return (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/pesanan/${order.id}`} className="font-semibold text-slate-900 hover:text-teal-700">
                          {order.title}
                        </Link>
                        <p className="text-[11px] font-bold text-teal-600">{order.code}</p>
                        <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
                          <Package size={12} className="mt-0.5 shrink-0" />
                          <span className="min-w-0 flex-1">{summarizeItems(order.items, 3)}</span>
                          {order.items.length > 1 ? (
                            <span className="shrink-0 whitespace-nowrap rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold leading-4 text-teal-700">
                              {order.items.length} produk
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-slate-400">{order.machine}</p>
                        <p className={`mt-0.5 flex items-center gap-1 text-[11px] font-bold ${order.operator ? "text-teal-700" : "text-amber-600"}`}>
                          <User size={12} className="shrink-0" /> PIC: {order.operator || "Belum ditentukan"}
                        </p>
                        {outsourceMap.get(order.id) ? (
                          <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${outsourceStatusMeta(outsourceMap.get(order.id)!.status).color}`}>
                            <Factory size={11} /> {outsourceMap.get(order.id)!.partnerName}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {order.customerName}
                        {(photoCountsMap.get(order.id) ?? 0) > 0 ? (
                          <span
                            className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-700"
                            title={`${photoCountsMap.get(order.id)} foto terlampir`}
                          >
                            <ImageIcon size={11} /> {photoCountsMap.get(order.id)}
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
