import { createInvoice, getInvoiceDetail, listInvoices, parseInvoiceInput, parsePaymentInput } from "@/lib/invoice-queries";
import { requireInvoiceAccess } from "@/lib/invoice-access";
import { invoiceFailure, readJson } from "@/lib/invoice-api";

export const dynamic = "force-dynamic";

/** Daftar dokumen. Filter: ?docType=invoice|estimasi|suratjalan|po &status=draft|terbit|batal &payStatus=belum|sebagian|lunas &q=cari &limit= &offset= */
export async function GET(request: Request) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const url = new URL(request.url);
    const data = await listInvoices({
      docType: url.searchParams.get("docType") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      payStatus: url.searchParams.get("payStatus") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      limit: Number.parseInt(url.searchParams.get("limit") ?? "", 10) || undefined,
      offset: Number.parseInt(url.searchParams.get("offset") ?? "", 10) || undefined,
    });
    return Response.json({ ok: true, data });
  } catch (error) {
    return invoiceFailure("GET /api/invoices", error);
  }
}

/**
 * Buat invoice.
 * Body: data invoice (customerName, items, ...) + opsional
 *   issue: true  → langsung terbitkan (nomor resmi keluar),
 *   dp: { amount, method, note }  → DP awal (hanya bila issue: true),
 *   clientRef: kode unik dari perangkat (anti-dobel).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    const input = parseInvoiceInput(body);
    const dp = body.dp && typeof body.dp === "object" ? parsePaymentInput(body.dp) : null;
    const result = await createInvoice(input, auth.access.user.name, {
      issue: body.issue === true,
      dp,
      clientRef: typeof body.clientRef === "string" ? body.clientRef : null,
    });
    const data = await getInvoiceDetail(result.id);
    return Response.json({ ok: true, data, duplicate: result.duplicate }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return invoiceFailure("POST /api/invoices", error);
  }
}
