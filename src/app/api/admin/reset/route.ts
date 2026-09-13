import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { problemResponse } from "@/lib/dbcheck";
import { SEED_CUSTOMER_NAMES, SEED_ORDER_TITLES } from "@/lib/seed";

export const dynamic = "force-dynamic";

/**
 * Bersihkan data contoh (mode: "demo") atau kosongkan seluruh data (mode: "semua").
 * Dibuat supaya pemilik tidak perlu menghapus pekerjaan contoh satu per satu.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = body.mode === "semua" ? "semua" : "demo";

  // Kalau pemilik menyetel SETUP_TOKEN di Vercel, minta token sebagai konfirmasi.
  const token = process.env.SETUP_TOKEN;
  if (token) {
    const provided = typeof body.token === "string" ? body.token : request.headers.get("x-setup-token");
    if (provided !== token) {
      return Response.json({ ok: false, error: "Token keamanan salah." }, { status: 401 });
    }
  } else if (mode === "semua" && body.konfirmasi !== "HAPUS SEMUA") {
    return Response.json(
      { ok: false, error: 'Konfirmasi belum sesuai. Ketik persis: HAPUS SEMUA' },
      { status: 400 },
    );
  }

  try {
    if (mode === "semua") {
      await db.execute(sql.raw("truncate order_events, ai_notes, orders, customers restart identity cascade"));
      return Response.json({ ok: true, mode, deletedOrders: "semua", deletedCustomers: "semua" });
    }

    // Hapus pekerjaan contoh
    const removedOrders = await db
      .delete(orders)
      .where(inArray(orders.title, SEED_ORDER_TITLES))
      .returning({ id: orders.id });

    // Hapus pelanggan contoh yang sudah tidak punya pekerjaan
    const removedCustomers = await db
      .delete(customers)
      .where(inArray(customers.name, SEED_CUSTOMER_NAMES))
      .returning({ id: customers.id });

    return Response.json({
      ok: true,
      mode,
      deletedOrders: removedOrders.length,
      deletedCustomers: removedCustomers.length,
      note: "Data contoh berhasil dihapus. Aplikasi siap dipakai dengan data percetakan Anda sendiri.",
    });
  } catch (error) {
    console.error("POST /api/admin/reset", error);
    return problemResponse(error);
  }
}
