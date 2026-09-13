import { problemResponse } from "@/lib/dbcheck";
import { deletePhoto } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; photoId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { id, photoId } = await params;
  const orderId = Number.parseInt(id, 10);
  const pid = Number.parseInt(photoId, 10);
  if (!Number.isFinite(orderId) || !Number.isFinite(pid)) {
    return Response.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
  }
  try {
    const removed = await deletePhoto(pid, orderId);
    if (!removed) return Response.json({ ok: false, error: "Foto tidak ditemukan" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE photo", error);
    return problemResponse(error);
  }
}
