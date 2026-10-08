import {
  deleteDraft,
  getInvoiceDetail,
  parseInvoiceInput,
  updateInvoice,
} from "@/lib/invoice-queries";
import { requireInvoiceAccess } from "@/lib/invoice-access";
import { badId, invoiceFailure, parseId, readJson } from "@/lib/invoice-api";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badId();
    const data = await getInvoiceDetail(id);
    if (!data) return Response.json({ ok: false, error: "Invoice tidak ditemukan." }, { status: 404 });
    return Response.json({ ok: true, data });
  } catch (error) {
    return invoiceFailure("GET /api/invoices/[id]", error);
  }
}

/**
 * Edit isi invoice. Wajib menyertakan `version` (dari data terakhir yang dibaca).
 * Kalau versi sudah berbeda (diedit orang lain), server menolak dengan kode
 * VERSI_BERBEDA — bukan menimpa diam-diam.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badId();
    const body = await readJson(request);
    const version = Number(body.version);
    if (!Number.isInteger(version) || version < 1) {
      return Response.json({ ok: false, error: "Versi invoice wajib disertakan (muat ulang halaman lalu coba lagi)." }, { status: 400 });
    }
    const input = parseInvoiceInput(body);
    await updateInvoice(id, input, version, { name: auth.access.user.name, isOwner: auth.access.isOwner });
    return Response.json({ ok: true, data: await getInvoiceDetail(id) });
  } catch (error) {
    return invoiceFailure("PATCH /api/invoices/[id]", error);
  }
}

/** Hapus DRAFT saja. Invoice terbit hanya bisa dibatalkan (POST .../void, Owner). */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badId();
    await deleteDraft(id, { name: auth.access.user.name, isOwner: auth.access.isOwner });
    return Response.json({ ok: true });
  } catch (error) {
    return invoiceFailure("DELETE /api/invoices/[id]", error);
  }
}
