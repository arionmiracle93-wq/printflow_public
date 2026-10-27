import { requireInvoiceAccess } from "@/lib/invoice-access";
import { badId, invoiceFailure, parseId, readJson } from "@/lib/invoice-api";
import { deleteProducts, parseProductInput, updateProduct } from "@/lib/invoice-catalog";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

/**
 * Ubah produk. Hanya Owner. image: tidak dikirim = gambar tetap; null = hapus gambar; data URL = ganti.
 * parentId: tidak dikirim = tetap; null = jadikan produk biasa; angka = jadikan varian dari induk/sub-induk itu.
 * Induk tidak bisa dipindah ke induk lain lewat endpoint ini; sub-induk hanya dibuat di bawah induk utama.
 */
export async function PUT(request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badId("Produk");
    const product = await updateProduct(id, parseProductInput(await readJson(request)));
    return Response.json({ ok: true, data: product });
  } catch (error) {
    return invoiceFailure("PUT /api/invoice-products/[id]", error);
  }
}

/**
 * Hapus satu produk. Untuk kartu induk yang punya varian: ?varian=lepas (bawaan) = varian dilepas jadi produk biasa,
 * ?varian=hapus = varian ikut dihapus.
 */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badId("Produk");
    const variants = new URL(request.url).searchParams.get("varian") === "hapus" ? "delete" : "release";
    const r = await deleteProducts([id], variants);
    if (!r.deleted) return Response.json({ ok: false, error: "Produk tidak ditemukan." }, { status: 404 });
    return Response.json({ ok: true, deleted: r.deleted, released: r.released });
  } catch (error) {
    return invoiceFailure("DELETE /api/invoice-products/[id]", error);
  }
}
