import { getInvoiceDetail, issueInvoice } from "@/lib/invoice-queries";
import { requireInvoiceAccess } from "@/lib/invoice-access";
import { badId, invoiceFailure, parseId } from "@/lib/invoice-api";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

/** Terbitkan draft: nomor resmi (INV-YYYYMMDD-001) diambil dari server di sini. */
export async function POST(_request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badId();
    await issueInvoice(id, auth.access.user.name);
    return Response.json({ ok: true, data: await getInvoiceDetail(id) });
  } catch (error) {
    return invoiceFailure("POST /api/invoices/[id]/issue", error);
  }
}
