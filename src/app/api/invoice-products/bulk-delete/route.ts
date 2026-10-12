import { requireInvoiceAccess } from "@/lib/invoice-access";
import { invoiceFailure, readJson } from "@/lib/invoice-api";
import { deleteProducts } from "@/lib/invoice-catalog";

export const dynamic = "force-dynamic";

/** Hapus beberapa produk sekaligus (mode Pilih di galeri). Hanya Owner. Body: { ids: number[] }. */
export async function POST(request: Request) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    const ids = Array.isArray(body.ids) ? body.ids.map((n) => Number(n)) : [];
    return Response.json({ ok: true, deleted: await deleteProducts(ids) });
  } catch (error) {
    return invoiceFailure("POST /api/invoice-products/bulk-delete", error);
  }
}
