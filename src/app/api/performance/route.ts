import { sql } from "drizzle-orm";
import { db, databaseHost } from "@/db";
import { problemResponse } from "@/lib/dbcheck";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = performance.now();
  try {
    const firstStart = performance.now();
    await db.execute(sql`select 1`);
    const firstMs = performance.now() - firstStart;

    const secondStart = performance.now();
    await db.execute(sql`select 1`);
    const secondMs = performance.now() - secondStart;
    const totalMs = performance.now() - started;

    const level = firstMs < 250 ? "cepat" : firstMs < 800 ? "cukup" : firstMs < 2_500 ? "lambat" : "sangat_lambat";
    const advice =
      firstMs >= 800
        ? [
            "Pastikan DATABASE_URL memakai host Neon yang mengandung -pooler.",
            "Gunakan region Neon Singapore dan region Vercel yang dekat (Singapore bila tersedia).",
            "Tes ulang dua kali: permintaan pertama bisa cold start, permintaan kedua biasanya lebih cepat.",
          ]
        : ["Koneksi database normal. Jeda kecil pertama kemungkinan cold start Vercel/Neon."];

    return Response.json(
      {
        ok: true,
        level,
        databaseHost: databaseHost(),
        pooled: databaseHost()?.includes("pooler") ?? false,
        firstQueryMs: Math.round(firstMs),
        warmQueryMs: Math.round(secondMs),
        totalMs: Math.round(totalMs),
        advice,
        testedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "Server-Timing": `db-first;dur=${firstMs.toFixed(1)}, db-warm;dur=${secondMs.toFixed(1)}`,
        },
      },
    );
  } catch (error) {
    return problemResponse(error);
  }
}
