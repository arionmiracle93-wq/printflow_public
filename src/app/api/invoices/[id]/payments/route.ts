import { addPayment, getInvoiceDetail, parsePaymentInput } from "@/lib/invoice-queries";
import { requireInvoiceAccess } from "@/lib/invoice-access";
import { badId, invoiceFailure, parseId, readJson } from "@/lib/invoice-api";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

/**
 * Catat pembayaran (DP / cicilan / pelunasan).
 * Body: { amount, method, paidAt?, note?, kind?: "dp"|"bayar", clientRef?, confirmOverpay? }
 *
 * clientRef = kode unik dari perangkat. Kalau kode yang sama dikirim dua
 * kali (sinyal putus-nyambung, antrean offline), server TIDAK mencatat dobel —
 * ia membalas sukses dengan duplicate: true.
 * Total, terbayar, dan status lunas dihitung ulang di server.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badId();
    const input = parsePaymentInput(await readJson(request));
    const result = await addPayment(id, input, auth.access.user.name);
    return Response.json(
      { ok: true, duplicate: result.duplicate, payment: result.payment, data: await getInvoiceDetail(id) },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    return invoiceFailure("POST /api/invoices/[id]/payments", error);
  }
}
