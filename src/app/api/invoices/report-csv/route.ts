import { jakartaDateISO } from "@/lib/domain";
import { requireInvoiceAccess } from "@/lib/invoice-access";
import { invoiceFailure } from "@/lib/invoice-api";
import { buildPeriod } from "@/lib/invoice-period";
import { getExportRows, getReport, periodLabelForCsv, toCsv } from "@/lib/invoice-reports";

export const dynamic = "force-dynamic";

/** Export CSV Laporan (Bulanan/Harian/Rentang) - format sama dengan app lama. Hanya Owner. */
export async function GET(request: Request) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const sp = new URL(request.url).searchParams;
    const period = buildPeriod(
      { mode: sp.get("mode") ?? undefined, bulan: sp.get("bulan") ?? undefined, tanggal: sp.get("tanggal") ?? undefined, dari: sp.get("dari") ?? undefined, sampai: sp.get("sampai") ?? undefined },
      jakartaDateISO(),
    );
    const [rep, prev, rows] = await Promise.all([
      getReport(period.from, period.to),
      getReport(period.prevFrom, period.prevTo),
      getExportRows({ from: period.from, to: period.to }),
    ]);
    if (!rep.count) return Response.json({ ok: false, error: "Tidak ada data pada periode ini." }, { status: 404 });
    const csv = toCsv([
      [periodLabelForCsv(period), period.label],
      [],
      ["RINGKASAN"],
      ["Omzet", rep.omzet],
      ["Jumlah invoice", rep.count],
      ["Rata-rata per invoice", Math.round(rep.avg)],
      ["Sudah dibayar", rep.terbayar],
      ["Belum dibayar", rep.piutang],
      ["Invoice lunas", rep.lunasCount],
      [`Omzet ${period.prevLabel}`, prev.omzet],
      [],
      ["PRODUK TERLARIS"],
      ["Produk", "Qty", "Jumlah Transaksi", "Total"],
      ...rep.products.map((r) => [r.name, r.qty, r.count, r.amount]),
      [],
      ["PELANGGAN TERATAS"],
      ["Pelanggan", "Jumlah Invoice", "Total"],
      ...rep.customers.map((r) => [r.name, r.count, r.amount]),
      [],
      ["RINCIAN INVOICE"],
      ["No Invoice", "Tanggal", "Customer", "Total", "Dibayar", "Sisa", "Status"],
      ...rows.map((r) => [r.number, r.issueDate, r.customer, r.total, r.paid, r.remaining, r.status]),
    ]);
    const name = period.mode === "monthly" ? period.from.slice(0, 7) : period.mode === "daily" ? period.from : `${period.from}_${period.to}`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="laporan_${name}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return invoiceFailure("GET /api/invoices/report-csv", error);
  }
}
