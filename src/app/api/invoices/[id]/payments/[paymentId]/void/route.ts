import { getInvoiceDetail, voidPayment } from "@/lib/invoice-queries";
import { requireInvoiceAccess } from "@/lib/invoice-access";
import { badId, invoiceFailure, parseId, readJson } from "@/lib/invoice-api";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string; paymentId: string }> };

/** Batalkan satu pembayaran (tidak dihapus, hanya ditandai batal). Hanya Owner. Body: { reason } */
export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const p = await params;
    const id = parseId(p.id);
    const paymentId = parseId(p.paymentId);
    if (!id) return badId();
    if (!paymentId) return badId("Pembayaran");
    const body = await readJson(request);
    await voidPayment(id, paymentId, typeof body.reason === "string" ? body.reason : "", auth.access.user.name);
    return Response.json({ ok: true, data: await getInvoiceDetail(id) });
  } catch (error) {
    return invoiceFailure("POST /api/invoices/[id]/payments/[paymentId]/void", error);
  }
}
