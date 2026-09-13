import { problemResponse } from "@/lib/dbcheck";
import { MAX_PHOTO_BYTES, PHOTO_KINDS } from "@/lib/photos";
import { countPhotos, insertPhoto, listPhotos, MAX_PHOTOS_PER_ORDER } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId)) {
    return Response.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
  }
  try {
    const photos = await listPhotos(orderId);
    return Response.json({ ok: true, data: photos, max: MAX_PHOTOS_PER_ORDER });
  } catch (error) {
    console.error("GET photos", error);
    return problemResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId)) {
    return Response.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
  }

  try {
    const form = await request.formData();
    const kindRaw = form.get("kind");
    const kind = typeof kindRaw === "string" && PHOTO_KINDS.includes(kindRaw) ? kindRaw : "referensi";
    const captionRaw = form.get("caption");
    const caption = typeof captionRaw === "string" && captionRaw.trim() ? captionRaw.trim().slice(0, 200) : null;

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) {
      return Response.json({ ok: false, error: "Tidak ada berkas foto yang dikirim." }, { status: 400 });
    }

    const existing = await countPhotos(orderId);
    const remaining = MAX_PHOTOS_PER_ORDER - existing;
    if (remaining <= 0) {
      return Response.json(
        { ok: false, error: `Jumlah foto sudah mencapai batas ${MAX_PHOTOS_PER_ORDER} untuk pekerjaan ini.` },
        { status: 400 },
      );
    }

    const saved = [];
    for (const file of files.slice(0, remaining)) {
      if (!file.type.startsWith("image/")) continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length === 0) continue;
      if (buffer.length > MAX_PHOTO_BYTES) {
        return Response.json(
          { ok: false, error: "Ada foto yang terlalu besar (>4MB). Coba ambil ulang foto atau kurangi ukurannya." },
          { status: 413 },
        );
      }
      saved.push(
        await insertPhoto({
          orderId,
          kind,
          mime: file.type || "image/jpeg",
          sizeBytes: buffer.length,
          caption: caption ?? file.name.slice(0, 120),
          data: buffer,
        }),
      );
    }

    if (!saved.length) {
      return Response.json({ ok: false, error: "Berkas yang dikirim bukan gambar." }, { status: 400 });
    }

    return Response.json({ ok: true, data: saved, total: await countPhotos(orderId) }, { status: 201 });
  } catch (error) {
    console.error("POST photos", error);
    return problemResponse(error);
  }
}
