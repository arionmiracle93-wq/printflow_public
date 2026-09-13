import { problemResponse } from "@/lib/dbcheck";
import { getPhotoBlob } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const photoId = Number.parseInt(id, 10);
  if (!Number.isFinite(photoId)) {
    return new Response("ID tidak valid", { status: 400 });
  }
  try {
    const photo = await getPhotoBlob(photoId);
    if (!photo) return new Response("Foto tidak ditemukan", { status: 404 });

    const url = new URL(request.url);
    // Param ?thumb=1 → gambar diperkecil di sisi klien memakai ukuran asli;
    // di sini cukup kirim versi asli (foto sudah dikompres saat diunggah).
    const download = url.searchParams.get("download") === "1";

    const body = new Uint8Array(photo.data);
    return new Response(body, {
      headers: {
        "Content-Type": photo.mime,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Disposition": download ? `attachment; filename="foto-${photoId}.jpg"` : "inline",
      },
    });
  } catch (error) {
    console.error("GET /api/photos/[id]", error);
    return problemResponse(error);
  }
}
