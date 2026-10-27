import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businessBranding } from "@/db/schema";
import { problemResponse } from "@/lib/dbcheck";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Sisi gambar pratinjau (persegi). SENGAJA KECIL (200 px): WhatsApp memakai
 * gambar di bawah ±300 px sebagai thumbnail kecil di samping nama usaha.
 * Kalau lebih besar, WhatsApp menampilkannya sebagai banner besar di atas.
 */
const SIZE = 200;
/** Ruang kosong putih di sekeliling logo supaya tidak mepet tepi kartu. */
const PADDING = 20;
/**
 * WhatsApp membuang gambar pratinjau yang terlalu besar (batasnya kira-kira
 * 300 KB). Kalau perapian gambar gagal dan logo asli masih di bawah batas ini,
 * logo asli dikirim apa adanya sebagai jalan terakhir.
 */
const MAX_RAW_FALLBACK_BYTES = 280 * 1024;

/**
 * Gambar kartu pratinjau WhatsApp untuk halaman lacak.
 *
 * Isinya logo usaha yang sama dengan halaman Pengaturan, tetapi dirapikan:
 *   - persegi 200x200 -> WhatsApp menampilkannya sebagai thumbnail kecil di
 *     samping nama usaha (bukan banner besar);
 *   - latar putih, jadi logo transparan tetap terbaca;
 *   - format JPEG ringan (biasanya < 10 KB), apa pun format logo aslinya
 *     (PNG / JPG / WEBP) dan berapa pun ukurannya (sampai 2 MB).
 *
 * Route ini sengaja publik (GET saja) karena yang mengambilnya adalah server
 * WhatsApp, bukan pengguna yang login. Isinya hanya logo usaha, sama seperti
 * /api/branding/logo yang memang sudah publik. URL-nya membawa ?v=<versi logo>,
 * jadi aman di-cache lama: logo diganti -> URL berubah.
 */
export async function GET(request: Request) {
  try {
    const meta = await db
      .select({ mime: businessBranding.mime, updatedAt: businessBranding.updatedAt })
      .from(businessBranding)
      .where(eq(businessBranding.id, 1))
      .limit(1);
    const head = meta[0];
    if (!head) return new Response(null, { status: 404 });

    const etag = `"pv2-${new Date(head.updatedAt).getTime()}"`;
    const cache = "public, max-age=86400, stale-while-revalidate=604800";
    const diminta = request.headers.get("if-none-match");
    const cocok = diminta !== null && diminta.split(",").some((t) => t.trim().replace(/^W\//, "") === etag);
    if (cocok) {
      return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": cache } });
    }

    const rows = await db
      .select({ data: businessBranding.data })
      .from(businessBranding)
      .where(eq(businessBranding.id, 1))
      .limit(1);
    if (!rows[0]) return new Response(null, { status: 404 });
    const raw = Buffer.from(rows[0].data);

    try {
      const sharp = (await import("sharp")).default;
      const inner = SIZE - PADDING * 2;
      const jpeg = await sharp(raw)
        .rotate() // hormati orientasi EXIF dari foto/logo hasil kamera
        .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .flatten({ background: "#ffffff" })
        .extend({ top: PADDING, bottom: PADDING, left: PADDING, right: PADDING, background: "#ffffff" })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
      return new Response(new Uint8Array(jpeg), {
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": String(jpeg.byteLength),
          ETag: etag,
          "Cache-Control": cache,
        },
      });
    } catch (error) {
      console.error("Rapikan logo pratinjau gagal, pakai logo asli", error);
      const bolehApaAdanya = (head.mime === "image/png" || head.mime === "image/jpeg") && raw.byteLength <= MAX_RAW_FALLBACK_BYTES;
      if (!bolehApaAdanya) return new Response(null, { status: 404 });
      return new Response(new Uint8Array(raw), {
        headers: {
          "Content-Type": head.mime,
          "Content-Length": String(raw.byteLength),
          ETag: etag,
          "Cache-Control": cache,
        },
      });
    }
  } catch (error) {
    console.error("GET branding preview", error);
    return problemResponse(error);
  }
}
