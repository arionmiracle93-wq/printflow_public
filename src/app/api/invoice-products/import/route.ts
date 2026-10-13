import { requireInvoiceAccess } from "@/lib/invoice-access";
import { invoiceFailure, readJson } from "@/lib/invoice-api";
import { importProducts, sampleItems, type ImportItem } from "@/lib/invoice-catalog";

export const dynamic = "force-dynamic";

/**
 * Impor produk (CSV yang sudah dibaca di perangkat, atau contoh). Hanya Owner.
 * Body: { items: [{ name, description, price, tiers (teks), category }], mode: "merge" | "replace" } atau { sample: true }.
 * merge = gabungkan (isian kosong dilengkapi); replace = ganti seluruh katalog.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    const mode = body.mode === "replace" ? "replace" : "merge";
    const items = body.sample === true ? sampleItems() : Array.isArray(body.items) ? (body.items as ImportItem[]) : [];
    const result = await importProducts(items, body.sample === true ? "merge" : mode);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return invoiceFailure("POST /api/invoice-products/import", error);
  }
}
