import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = Number.parseInt(id, 10);
  if (!Number.isFinite(customerId)) {
    return Response.json({ ok: false, error: "ID pelanggan tidak valid." }, { status: 400 });
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return Response.json({ ok: false, error: "Nama pelanggan wajib diisi." }, { status: 400 });
    }
    const [updated] = await db
      .update(customers)
      .set({
        name,
        phone: typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
        email: typeof body.email === "string" && body.email.trim() ? body.email.trim() : null,
        address: typeof body.address === "string" && body.address.trim() ? body.address.trim() : null,
        notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
      })
      .where(eq(customers.id, customerId))
      .returning();
    if (!updated) {
      return Response.json({ ok: false, error: "Pelanggan tidak ditemukan." }, { status: 404 });
    }
    return Response.json({ ok: true, data: updated });
  } catch (error) {
    console.error("PATCH /api/customers/[id]", error);
    return Response.json({ ok: false, error: "Gagal memperbarui data pelanggan." }, { status: 500 });
  }
}
