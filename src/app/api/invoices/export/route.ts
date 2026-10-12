import { requireInvoiceAccess } from "@/lib/invoice-access";
import { invoiceFailure } from "@/lib/invoice-api";
import { getExportRows, toCsv } from "@/lib/invoice-reports";

export const dynamic = "force-dynamic";

/** Export CSV rekap Invoice terbit. ?bulan=YYYY-MM (kosong = semua). Pemisah titik koma, seperti app lama. */
export async function GET(request: Request) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const bulan = new URL(request.url).searchParams.get("bulan") ?? "";
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(bulan) ? bulan : undefined;
    const rows = await getExportRows({ month });
    if (!rows.length) {
      return Response.json({ ok: false, error: month ? "Tidak ada Invoice pada bulan tersebut." : "Belum ada Invoice untuk diekspor." }, { status: 404 });
    }
    const csv = toCsv([
      ["No Invoice", "Tanggal Invoice", "Jatuh Tempo", "Customer", "No WhatsApp", "Metode Bayar", "Subtotal", "Diskon", "PPN", "Total", "DP", "Cicilan", "Jml Cicilan", "Total Dibayar", "Sisa", "Status", "Keterangan Tempo"],
      ...rows.map((r) => [r.number, r.issueDate, r.dueDate, r.customer, r.phone, r.method, r.subtotal, r.discount, r.tax, r.total, r.dp, r.installment, r.installmentCount, r.paid, r.remaining, r.status, r.dueNote]),
    ]);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rekap_invoice_${month ?? "semua"}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return invoiceFailure("GET /api/invoices/export", error);
  }
}
