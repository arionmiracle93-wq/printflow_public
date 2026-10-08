import { getInvoiceDetail, voidInvoice } from "@/lib/invoice-queries";
import { requireInvoiceAccess } from "@/lib/invoice-access";
import { badId, invoiceFailure, parseId, readJson } from "@/lib/invoice-api";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

/** Batalkan invoice terbit. Hanya Owner. Body: { reason }. Pembayaran aktif harus dibatalkan dulu. */
export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badId();
    const body = await readJson(request);
    await voidInvoice(id, typeof body.reason === "string" ? body.reason : "", auth.access.user.name);
    return Response.json({ ok: true, data: await getInvoiceDetail(id) });
  } catch (error) {
    return invoiceFailure("POST /api/invoices/[id]/void", error);
  }
}
