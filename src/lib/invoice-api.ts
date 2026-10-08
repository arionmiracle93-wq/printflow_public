import "server-only";
import { problemResponse } from "@/lib/dbcheck";
import { invoiceErrorResponse } from "@/lib/invoice-queries";

/** Ubah "12" menjadi 12; selain itu null (id tidak valid). */
export function parseId(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 && String(n) === value.trim() ? n : null;
}

export function badId(label = "Invoice"): Response {
  return Response.json({ ok: false, error: `${label} tidak valid.` }, { status: 400 });
}

/** Baca body JSON dengan aman (body kosong/rusak → objek kosong). */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => ({}));
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

/** Satu tempat untuk menerjemahkan error: pesan kasir (InvoiceError) → 4xx, masalah database → penjelasan awam. */
export function invoiceFailure(scope: string, error: unknown): Response {
  const friendly = invoiceErrorResponse(error);
  if (friendly) return friendly;
  console.error(scope, error);
  return problemResponse(error);
}
