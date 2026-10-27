import { createProductionForInvoice, getInvoiceDetail } from "@/lib/invoice-queries";
import { requireInvoiceAccess } from "@/lib/invoice-access";
import { badId, invoiceFailure, parseId, readJson } from "@/lib/invoice-api";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

/**
 * Buat Pekerjaan Produksi dari Invoice yang sudah terbit.
 * Body: {
 *   dueDate: "YYYY-MM-DD", dueTime?: "HH:MM",  // deadline utama, wajib
 *   items?: [{ id, needsProduction, prodDueDate?, prodDueTime? }] // pilihan per item
 * }
 * Bila `items` dikirim, daftar itu dianggap lengkap: item yang tidak dicentang
 * tidak ikut dibuat di pekerjaan produksi.
 * Idempoten: 1 invoice = 1 pekerjaan (permintaan kedua ditolak dengan SUDAH_ADA_PEKERJAAN).
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badId();
    const body = await readJson(request);
    const orderId = await createProductionForInvoice(id, body.dueDate, body.dueTime, auth.access.user.name, body.items);
    return Response.json({ ok: true, orderId, data: await getInvoiceDetail(id) }, { status: 201 });
  } catch (error) {
    return invoiceFailure("POST /api/invoices/[id]/production", error);
  }
}
