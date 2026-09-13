import { db } from "@/db";
import { customers } from "@/db/schema";
import { listCustomers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await listCustomers();
  return Response.json({ ok: true, data: rows });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return Response.json({ ok: false, error: "Nama pelanggan wajib diisi." }, { status: 400 });
    }
    const [created] = await db
      .insert(customers)
      .values({
        name,
        phone: typeof body.phone === "string" ? body.phone : null,
        email: typeof body.email === "string" ? body.email : null,
        address: typeof body.address === "string" ? body.address : null,
        notes: typeof body.notes === "string" ? body.notes : null,
      })
      .returning();
    return Response.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/customers", error);
    return Response.json({ ok: false, error: "Gagal menyimpan pelanggan." }, { status: 500 });
  }
}
