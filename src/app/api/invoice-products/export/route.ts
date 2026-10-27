import { requireInvoiceAccess } from "@/lib/invoice-access";
import { invoiceFailure } from "@/lib/invoice-api";
import { catalogCsvRows } from "@/lib/invoice-catalog";
import { toCsv } from "@/lib/invoice-reports";

export const dynamic = "force-dynamic";

/** Export CSV katalog (tanpa gambar): Nama Produk;Keterangan;Harga;Harga Bertingkat;Kategori;Induk. Kolom Induk memakai path: "*" = induk utama, "*NOTA" = sub-induk, "NOTA > NCR A5" = varian di sub-induk. */
export async function GET() {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const rows = await catalogCsvRows();
    if (rows.length < 2) return Response.json({ ok: false, error: "Katalog produk masih kosong." }, { status: 404 });
    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="katalog_produk.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return invoiceFailure("GET /api/invoice-products/export", error);
  }
}
