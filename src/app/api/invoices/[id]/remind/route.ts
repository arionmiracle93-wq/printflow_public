import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, invoiceEvents, invoices } from "@/db/schema";
import { requireInvoiceAccess } from "@/lib/invoice-access";
import { badId, invoiceFailure, parseId, readJson } from "@/lib/invoice-api";
import { formatWhatsAppNumber } from "@/lib/invoice-share";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

const TONES = ["halus", "biasa", "tegas"];

/**
 * Catat bahwa pengingat tagihan dikirim, dan simpan nomor WhatsApp pelanggan
 * (di invoice dan di daftar Pelanggan) supaya tidak perlu diketik ulang.
 * Body: { phone, tone }.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badId();
    const body = await readJson(request);
    const rawPhone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
    if (!formatWhatsAppNumber(rawPhone)) {
      return Response.json({ ok: false, error: "Nomor WhatsApp pelanggan belum valid." }, { status: 400 });
    }
    const tone = typeof body.tone === "string" && TONES.includes(body.tone) ? body.tone : "biasa";
    const [inv] = await db.select({ id: invoices.id, customerId: invoices.customerId, docType: invoices.docType, status: invoices.status, number: invoices.number, payStatus: invoices.payStatus }).from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!inv) return Response.json({ ok: false, error: "Invoice tidak ditemukan." }, { status: 404 });
    if (inv.docType !== "invoice" || inv.status !== "terbit") {
      return Response.json({ ok: false, error: "Pengingat hanya untuk Invoice yang sudah terbit." }, { status: 409 });
    }
    if (inv.payStatus === "lunas") {
      return Response.json({ ok: false, error: "Invoice ini sudah lunas, tidak perlu ditagih." }, { status: 409 });
    }
    await db.transaction(async (tx) => {
      await tx.update(invoices).set({ customerPhone: rawPhone, updatedAt: sql`now()` }).where(eq(invoices.id, id));
      if (inv.customerId) await tx.update(customers).set({ phone: rawPhone }).where(eq(customers.id, inv.customerId));
      await tx.insert(invoiceEvents).values({ invoiceId: id, kind: "pengingat", actor: auth.access.user.name, detail: `Pengingat tagihan dikirim via WhatsApp (nada ${tone}).` });
    });
    return Response.json({ ok: true });
  } catch (error) {
    return invoiceFailure("POST /api/invoices/[id]/remind", error);
  }
}
