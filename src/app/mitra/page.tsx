import Link from "next/link";
import { AlertTriangle, Building2, CircleDollarSign, Clock3, ExternalLink, PackageCheck, Truck } from "lucide-react";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { deadlineOf, formatDateID, formatRupiah, humanDuration } from "@/lib/domain";
import { listOutsourceOverview } from "@/lib/outsource-queries";
import { outsourceStatusMeta } from "@/lib/outsource";

export const dynamic = "force-dynamic";
export const metadata = { title: "Produksi Mitra — Print Flow" };

export default async function MitraPage() {
  const loaded = await safeDb(() => listOutsourceOverview());
  if (!loaded.ok) return <ProblemScreen problem={loaded.problem} hint="Buka /api/setup sekali untuk mengaktifkan fitur Produksi Mitra." />;
  const rows = loaded.data;
  const now = new Date();
  const active = rows.filter((r) => r.status !== "diterima");
  const lateVendor = active.filter((r) => deadlineOf(r.expectedDate, r.expectedTime) < now);
  const totalCost = rows.reduce((s, r) => s + r.vendorCost, 0);
  const totalMargin = rows.reduce((s, r) => s + (r.orderPrice - r.vendorCost), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-teal-600">Produksi eksternal</p><h1 className="mt-1 text-2xl font-black tracking-tight text-[#07384f]">Produksi Mitra</h1><p className="mt-1 text-sm text-slate-500">Pantau pekerjaan di percetakan lain atau pusat tanpa kehilangan kendali deadline dan margin.</p></div>
        <Link href="/pesanan" className="btn-primary"><ExternalLink size={15} /> Pilih Pekerjaan</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Truck size={18} />} label="Sedang di luar" value={String(active.length)} />
        <Kpi icon={<AlertTriangle size={18} />} label="Lewat target kembali" value={String(lateVendor.length)} danger={lateVendor.length > 0} />
        <Kpi icon={<CircleDollarSign size={18} />} label="Total biaya mitra" value={formatRupiah(totalCost)} />
        <Kpi icon={<PackageCheck size={18} />} label="Margin kotor tercatat" value={formatRupiah(totalMargin)} danger={totalMargin < 0} />
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Building2 size={30} /></span><p className="mt-4 text-sm font-extrabold text-[#07384f]">Belum ada pekerjaan di mitra</p><p className="mt-1 text-xs text-slate-500">Buka detail pekerjaan → klik “Alihkan ke Mitra”.</p></div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => {
            const target = deadlineOf(row.expectedDate, row.expectedTime);
            const hours = (target.getTime() - now.getTime()) / 3_600_000;
            const customerDeadline = deadlineOf(row.customerDueDate, row.customerDueTime);
            const bufferHours = (customerDeadline.getTime() - target.getTime()) / 3_600_000;
            const meta = outsourceStatusMeta(row.status);
            const done = row.status === "diterima";
            return (
              <div key={row.id} className="card overflow-hidden">
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3"><div><p className="text-[11px] font-extrabold text-teal-700">{row.orderCode}</p><Link href={`/pesanan/${row.orderId}`} className="text-sm font-extrabold text-[#07384f] hover:underline">{row.orderTitle}</Link><p className="text-xs text-slate-500">{row.customerName}</p></div><span className={`chip ${meta.color}`}>{meta.short}</span></div>
                <div className="space-y-3 p-4">
                  <div className="grid grid-cols-2 gap-2"><Info label="Dikerjakan oleh" value={row.partnerName} /><Info label="Target kembali" value={`${formatDateID(row.expectedDate)} · ${row.expectedTime}`} /><Info label="Biaya mitra" value={formatRupiah(row.vendorCost)} /><Info label="Margin kotor" value={formatRupiah(row.orderPrice - row.vendorCost)} danger={row.orderPrice - row.vendorCost < 0} /></div>
                  {!done ? <p className={`rounded-xl px-3 py-2 text-xs font-semibold ${hours < 0 ? "bg-rose-50 text-rose-700" : hours < 24 ? "bg-amber-50 text-amber-800" : "bg-teal-50 text-teal-700"}`}><Clock3 size={13} className="mr-1 inline" />{hours < 0 ? `Target kembali terlambat ${humanDuration(hours)}` : `Sisa ${humanDuration(hours)} menuju target kembali`}</p> : null}
                  {bufferHours < 8 && !done ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">⚠️ Buffer ke deadline pelanggan hanya {humanDuration(bufferHours)}. Idealnya sisakan ≥ 8 jam untuk QC dan revisi.</p> : null}
                  {row.notes ? <p className="text-xs text-slate-500">📝 {row.notes}</p> : null}
                  <Link href={`/pesanan/${row.orderId}`} className="inline-flex items-center gap-1 text-xs font-extrabold text-teal-700 hover:underline">Update status mitra <ExternalLink size={12} /></Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, danger = false }: { icon: React.ReactNode; label: string; value: string; danger?: boolean }) { return <div className="card p-4"><span className={`icon-tile ${danger ? "!bg-rose-50 !text-rose-600" : ""}`}>{icon}</span><p className="mt-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-xl font-black ${danger ? "text-rose-600" : "text-[#07384f]"}`}>{value}</p></div>; }
function Info({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-0.5 text-xs font-bold ${danger ? "text-rose-600" : "text-slate-700"}`}>{value}</p></div>; }
