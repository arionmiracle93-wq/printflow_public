import { parseId, badId, readJson, invoiceFailure } from "@/lib/invoice-api";
import { requireInvoiceAccess } from "@/lib/invoice-access";
import { createRefund, parseRefundInput } from "@/lib/refund-queries";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

/**
 * Ajukan refund uang (pengajuan masuk antrian persetujuan Owner).
 * Body: { amount, method?, reason (wajib), reference?, clientRef? }
 *
 * Aturan paling penting:
 *  - Refund ini PENGAJUAN: uang belum dihitung keluar sampai Owner menyetujui
 *    dan menandainya terkirim (lihat route [refundId]).
 *  - Nominal tidak boleh melebihi uang aktif dikurangi refund yang sudah
 *    mengikat — pemeriksaan dihitung ulang di server (bukan percaya client).
 *  - clientRef = kode unik perangkat; pengiriman dua kali tidak jadi pengajuan
 *    dobel (server membalas sukses dengan duplicate: true).
 *  - Nilai invoice, terbayar, dan status lunas TIDAK diubah oleh pengajuan.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badId();
    const input = parseRefundInput(await readJson(request));
    const result = await createRefund(id, input, auth.access.user.name);
    return Response.json(
      { ok: true, refund: result.refund, duplicate: result.duplicate },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    return invoiceFailure("POST /api/invoices/[id]/refunds", error);
  }
}
