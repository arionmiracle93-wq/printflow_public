import { problemResponse } from "@/lib/dbcheck";
import { acceptHandover, createHandover, listHandovers } from "@/lib/handover-queries";
import { notifyInBackground } from "@/lib/push";
import { getOrderById } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { getActiveEmployee } from "@/lib/user-queries";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const orderId = Number.parseInt((await params).id, 10);
  try { return Response.json({ ok: true, data: await listHandovers(orderId) }); }
  catch (error) { return problemResponse(error); }
}

export async function POST(request: Request, { params }: Params) {
  const orderId = Number.parseInt((await params).id, 10);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return Response.json({ ok: false, error: "Sesi login diperlukan." }, { status: 401 });
  const action = typeof body.action === "string" ? body.action : "create";
  try {
    if (action === "accept") {
      const acceptedBy = sessionUser.name;
      const handoverId = Number(body.handoverId);
      if (!acceptedBy || !handoverId) return Response.json({ ok: false, error: "Data penerimaan tidak lengkap." }, { status: 400 });
      const handover = (await listHandovers(orderId)).find(
        (item) => item.id === handoverId && item.status === "menunggu",
      );
      if (!handover) return Response.json({ ok: false, error: "Serah terima tidak ditemukan atau sudah diterima." }, { status: 404 });
      const isTarget = handover.toUserId
        ? handover.toUserId === sessionUser.id
        : handover.toOperator.trim().toLocaleLowerCase("id-ID") === sessionUser.name.trim().toLocaleLowerCase("id-ID");
      if (!isTarget) {
        return Response.json(
          { ok: false, error: `Serah terima ini ditujukan kepada ${handover.toOperator}, bukan akun ${sessionUser.name}.` },
          { status: 403 },
        );
      }
      const row = await acceptHandover({ id: handoverId, orderId, acceptedBy });
      if (!row) return Response.json({ ok: false, error: "Serah terima sudah diterima atau tidak ditemukan." }, { status: 404 });
      const order = await getOrderById(orderId);
      notifyInBackground({
        title: "Serah terima sudah diterima",
        body: `${acceptedBy} menerima ${order?.code ?? "pekerjaan"}${order ? ` — ${order.title}` : ""}.`,
        url: `/pesanan/${orderId}`,
        tag: `shift-${orderId}`,
      });
      return Response.json({ ok: true, data: row });
    }

    const existing = await listHandovers(orderId);
    if (existing.some((row) => row.status === "menunggu")) {
      return Response.json(
        { ok: false, error: "Masih ada serah terima yang menunggu. Terima mutasi tersebut sebelum membuat yang baru." },
        { status: 409 },
      );
    }
    const fromOperator = sessionUser.role === "owner" && typeof body.fromOperator === "string" && body.fromOperator.trim()
      ? body.fromOperator.trim()
      : sessionUser.name;
    const targetUserId = Number(body.toUserId);
    const targetEmployee = Number.isFinite(targetUserId) ? await getActiveEmployee(targetUserId) : null;
    if (!targetEmployee) {
      return Response.json({ ok: false, error: "Pilih akun Karyawan aktif sebagai tujuan serah-terima." }, { status: 400 });
    }
    if (targetEmployee.id === sessionUser.id) {
      return Response.json({ ok: false, error: "Pekerjaan tidak dapat diserahkan kepada akun sendiri." }, { status: 400 });
    }
    const toOperator = targetEmployee.name;
    const lastPosition = typeof body.lastPosition === "string" ? body.lastPosition.trim() : "";
    const nextAction = typeof body.nextAction === "string" ? body.nextAction.trim() : "";
    if (!fromOperator || !toOperator || !lastPosition || !nextAction) {
      return Response.json({ ok: false, error: "Operator asal/tujuan, posisi terakhir, dan tindakan berikutnya wajib diisi." }, { status: 400 });
    }
    const row = await createHandover({
      orderId, fromOperator, toOperator, toUserId: targetEmployee.id, lastPosition, nextAction,
      shiftLabel: typeof body.shiftLabel === "string" ? body.shiftLabel.trim() : null,
      blocker: typeof body.blocker === "string" ? body.blocker.trim() : null,
      note: typeof body.note === "string" ? body.note.trim() : null,
    });
    const order = await getOrderById(orderId);
    notifyInBackground({
      title: `Mutasi shift untuk ${toOperator}`,
      body: `${fromOperator} menyerahkan ${order?.code ?? "pekerjaan"}. Berikutnya: ${nextAction}`,
      url: `/pesanan/${orderId}`,
      tag: `shift-${orderId}`,
      requireInteraction: true,
    }, toOperator, targetEmployee.id);
    return Response.json({ ok: true, data: row }, { status: 201 });
  } catch (error) { return problemResponse(error); }
}
