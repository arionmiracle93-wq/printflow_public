import { requireInvoiceAccess } from "@/lib/invoice-access";
import { invoiceFailure, readJson } from "@/lib/invoice-api";
import { allCategories, createProduct, listProducts, parseProductInput } from "@/lib/invoice-catalog";

export const dynamic = "force-dynamic";

/** Daftar katalog + kategori. Gambar TIDAK ikut (ambil lewat /api/invoice-products/[id]/image). */
export async function GET() {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const [products, categories] = await Promise.all([listProducts(), allCategories()]);
    return Response.json({ ok: true, data: { products, categories } });
  } catch (error) {
    return invoiceFailure("GET /api/invoice-products", error);
  }
}

/** Tambah produk. Hanya Owner. Body: { name, description?, price?, tiers?, category?, image? (data URL) }. */
export async function POST(request: Request) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const product = await createProduct(parseProductInput(await readJson(request)));
    return Response.json({ ok: true, data: product }, { status: 201 });
  } catch (error) {
    return invoiceFailure("POST /api/invoice-products", error);
  }
}
