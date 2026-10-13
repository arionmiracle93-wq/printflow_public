import { requireInvoiceAccess } from "@/lib/invoice-access";
import { badId, invoiceFailure, parseId, readJson } from "@/lib/invoice-api";
import { deleteProducts, parseProductInput, updateProduct } from "@/lib/invoice-catalog";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

/** Ubah produk. Hanya Owner. image: tidak dikirim = gambar tetap; null = hapus gambar; data URL = ganti. */
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

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badId("Produk");
    const n = await deleteProducts([id]);
    if (!n) return Response.json({ ok: false, error: "Produk tidak ditemukan." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return invoiceFailure("DELETE /api/invoice-products/[id]", error);
  }
}
