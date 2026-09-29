import { timingSafeEqual } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { problemResponse } from "@/lib/dbcheck";
import { getPhotoBlobStream } from "@/lib/photo-storage";
import { getPhotoBlob } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function sameToken(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * MENYAJIKAN FOTO PEKERJAAN
 * ---------------------------------------------------------------------
 * Siapa yang boleh melihat:
 *   - pengguna yang sedang login (Owner / Karyawan), atau
 *   - pelanggan yang membuka halaman lacak, lewat ?t=<token lacak>.
 * Dulu rute ini terbuka tanpa pemeriksaan apa pun dan nomor fotonya
 * berurutan, sehingga siapa saja bisa membuka semua foto desain dan nota
 * dengan menebak angka. Izin sekarang diperiksa di sini, langsung di
 * samping pembacaan file (proxy tetap meloloskan /api/photos/ supaya
 * halaman lacak pelanggan bisa memuat fotonya).
 *
 * Dari mana isinya:
 *   - foto lama / sebelum Blob dipasang: kolom data di database
 *   - foto baru: Vercel Blob (private), dialirkan lewat server ini
 */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const photoId = Number.parseInt(id, 10);
  if (!Number.isFinite(photoId)) {
    return new Response("ID tidak valid", { status: 400 });
  }
  try {
    const photo = await getPhotoBlob(photoId);
    // Foto yang tidak ada dan foto yang tidak boleh dilihat sama-sama 404,
    // supaya orang luar tidak bisa menebak nomor foto mana yang ada.
    if (!photo) return new Response("Foto tidak ditemukan", { status: 404 });

    const url = new URL(request.url);
    const token = url.searchParams.get("t");
    const allowedByToken = Boolean(token && photo.shareToken && sameToken(token, photo.shareToken));
    if (!allowedByToken && !(await getCurrentUser())) {
      return new Response("Foto tidak ditemukan", { status: 404 });
    }

    const download = url.searchParams.get("download") === "1";
    const headers: Record<string, string> = {
      // Isi foto dengan alamat (nomor + v) yang sama tidak pernah berubah,
      // jadi browser boleh menyimpannya lama. "private": hanya di perangkat
      // itu, tidak pernah di cache bersama. Ini juga menghemat kuota baca
      // Vercel Blob karena tiap foto cukup diunduh sekali per perangkat.
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Disposition": download ? `attachment; filename="foto-${photoId}.jpg"` : "inline",
      "X-Content-Type-Options": "nosniff",
    };

    if (photo.blobUrl) {
      const file = await getPhotoBlobStream(photo.blobUrl);
      if (!file) return new Response("Foto tidak ditemukan", { status: 404 });
      return new Response(file.stream, {
        headers: {
          ...headers,
          "Content-Type": file.contentType || photo.mime,
          ...(file.size ? { "Content-Length": String(file.size) } : {}),
        },
      });
    }

    if (!photo.data) return new Response("Foto tidak ditemukan", { status: 404 });
    const body = new Uint8Array(photo.data);
    return new Response(body, {
      headers: { ...headers, "Content-Type": photo.mime, "Content-Length": String(body.byteLength) },
    });
  } catch (error) {
    console.error("GET /api/photos/[id]", error);
    return problemResponse(error);
  }
}
