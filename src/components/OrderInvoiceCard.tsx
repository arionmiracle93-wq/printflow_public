import Link from "next/link";
import { FilePlus2, ReceiptText } from "lucide-react";
import { PayStatusBadge } from "@/components/InvoiceBadges";
import { formatRupiah } from "@/lib/domain";
import { getInvoiceAccess } from "@/lib/invoice-access";
import { getInvoiceForOrder } from "@/lib/invoice-queries";

/**
 * Kartu mini invoice di halaman pekerjaan.
 * Hanya tampil untuk akun yang punya izin Invoice. Bila pekerjaan sudah punya invoice:
 * nomor, total, sisa, status bayar (cermin, read-only). Bila belum: tombol "Buat Invoice dari Pekerjaan Ini".
 * Gagal membaca invoice (mis. tabel belum diperbarui) tidak boleh merusak halaman pekerjaan.
 */
export async function OrderInvoiceCard({ orderId }: { orderId: number }) {
  let access = null;
  let link = null;
  try {
    access = await getInvoiceAccess();
    if (!access) return null;
    link = await getInvoiceForOrder(orderId);
  } catch {
    return null;
  }

  if (!link || link.status === "batal") {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 p-3 md:p-4">
        <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
          <ReceiptText size={17} className="shrink-0 text-teal-600" />
          <span className="min-w-0">Belum ada invoice untuk pekerjaan ini.</span>
        </div>
        <Link href={`/invoice/baru?dariPesanan=${orderId}`} className="btn-secondary px-3 py-2 text-xs">
          <FilePlus2 size={14} /> Buat Invoice dari Pekerjaan Ini
        </Link>
      </div>
    );
  }

  const remaining = Math.max(0, link.total - link.paidAmount);
  return (
    <Link href={`/invoice/${link.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-3 transition hover:-translate-y-0.5 md:p-4">
      <div className="flex min-w-0 items-center gap-2">
        <ReceiptText size={17} className="shrink-0 text-teal-600" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[color:var(--pf-ink)]">{link.number ?? `Draft #${link.id}`}</p>
          <p className="text-[11px] text-slate-500">
            Total {formatRupiah(link.total)}
            {link.status === "terbit" && remaining > 0 ? ` · sisa ${formatRupiah(remaining)}` : ""}
          </p>
        </div>
      </div>
      <PayStatusBadge payStatus={link.payStatus} status={link.status} />
    </Link>
  );
}
