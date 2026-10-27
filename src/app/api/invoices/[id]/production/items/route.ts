import { addInvoiceItemsToProduction, getInvoiceDetail } from "@/lib/invoice-queries";
import { requireInvoiceAccess } from "@/lib/invoice-access";
import { badId, invoiceFailure, parseId, readJson } from "@/lib/invoice-api";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

/**
 * Tambah item invoice yang belum masuk ke pekerjaan produksi yang sudah ada.
 *
 * Body: { items: [{ lineKey, prodDueDate?: "YYYY-MM-DD", prodDueTime?: "HH:MM" }] }
 * Hanya item baru yang disalin. Status / mitra / deadline item lama tidak diubah.
 * Idempoten: item yang sudah ada di pekerjaan akan dilewati.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badId();
    const body = await readJson(request);
    const result = await addInvoiceItemsToProduction(id, body.items, auth.access.user.name);
    return Response.json({ ok: true, ...result, data: await getInvoiceDetail(id) });
  } catch (error) {
    return invoiceFailure("POST /api/invoices/[id]/production/items", error);
  }
}
