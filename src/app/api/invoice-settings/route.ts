import { db } from "@/db";
import { settings } from "@/db/schema";
import { requireInvoiceAccess } from "@/lib/invoice-access";
import { invoiceFailure, readJson } from "@/lib/invoice-api";
import { INVOICE_SETTINGS_KEY, getInvoiceSettings, qrisProblem, sanitizeInvoiceSettings } from "@/lib/invoice-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    return Response.json({ ok: true, data: await getInvoiceSettings() });
  } catch (error) {
    return invoiceFailure("GET /api/invoice-settings", error);
  }
}

/** Simpan identitas usaha untuk invoice. Hanya Owner. */
export async function PUT(request: Request) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    const value = sanitizeInvoiceSettings({
      ...body,
      // Form mengirim syarat sebagai teks satu-per-baris.
      defaultTerms: typeof body.defaultTerms === "string" ? body.defaultTerms.split(/\r?\n/) : body.defaultTerms,
    });
    const problem = qrisProblem(value.qris);
    if (problem) return Response.json({ ok: false, error: problem }, { status: 400 });
    await db
      .insert(settings)
      .values({ key: INVOICE_SETTINGS_KEY, value: JSON.stringify(value), updatedAt: new Date() })
      .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(value), updatedAt: new Date() } });
    return Response.json({ ok: true, data: await getInvoiceSettings() });
  } catch (error) {
    return invoiceFailure("PUT /api/invoice-settings", error);
  }
}
