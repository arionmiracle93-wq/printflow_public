import { requireInvoiceAccess } from "@/lib/invoice-access";
import { invoiceFailure, parseId } from "@/lib/invoice-api";
import { getProductImage } from "@/lib/invoice-catalog";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

/** Gambar produk. Alamatnya memuat ?v=versi, jadi boleh di-cache lama oleh browser. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return new Response("Tidak ditemukan", { status: 404 });
    const data = await getProductImage(id);
    const m = data ? /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(data) : null;
    if (!m) return new Response("Tanpa gambar", { status: 404 });
    return new Response(Buffer.from(m[2], "base64"), {
      headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=31536000, immutable" },
    });
  } catch (error) {
    return invoiceFailure("GET /api/invoice-products/[id]/image", error);
  }
}
