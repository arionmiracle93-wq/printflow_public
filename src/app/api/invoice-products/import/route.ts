import { requireInvoiceAccess } from "@/lib/invoice-access";
import { invoiceFailure, readJson } from "@/lib/invoice-api";
import { importProducts, type ImportItem } from "@/lib/invoice-catalog";

export const dynamic = "force-dynamic";

/**
 * Impor produk (CSV yang sudah dibaca di perangkat). Hanya Owner.
 * Body: { items: [{ name, description, price, tiers (teks), category, parent? }], mode: "merge" | "replace" }.
 * parent = path induk: "*" = induk utama, "*NOTA" = sub-induk di dalam NOTA, "NOTA" = varian langsung,
 * "NOTA > NCR A5" = varian di dalam sub-induk. Induk/sub-induk dibuat otomatis bila belum ada.
 * merge = gabungkan (isian kosong dilengkapi); replace = ganti seluruh katalog.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    const mode = body.mode === "replace" ? "replace" : "merge";
    const items = Array.isArray(body.items) ? (body.items as ImportItem[]) : [];
    const result = await importProducts(items, mode);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return invoiceFailure("POST /api/invoice-products/import", error);
  }
}
