import { requireInvoiceAccess } from "@/lib/invoice-access";
import { invoiceFailure } from "@/lib/invoice-api";
import { getProductPriceHistory } from "@/lib/invoice-catalog";

export const dynamic = "force-dynamic";

/**
 * Riwayat harga suatu produk dari invoice yang sudah terbit (maks 6 terakhir).
 * Query: ?name=<nama lengkap di baris invoice> — bila kosong dipakai nama produk.
 * Cocokkan nama karena baris invoice menyimpan nama produk, bukan id katalog.
 * Semua akun berizin Invoice boleh melihat (dipakai operator di dialog Set Harga).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const { id } = await params;
    const pid = Number(id);
    if (!Number.isInteger(pid) || pid <= 0) {
      return Response.json({ ok: false, error: "ID produk tidak valid." }, { status: 400 });
    }
    const name = new URL(request.url).searchParams.get("name") ?? "";
    const rows = await getProductPriceHistory(name);
    return Response.json({ ok: true, data: { rows } });
  } catch (error) {
    return invoiceFailure("GET /api/invoice-products/[id]/price-history", error);
  }
}
