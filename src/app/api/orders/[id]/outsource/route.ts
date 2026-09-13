import { problemResponse } from "@/lib/dbcheck";
import { deleteOutsource, getOutsource, upsertOutsource } from "@/lib/outsource-queries";
import { isOutsourceStatus, outsourceStatusMeta } from "@/lib/outsource";
import { notifyInBackground } from "@/lib/push";
import { getOrderById } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const orderId = Number.parseInt((await params).id, 10);
  if (!Number.isFinite(orderId)) return Response.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
  try {
    return Response.json({ ok: true, data: await getOutsource(orderId) });
  } catch (error) {
    return problemResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  const orderId = Number.parseInt((await params).id, 10);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const partnerName = typeof body.partnerName === "string" ? body.partnerName.trim() : "";
  const status = typeof body.status === "string" ? body.status : "belum_dikirim";
  const expectedDate = typeof body.expectedDate === "string" ? body.expectedDate : "";
  if (!partnerName || !expectedDate || !isOutsourceStatus(status)) {
    return Response.json({ ok: false, error: "Mitra, target kembali, dan status wajib diisi." }, { status: 400 });
  }
  try {
    const [previous, currentUser] = await Promise.all([getOutsource(orderId), getCurrentUser()]);
    const row = await upsertOutsource({
      orderId,
      partnerId: Number(body.partnerId) || null,
      partnerName,
      status,
      vendorCost: Math.max(0, Number(body.vendorCost) || 0),
      expectedDate,
      expectedTime: typeof body.expectedTime === "string" ? body.expectedTime : "12:00",
      notes: typeof body.notes === "string" ? body.notes.trim() : null,
      qcResult: typeof body.qcResult === "string" ? body.qcResult.trim() : null,
      actor: currentUser?.name || "Pengguna",
    });
    if (!previous || previous.status !== status) {
      const order = await getOrderById(orderId);
      notifyInBackground({
        title: "Status Produksi Mitra berubah",
        body: `${order?.code ?? "Pekerjaan"} di ${partnerName}: ${outsourceStatusMeta(status).label}.`,
        url: `/pesanan/${orderId}`,
        tag: `mitra-${orderId}`,
      });
    }
    return Response.json({ ok: true, data: row });
  } catch (error) {
    return problemResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const orderId = Number.parseInt((await params).id, 10);
  try {
    await deleteOutsource(orderId);
    return Response.json({ ok: true });
  } catch (error) {
    return problemResponse(error);
  }
}
