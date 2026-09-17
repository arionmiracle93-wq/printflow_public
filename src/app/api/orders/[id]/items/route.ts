import { problemResponse } from "@/lib/dbcheck";
import { getCurrentUser } from "@/lib/auth";
import { listOrderItems, replaceOrderItems } from "@/lib/queries";
import { MAX_ITEMS_PER_ORDER, sanitizeItems } from "@/lib/order-items";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * ITEM PEKERJAAN (rincian produk di dalam satu pekerjaan).
 *
 * GET  → baca daftar produk sebuah pekerjaan.
 * PUT  → ganti SELURUH daftar produk dengan yang baru.
 *
 * Sengaja memakai PUT "ganti semua", bukan POST/DELETE per baris: tabel item
 * di halaman detail diedit sebagai satu kesatuan (tambah baris, ubah jumlah,
 * hapus baris, lalu tekan Simpan sekali). Dengan cara ini tidak ada keadaan
 * setengah jadi kalau koneksi putus di tengah pengeditan.
 */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId)) {
    return Response.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
  }
  try {
    return Response.json({ ok: true, data: await listOrderItems(orderId) });
  } catch (error) {
    console.error("GET /api/orders/[id]/items", error);
    return problemResponse(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId)) {
    return Response.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
  }

  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return Response.json({ ok: false, error: "Sesi login diperlukan." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const items = sanitizeItems(body.items);

  if (!items.length) {
    return Response.json(
      {
        ok: false,
        error:
          "Minimal harus ada satu baris produk. Isi jenis produk dan jumlahnya, atau hapus pekerjaannya kalau memang dibatalkan.",
      },
      { status: 400 },
    );
  }

  try {
    const saved = await replaceOrderItems(orderId, items);
    return Response.json({
      ok: true,
      data: saved,
      hint: `Tersimpan ${saved.length} item (maksimal ${MAX_ITEMS_PER_ORDER} per pekerjaan).`,
    });
  } catch (error) {
    console.error("PUT /api/orders/[id]/items", error);
    return problemResponse(error);
  }
}
