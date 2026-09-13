import { problemResponse } from "@/lib/dbcheck";
import { createPartner, listPartners } from "@/lib/outsource-queries";
import { PARTNER_KINDS } from "@/lib/outsource";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ ok: true, data: await listPartners() });
  } catch (error) {
    return problemResponse(error);
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const kind = typeof body.kind === "string" && PARTNER_KINDS.some((k) => k.key === body.kind) ? body.kind : "vendor";
  if (!name) return Response.json({ ok: false, error: "Nama mitra wajib diisi." }, { status: 400 });
  try {
    const row = await createPartner({
      name,
      kind,
      phone: typeof body.phone === "string" ? body.phone.trim() : "",
      address: typeof body.address === "string" ? body.address.trim() : "",
      notes: typeof body.notes === "string" ? body.notes.trim() : "",
    });
    return Response.json({ ok: true, data: row }, { status: 201 });
  } catch (error) {
    return problemResponse(error);
  }
}
