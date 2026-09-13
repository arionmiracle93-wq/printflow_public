import { sql } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { problemResponse } from "@/lib/dbcheck";

export const dynamic = "force-dynamic";

/** Baca semua pengaturan ringan (mis. status checklist "sudah dipasang di HP"). */
export async function GET() {
  try {
    const rows = await db.select().from(settings);
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;
    return Response.json({ ok: true, data: map });
  } catch (error) {
    console.error("GET /api/settings", error);
    return problemResponse(error);
  }
}

/** Simpan satu nilai pengaturan. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const key = typeof body.key === "string" ? body.key.trim() : "";
    const value = typeof body.value === "string" ? body.value : "";
    if (!key) return Response.json({ ok: false, error: "Kunci pengaturan wajib diisi." }, { status: 400 });

    await db
      .insert(settings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });

    return Response.json({ ok: true, key, value });
  } catch (error) {
    console.error("POST /api/settings", error);
    return problemResponse(error);
  }
}


