import { problemResponse } from "@/lib/dbcheck";
import { ensureShareToken, getOrderById } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Buat (atau ambil) token lacak untuk pekerjaan ini. Idempoten. */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId)) {
    return Response.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
  }
  try {
    const order = await getOrderById(orderId);
    if (!order) return Response.json({ ok: false, error: "Pekerjaan tidak ditemukan" }, { status: 404 });
    const token = await ensureShareToken(orderId);
    if (!token) return Response.json({ ok: false, error: "Gagal membuat tautan lacak." }, { status: 500 });
    return Response.json({ ok: true, token, url: `/lacak/${token}` });
  } catch (error) {
    console.error("POST /api/orders/[id]/share", error);
    return problemResponse(error);
  }
}

export async function GET(_request: Request, { params }: Params) {
  return POST(_request, { params });
}
