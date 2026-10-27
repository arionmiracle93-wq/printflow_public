import { requireInvoiceAccess } from "@/lib/invoice-access";
import { invoiceFailure, readJson } from "@/lib/invoice-api";
import { deleteProducts } from "@/lib/invoice-catalog";

export const dynamic = "force-dynamic";

/**
 * Hapus beberapa produk sekaligus (mode Pilih di galeri). Hanya Owner. Body: { ids: number[], variants?: "release" | "delete" }.
 * variants berlaku untuk kartu induk yang isinya tidak ikut dipilih: sub-induk "release" = variannya pindah ke induk utama;
 * induk utama "release" = varian langsung dilepas jadi produk biasa; "delete" = isinya ikut dihapus.
 * Induk utama yang masih punya sub-induk ditolak supaya strukturnya dibereskan dulu.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    const ids = Array.isArray(body.ids) ? body.ids.map((n) => Number(n)) : [];
    const r = await deleteProducts(ids, body.variants === "delete" ? "delete" : "release");
    return Response.json({ ok: true, deleted: r.deleted, released: r.released });
  } catch (error) {
    return invoiceFailure("POST /api/invoice-products/bulk-delete", error);
  }
}
