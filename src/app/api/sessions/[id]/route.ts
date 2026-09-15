import { revokeSession } from "@/lib/auth";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number.parseInt(id, 10);
  if (!Number.isFinite(sessionId)) {
    return Response.json({ ok: false, error: "ID sesi tidak valid." }, { status: 400 });
  }
  try {
    await revokeSession(sessionId);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/sessions/[id]", error);
    return Response.json({ ok: false, error: "Gagal logout perangkat." }, { status: 500 });
  }
}
