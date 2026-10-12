import { duplicateInvoice, getInvoiceDetail } from "@/lib/invoice-queries";
import { requireInvoiceAccess } from "@/lib/invoice-access";
import { badId, invoiceFailure, parseId } from "@/lib/invoice-api";
import { getInvoiceSettings } from "@/lib/invoice-settings";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

/** Duplikat: salinan draft dari dokumen mana pun (pembayaran dan nomor tidak ikut). */
export async function POST(_request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badId("Dokumen");
    const settings = await getInvoiceSettings();
    const newId = await duplicateInvoice(id, auth.access.user.name, settings.dueDays);
    return Response.json({ ok: true, newId, data: await getInvoiceDetail(newId) }, { status: 201 });
  } catch (error) {
    return invoiceFailure("POST /api/invoices/[id]/duplicate", error);
  }
}
