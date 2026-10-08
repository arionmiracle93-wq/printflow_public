import Link from "next/link";
import { ArrowRight, Clock3, Handshake } from "lucide-react";
import { ProblemScreen } from "@/components/ProblemScreen";
import { ShareHandoverWhatsApp } from "@/components/ShareHandoverWhatsApp";
import { ShiftHandoverCreator } from "@/components/ShiftHandoverCreator";
import { getCurrentUser } from "@/lib/auth";
import { safeDb } from "@/lib/dbcheck";
import { formatDateID, formatDateTimeID } from "@/lib/domain";
import { listHandoverCandidates, listPendingHandovers } from "@/lib/handover-queries";
import { listActiveEmployees } from "@/lib/user-queries";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";
export const metadata = { title: "Serah Terima Shift - Print Flow" };

export default async function HandoverPage() {
  const sessionUser = await getCurrentUser();
  const loaded = await safeDb(async () => {
    const [rows, candidates, employees] = await Promise.all([
      listPendingHandovers(),
      listHandoverCandidates(),
      // Karyawan tidak bisa menyerahkan ke dirinya sendiri, jadi akunnya disembunyikan dari pilihan tujuan.
      listActiveEmployees(sessionUser?.role === "karyawan" ? sessionUser.id : undefined),
    ]);
    return { rows, candidates, employees };
  });
  if (!loaded.ok) return <ProblemScreen problem={loaded.problem} hint="Buka /api/setup untuk mengaktifkan Serah Terima Shift." />;
  const { rows, candidates, employees } = loaded.data;
  return <div className="space-y-4"><div><h1 className="page-title">Serah Terima Shift</h1><p className="mt-1 text-sm text-slate-500">Buat serah terima baru di sini, dan lihat pekerjaan yang menunggu diterima operator shift berikutnya.</p></div>
    {sessionUser ? <ShiftHandoverCreator candidates={candidates} employees={employees} loggedInName={sessionUser.name} loggedInRole={sessionUser.role} /> : null}
    {rows.length === 0 ? (
      <EmptyState
        icon={<Handshake size={26} />}
        title="Tidak ada serah terima yang menunggu"
        description="Semua serah terima sudah diterima operator berikutnya. Buat serah terima baru lewat tombol di atas, atau dari tab Komunikasi di detail pekerjaan."
        action={{ href: "/pesanan", label: "Lihat pekerjaan aktif", variant: "ghost" }}
      />
    ) : <div className="grid gap-3 md:grid-cols-2">{rows.map((r) => <div key={r.id} className="card overflow-hidden"><div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3"><div><p className="text-[11px] font-semibold text-teal-700">{r.orderCode}</p><Link href={`/pesanan/${r.orderId}`} className="text-sm font-semibold text-[color:var(--pf-ink)] hover:underline">{r.orderTitle}</Link><p className="text-xs text-slate-500">{r.customerName}</p></div><span className="chip border-amber-200 bg-amber-50 text-amber-700"><Clock3 size={11} /> Menunggu</span></div><div className="space-y-3 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-slate-700">{r.fromOperator}<ArrowRight size={14} className="text-amber-500" />{r.toOperator}</p><div className="grid grid-cols-2 gap-2"><Info label="Posisi terakhir" value={r.lastPosition} /><Info label="Tindakan berikutnya" value={r.nextAction} />{r.blocker ? <Info label="Kendala" value={r.blocker} danger /> : null}<Info label="Deadline" value={`${formatDateID(r.dueDate)} · ${r.dueTime}`} /></div><p className="text-[11px] text-slate-400">Dibuat {formatDateTimeID(r.handedOverAt)}</p><Link href={`/pesanan/${r.orderId}`} className="btn-primary w-full">Buka & Terima Pekerjaan</Link><ShareHandoverWhatsApp handover={{ orderId: r.orderId, orderCode: r.orderCode, orderTitle: r.orderTitle, customerName: r.customerName, fromOperator: r.fromOperator, toOperator: r.toOperator, shiftLabel: r.shiftLabel, lastPosition: r.lastPosition, nextAction: r.nextAction, blocker: r.blocker, dueDate: r.dueDate, dueTime: r.dueTime }} /></div></div>)}</div>}
  </div>;
}
function Info({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div className={`rounded-xl p-2.5 ${danger ? "bg-rose-50" : "bg-slate-50"}`}><p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-xs font-semibold ${danger ? "text-rose-700" : "text-slate-700"}`}>{value}</p></div>; }
