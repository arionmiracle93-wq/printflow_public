import { problemResponse } from "@/lib/dbcheck";
import { deleteOutsource, listOutsource, saveOutsource } from "@/lib/outsource-queries";
import { isOutsourceStatus, outsourceStatusMeta } from "@/lib/outsource";
import { notifyInBackground } from "@/lib/push";
import { getOrderById } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

/**
 * PRODUKSI MITRA (bisa lebih dari satu mitra per pekerjaan)
 *
 * GET    -> { data: mitra pertama (kompatibel kode lama), jobs: semua mitra }
 * POST   -> tambah mitra (tanpa id) atau perbarui mitra (dengan id).
 *           itemIds opsional: produk yang dikerjakan mitra ini.
 * DELETE -> ?jobId=... hapus satu mitra, tanpa jobId hapus semua.
 */
export async function GET(_request: Request, { params }: Params) {
  const orderId = Number.parseInt((await params).id, 10);
  if (!Number.isFinite(orderId)) return Response.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
  try {
    const jobs = await listOutsource(orderId);
    return Response.json({ ok: true, data: jobs[0] ?? null, jobs });
  } catch (error) {
    return problemResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  const orderId = Number.parseInt((await params).id, 10);
  if (!Number.isFinite(orderId)) return Response.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const partnerName = typeof body.partnerName === "string" ? body.partnerName.trim() : "";
  const status = typeof body.status === "string" ? body.status : "belum_dikirim";
  const expectedDate = typeof body.expectedDate === "string" ? body.expectedDate : "";
  if (!partnerName || !expectedDate || !isOutsourceStatus(status)) {
    return Response.json({ ok: false, error: "Mitra, target kembali, dan status wajib diisi." }, { status: 400 });
  }
  const jobId = Number(body.id) || null;
  const itemIds = Array.isArray(body.itemIds)
    ? body.itemIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : undefined;
  try {
    const currentUser = await getCurrentUser();
    const row = await saveOutsource({
      id: jobId,
      orderId,
      partnerId: Number(body.partnerId) || null,
      partnerName,
      status,
      vendorCost: Math.max(0, Number(body.vendorCost) || 0),
      expectedDate,
      expectedTime: typeof body.expectedTime === "string" ? body.expectedTime : "12:00",
      notes: typeof body.notes === "string" ? body.notes.trim() : null,
      qcResult: typeof body.qcResult === "string" ? body.qcResult.trim() : null,
      itemIds,
      actor: currentUser?.name || "Pengguna",
    });
    if (!row) return Response.json({ ok: false, error: "Data mitra tidak ditemukan." }, { status: 404 });
    if (row.previousStatus !== status) {
      const order = await getOrderById(orderId);
      notifyInBackground({
        title: "Status Produksi Mitra berubah",
        body: `${order?.code ?? "Pekerjaan"} di ${partnerName}: ${outsourceStatusMeta(status).label}.`,
        url: `/pesanan/${orderId}`,
        tag: `mitra-${orderId}-${row.id}`,
      });
    }
    return Response.json({ ok: true, data: row });
  } catch (error) {
    return problemResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const orderId = Number.parseInt((await params).id, 10);
  if (!Number.isFinite(orderId)) return Response.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
  const jobId = Number(new URL(request.url).searchParams.get("jobId")) || undefined;
  try {
    await deleteOutsource(orderId, jobId);
    return Response.json({ ok: true });
  } catch (error) {
    return problemResponse(error);
  }
}
