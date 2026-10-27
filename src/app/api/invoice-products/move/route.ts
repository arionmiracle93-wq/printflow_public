import { requireInvoiceAccess } from "@/lib/invoice-access";
import { invoiceFailure, readJson } from "@/lib/invoice-api";
import { moveProducts } from "@/lib/invoice-catalog";

export const dynamic = "force-dynamic";

/**
 * Pindahkan beberapa produk ke induk utama/sub-induk (jadi variannya), atau lepaskan dari induk. Hanya Owner.
 * Body: { ids: number[], parentId: number | null }. parentId null = lepaskan jadi produk biasa (namanya digabung path induk).
 * Kartu induk tidak bisa dipindah; produk yang sudah ada di induk tujuan dilewati. Awalan sub-induk yang
 * sudah menempel di nama varian dibuang supaya nama invoice tidak dobel.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    const ids = Array.isArray(body.ids) ? body.ids.map((n) => Number(n)) : [];
    const parentId = body.parentId === null || body.parentId === undefined ? null : Number(body.parentId);
    if (parentId !== null && (!Number.isInteger(parentId) || parentId <= 0)) {
      return Response.json({ ok: false, error: "Induk tujuan tidak valid." }, { status: 400 });
    }
    const r = await moveProducts(ids, parentId);
    return Response.json({ ok: true, ...r });
  } catch (error) {
    return invoiceFailure("POST /api/invoice-products/move", error);
  }
}
