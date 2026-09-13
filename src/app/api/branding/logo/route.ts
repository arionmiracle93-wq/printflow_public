import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businessBranding } from "@/db/schema";
import { problemResponse } from "@/lib/dbcheck";

export const dynamic = "force-dynamic";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function GET() {
  try {
    const rows = await db.select().from(businessBranding).where(eq(businessBranding.id, 1)).limit(1);
    const logo = rows[0];
    if (!logo) return new Response(null, { status: 404 });
    const data = new Uint8Array(logo.data);
    return new Response(data, {
      headers: {
        "Content-Type": logo.mime,
        "Content-Length": String(data.byteLength),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("GET branding logo", error);
    return problemResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: "Pilih berkas logo terlebih dahulu." }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return Response.json({ ok: false, error: "Format logo harus PNG, JPG, atau WEBP." }, { status: 400 });
    }
    const data = Buffer.from(await file.arrayBuffer());
    if (!data.length) return Response.json({ ok: false, error: "Berkas logo kosong." }, { status: 400 });
    if (data.length > MAX_LOGO_BYTES) {
      return Response.json({ ok: false, error: "Ukuran logo maksimal 2 MB." }, { status: 413 });
    }

    await db
      .insert(businessBranding)
      .values({ id: 1, mime: file.type, sizeBytes: data.length, data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: businessBranding.id,
        set: { mime: file.type, sizeBytes: data.length, data, updatedAt: new Date() },
      });

    return Response.json({ ok: true, sizeBytes: data.length, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("POST branding logo", error);
    return problemResponse(error);
  }
}

export async function DELETE() {
  try {
    await db.delete(businessBranding).where(eq(businessBranding.id, 1));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE branding logo", error);
    return problemResponse(error);
  }
}
