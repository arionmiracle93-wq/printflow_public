import { requireInvoiceAccess } from "@/lib/invoice-access";
import { invoiceFailure } from "@/lib/invoice-api";
import { getExportRows, toCsv } from "@/lib/invoice-reports";

export const dynamic = "force-dynamic";

/** Export CSV rekap Invoice terbit. Kosong = semua.
 *
 *  Dua bentuk penyaring, keduanya tentang TANGGAL DOKUMEN:
 *   ?bulan=YYYY-MM          satu bulan
 *   ?dari=&sampai=YYYY-MM-DD  rentang, inklusif di kedua ujung
 *
 *  Kalau rentang terisi, bulan diabaikan - bukan diiris dengan bulan.
 *  Halaman pemanggil juga tidak pernah mengirim keduanya.
 *
 *  ?status=belum|sebagian|lunas|lewat (opsional) menyamakan isi file dengan
 *  filter status yang sedang tampil di halaman riwayat. */
export async function GET(request: Request) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const sp = new URL(request.url).searchParams;
    const bulan = sp.get("bulan") ?? "";
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(bulan) ? bulan : undefined;
    const dariParam = sp.get("dari") ?? "";
    const sampaiParam = sp.get("sampai") ?? "";
    const from = /^\d{4}-\d{2}-\d{2}$/.test(dariParam) ? dariParam : undefined;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(sampaiParam) ? sampaiParam : undefined;
    // getExportRows hanya memakai from/to kalau KEDUANYA ada, jadi
    // rentang setengah jadi "tanpa filter" - bukan "dari 1 Okt tak
    // terbatas", yang diam-diam menambah dokumen dari masa depan.
    const statusParam = sp.get("status") ?? "";
    const payStatus = ["belum", "sebagian", "lunas", "lewat"].includes(statusParam) ? statusParam : undefined;
    const rows = await getExportRows({ month, from, to, payStatus });
    const punyaRentang = Boolean(from && to);
    if (!rows.length) {
      return Response.json(
        {
          ok: false,
          error: month || punyaRentang || payStatus ? "Tidak ada Invoice pada periode/filter tersebut." : "Belum ada Invoice untuk diekspor.",
        },
        { status: 404 },
      );
    }
    const csv = toCsv([
      ["No Invoice", "Tanggal Invoice", "Jatuh Tempo", "Customer", "No WhatsApp", "Metode Bayar", "Subtotal", "Diskon", "PPN", "Total", "DP", "Cicilan", "Jml Cicilan", "Total Dibayar", "Sisa", "Status", "Keterangan Tempo"],
      ...rows.map((r) => [r.number, r.issueDate, r.dueDate, r.customer, r.phone, r.method, r.subtotal, r.discount, r.tax, r.total, r.dp, r.installment, r.installmentCount, r.paid, r.remaining, r.status, r.dueNote]),
    ]);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rekap_invoice_${[month ?? (punyaRentang ? (from === to ? from : `${from}_sampai_${to}`) : "semua"), payStatus].filter(Boolean).join("_")}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return invoiceFailure("GET /api/invoices/export", error);
  }
}
