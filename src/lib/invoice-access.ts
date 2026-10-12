import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

/**
 * HAK AKSES MODUL INVOICE
 *  - Owner: boleh semuanya.
 *  - Karyawan: boleh membuat invoice & mencatat pembayaran HANYA jika
 *    saklar "Boleh akses Invoice" di akunnya menyala (halaman Pengguna).
 *  - Hanya Owner: membatalkan invoice, membatalkan pembayaran, dan
 *    mengedit invoice yang sudah ada pembayarannya.
 */

const employeeCanInvoice = cache(async (userId: number): Promise<boolean> => {
  const rows = await db
    .select({ canInvoice: users.canInvoice })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return Boolean(rows[0]?.canInvoice);
});

export type InvoiceAccess = { user: CurrentUser; isOwner: boolean };

/** null = belum login atau tidak punya izin Invoice. Boleh melempar error database. */
export async function getInvoiceAccess(): Promise<InvoiceAccess | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role === "owner") return { user, isOwner: true };
  return (await employeeCanInvoice(user.id)) ? { user, isOwner: false } : null;
}

export type AccessResult =
  | { ok: true; access: InvoiceAccess }
  | { ok: false; response: Response };

/** Untuk route API: kembalikan akses, atau Response 401/403 siap dipakai. */
export async function requireInvoiceAccess(options: { ownerOnly?: boolean } = {}): Promise<AccessResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, response: Response.json({ ok: false, error: "Sesi login diperlukan." }, { status: 401 }) };
  }
  const access = await getInvoiceAccess();
  if (!access) {
    return {
      ok: false,
      response: Response.json(
        { ok: false, error: "Akun ini belum diberi izin membuka Invoice. Minta Owner menyalakannya di halaman Pengguna." },
        { status: 403 },
      ),
    };
  }
  if (options.ownerOnly && !access.isOwner) {
    return { ok: false, response: Response.json({ ok: false, error: "Aksi ini hanya untuk Owner." }, { status: 403 }) };
  }
  return { ok: true, access };
}
