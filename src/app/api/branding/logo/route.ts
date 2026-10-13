import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businessBranding } from "@/db/schema";
import { problemResponse } from "@/lib/dbcheck";

export const dynamic = "force-dynamic";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Ambil logo usaha.
 *
 * Dulu route ini mengirim `Cache-Control: no-store` dan langsung menarik
 * SELURUH byte gambar dari database pada setiap permintaan. Akibatnya:
 *   - setiap kali halaman dibuka, database mengirim ulang logo (bisa
 *     sampai 2 MB) padahal isinya tidak berubah;
 *   - browser tidak pernah menyimpannya, jadi gambar di kop dokumen,
 *     di sidebar, dan di tengah loader berputar semuanya mengunduh
 *     ulang sendiri-sendiri.
 *
 * Sekarang: metadata dulu (tanpa kolom `data`), ETag diturunkan dari
 * updatedAt, dan kalau If-None-Match sudah cocok jawabannya 304 tanpa
 * body. Logo hanya benar-benar ditarik dari database saat isinya memang
 * berubah. Maksanya jadi satu transfer saat logo diganti, setelah itu
 * cukup balasan 304 yang kecil.
 *
 * `max-age=0, must-revalidate` sengaja: logo harus langsung ikut berubah
 * begitu diunggah ulang. Menambah max-age akan membuat logo lama masih
 * tampil selama beberapa menit setelah diganti.
 */
export async function GET(request: Request) {
  try {
    // Metadata saja - kolom `data` sengaja tidak diambil di sini.
    const meta = await db
      .select({ mime: businessBranding.mime, updatedAt: businessBranding.updatedAt })
      .from(businessBranding)
      .where(eq(businessBranding.id, 1))
      .limit(1);
    const head = meta[0];
    if (!head) return new Response(null, { status: 404 });

    const etag = `"${new Date(head.updatedAt).getTime()}"`;
    const cache = "private, max-age=0, must-revalidate";
    // If-None-Match boleh berisi beberapa ETag (dipisah koma) dan bisa
    // memakai prefiks lemah W/. Membandingkan dengan === akan salah pada
    // kedua bentuk itu, sehingga browser mengunduh ulang logo.
    const diminta = request.headers.get("if-none-match");
    const cocok = diminta !== null && diminta.split(",").some((t) => t.trim().replace(/^W\//, "") === etag);
    if (cocok) {
      return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": cache } });
    }

    // Baru di sini gambarnya diambil, karena memang harus dikirim.
    const rows = await db
      .select({ data: businessBranding.data })
      .from(businessBranding)
      .where(eq(businessBranding.id, 1))
      .limit(1);
    if (!rows[0]) return new Response(null, { status: 404 });
    const data = new Uint8Array(rows[0].data);
    return new Response(data, {
      headers: {
        "Content-Type": head.mime,
        "Content-Length": String(data.byteLength),
        ETag: etag,
        "Cache-Control": cache,
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
