import { requireInvoiceAccess } from "@/lib/invoice-access";
import { invoiceFailure, readJson } from "@/lib/invoice-api";
import { allCategories, saveCategories } from "@/lib/invoice-catalog";

export const dynamic = "force-dynamic";

/**
 * Simpan daftar kategori (Kelola Kategori). Hanya Owner. Body: { list: string[] }.
 * Kategori yang masih dipakai produk tetap tampil walau dihapus dari daftar ini (aturan app lama).
 */
export async function PUT(request: Request) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    await saveCategories(body.list);
    return Response.json({ ok: true, categories: await allCategories() });
  } catch (error) {
    return invoiceFailure("PUT /api/invoice-products/categories", error);
  }
}
