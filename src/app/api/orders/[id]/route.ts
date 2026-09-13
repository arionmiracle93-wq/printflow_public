import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { isStatusKey } from "@/lib/domain";
import { problemResponse } from "@/lib/dbcheck";
import { getOrderById, getOrderEvents, saveAiNote, updateOrderStatus } from "@/lib/queries";
import { analyzeOrder } from "@/lib/ai";
import { notifyInBackground } from "@/lib/push";
import { statusMeta } from "@/lib/domain";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId)) {
    return Response.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
  }
  try {
    const order = await getOrderById(orderId);
    if (!order) return Response.json({ ok: false, error: "Pekerjaan tidak ditemukan" }, { status: 404 });
    const events = await getOrderEvents(orderId);
    return Response.json({ ok: true, data: { order, events, insight: analyzeOrder(order) } });
  } catch (error) {
    console.error("GET /api/orders/[id]", error);
    return problemResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId)) {
    return Response.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return Response.json({ ok: false, error: "Sesi login diperlukan." }, { status: 401 });

  // Ubah status
  if (typeof body.status === "string") {
    const status = body.status;
    if (!isStatusKey(status)) {
      return Response.json({ ok: false, error: "Status tidak dikenal" }, { status: 400 });
    }
    try {
      const result = await updateOrderStatus(
        orderId,
        status,
        typeof body.note === "string" ? body.note : null,
        sessionUser.name,
      );
      if (!result) return Response.json({ ok: false, error: "Pekerjaan tidak ditemukan" }, { status: 404 });
      const updated = await getOrderById(orderId);
      if (updated) {
        const insight = analyzeOrder(updated);
        void saveAiNote({
          orderId,
          riskScore: insight.riskScore,
          riskLevel: insight.riskLevel,
          message: `Status → ${insight.statusLabel}. ${insight.headline}`,
          source: "engine",
          kind: "status",
        }).catch(() => undefined);
        const meta = statusMeta(status);
        notifyInBackground({
          title: "Status pekerjaan berubah",
          body: `${updated.code} — ${updated.title} sekarang ${meta.label}.`,
          url: `/pesanan/${orderId}`,
          tag: `status-${orderId}`,
        });
      }
      return Response.json({ ok: true, data: result });
    } catch (error) {
      console.error("PATCH /api/orders/[id] (status)", error);
      return problemResponse(error);
    }
  }

  // Ubah data pekerjaan
  try {
    const patch: Partial<typeof orders.$inferInsert> = { updatedAt: new Date() };
    if (typeof body.title === "string") patch.title = body.title;
    if (typeof body.customerName === "string") patch.customerName = body.customerName;
    if (typeof body.machine === "string") patch.machine = body.machine;
    if (typeof body.operator === "string") patch.operator = body.operator;
    if (typeof body.priority === "string") patch.priority = body.priority;
    if (typeof body.notes === "string") patch.notes = body.notes;
    if (typeof body.dueDate === "string") patch.dueDate = body.dueDate;
    if (typeof body.dueTime === "string") patch.dueTime = body.dueTime;
    if (body.quantity !== undefined) patch.quantity = Math.max(1, Number(body.quantity) || 1);
    if (body.price !== undefined) patch.price = Math.max(0, Number(body.price) || 0);
    if (body.paidAmount !== undefined) patch.paidAmount = Math.max(0, Number(body.paidAmount) || 0);

    await db.update(orders).set(patch).where(eq(orders.id, orderId));
    const updated = await getOrderById(orderId);
    return Response.json({ ok: true, data: updated });
  } catch (error) {
    console.error("PATCH /api/orders/[id]", error);
    return problemResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId)) {
    return Response.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
  }
  try {
    await db.delete(orders).where(eq(orders.id, orderId));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/orders/[id]", error);
    return problemResponse(error);
  }
}
