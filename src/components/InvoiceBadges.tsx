import { CheckCircle2, CircleDashed, Clock, FileEdit, Hammer, XCircle } from "lucide-react";
import { statusMeta } from "@/lib/domain";

/** Badge status DOKUMEN invoice: draft / terbit / batal. */
export function InvoiceStatusBadge({ status }: { status: string }) {
  if (status === "draft")
    return <span className="chip border-slate-200 bg-slate-50 text-slate-600"><FileEdit size={11} /> Draft</span>;
  if (status === "batal")
    return <span className="chip border-rose-200 bg-rose-50 text-rose-700"><XCircle size={11} /> Batal</span>;
  return <span className="chip border-teal-200 bg-teal-50 text-teal-700">Terbit</span>;
}

/** Badge status PEMBAYARAN: belum / sebagian / lunas. Tidak ditampilkan untuk draft/batal. */
export function PayStatusBadge({ payStatus, status = "terbit" }: { payStatus: string; status?: string }) {
  if (status !== "terbit") return null;
  if (payStatus === "lunas")
    return <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 size={11} /> Lunas</span>;
  if (payStatus === "sebagian")
    return <span className="chip border-amber-200 bg-amber-50 text-amber-700"><Clock size={11} /> Sebagian</span>;
  return <span className="chip border-rose-200 bg-rose-50 text-rose-700"><CircleDashed size={11} /> Belum bayar</span>;
}

/** Cermin status PRODUKSI (read-only) dari pekerjaan yang tertaut. */
export function ProductionMirrorBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const meta = statusMeta(status);
  return (
    <span className={`chip ${meta.badge}`} title="Status produksi (dari PrintFlow)">
      <Hammer size={11} /> {meta.short}
    </span>
  );
}
