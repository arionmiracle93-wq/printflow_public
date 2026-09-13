import Link from "next/link";
import { ArrowRight, Clock3, Handshake } from "lucide-react";
import { ProblemScreen } from "@/components/ProblemScreen";
import { ShareHandoverWhatsApp } from "@/components/ShareHandoverWhatsApp";
import { safeDb } from "@/lib/dbcheck";
import { formatDateID, formatDateTimeID } from "@/lib/domain";
import { listPendingHandovers } from "@/lib/handover-queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Serah Terima Shift — Print Flow" };

export default async function HandoverPage() {
  const loaded = await safeDb(() => listPendingHandovers());
  if (!loaded.ok) return <ProblemScreen problem={loaded.problem} hint="Buka /api/setup untuk mengaktifkan Serah Terima Shift." />;
  const rows = loaded.data;
  return <div className="space-y-4"><div><p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-teal-600">Operasional shift</p><h1 className="mt-1 text-2xl font-black tracking-tight text-[#07384f]">Serah Terima Shift</h1><p className="mt-1 text-sm text-slate-500">Daftar pekerjaan yang menunggu diterima operator shift berikutnya.</p></div>
    {rows.length === 0 ? <div className="card p-10 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Handshake size={30} /></span><p className="mt-4 text-sm font-extrabold text-[#07384f]">Tidak ada mutasi yang menunggu</p><p className="mt-1 text-xs text-slate-500">Semua serah terima sudah diterima operator berikutnya.</p></div> : <div className="grid gap-3 md:grid-cols-2">{rows.map((r) => <div key={r.id} className="card overflow-hidden"><div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3"><div><p className="text-[11px] font-extrabold text-teal-700">{r.orderCode}</p><Link href={`/pesanan/${r.orderId}`} className="text-sm font-extrabold text-[#07384f] hover:underline">{r.orderTitle}</Link><p className="text-xs text-slate-500">{r.customerName}</p></div><span className="chip border-amber-200 bg-amber-50 text-amber-700"><Clock3 size={11} /> Menunggu</span></div><div className="space-y-3 p-4"><p className="flex items-center gap-2 text-sm font-extrabold text-slate-700">{r.fromOperator}<ArrowRight size={14} className="text-amber-500" />{r.toOperator}</p><div className="grid grid-cols-2 gap-2"><Info label="Posisi terakhir" value={r.lastPosition} /><Info label="Tindakan berikutnya" value={r.nextAction} />{r.blocker ? <Info label="Kendala" value={r.blocker} danger /> : null}<Info label="Deadline" value={`${formatDateID(r.dueDate)} · ${r.dueTime}`} /></div><p className="text-[11px] text-slate-400">Dibuat {formatDateTimeID(r.handedOverAt)}</p><Link href={`/pesanan/${r.orderId}`} className="btn-primary w-full">Buka & Terima Pekerjaan</Link><ShareHandoverWhatsApp handover={{ orderId: r.orderId, orderCode: r.orderCode, orderTitle: r.orderTitle, customerName: r.customerName, fromOperator: r.fromOperator, toOperator: r.toOperator, shiftLabel: r.shiftLabel, lastPosition: r.lastPosition, nextAction: r.nextAction, blocker: r.blocker, dueDate: r.dueDate, dueTime: r.dueTime }} /></div></div>)}</div>}
  </div>;
}
function Info({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div className={`rounded-xl p-2.5 ${danger ? "bg-rose-50" : "bg-slate-50"}`}><p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-xs font-semibold ${danger ? "text-rose-700" : "text-slate-700"}`}>{value}</p></div>; }
