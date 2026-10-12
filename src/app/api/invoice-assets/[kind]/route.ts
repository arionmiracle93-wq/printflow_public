import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { requireInvoiceAccess } from "@/lib/invoice-access";
import { invoiceFailure, readJson } from "@/lib/invoice-api";
import { ASSET_KEY, ASSET_META_KEY, MAX_ASSET_BYTES, getAssetMeta, isAssetKind } from "@/lib/invoice-settings";
import { getSetting } from "@/lib/queries";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ kind: string }> };

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

async function upsert(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

/** Tampilkan gambar tanda tangan / stempel (untuk kertas dokumen & PDF). */
export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess();
    if (!auth.ok) return auth.response;
    const { kind } = await params;
    if (!isAssetKind(kind)) return new Response("Tidak ditemukan", { status: 404 });
    const raw = await getSetting(ASSET_KEY[kind]);
    const m = raw ? DATA_URL.exec(raw) : null;
    if (!m) return new Response("Belum ada gambar", { status: 404 });
    return new Response(Buffer.from(m[2], "base64"), {
      headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=31536000, immutable" },
    });
  } catch (error) {
    return invoiceFailure("GET /api/invoice-assets", error);
  }
}

/** Unggah gambar (PNG/JPG/WebP, maksimal 800KB). Body: { dataUrl }. Hanya Owner. */
export async function PUT(request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const { kind } = await params;
    if (!isAssetKind(kind)) return Response.json({ ok: false, error: "Jenis gambar tidak dikenal." }, { status: 404 });
    const body = await readJson(request);
    const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
    const m = DATA_URL.exec(dataUrl);
    if (!m) return Response.json({ ok: false, error: "File harus gambar PNG, JPG, atau WebP." }, { status: 400 });
    const bytes = Math.floor((m[2].length * 3) / 4);
    if (bytes > MAX_ASSET_BYTES) return Response.json({ ok: false, error: "Gambar terlalu besar, maksimal 800KB." }, { status: 400 });
    const meta = await getAssetMeta();
    const version = Math.max(meta[kind], 0) + 1;
    await upsert(ASSET_KEY[kind], dataUrl);
    await upsert(ASSET_META_KEY, JSON.stringify({ ...meta, [kind]: version }));
    return Response.json({ ok: true, version });
  } catch (error) {
    return invoiceFailure("PUT /api/invoice-assets", error);
  }
}

/** Hapus gambar. Hanya Owner. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const { kind } = await params;
    if (!isAssetKind(kind)) return Response.json({ ok: false, error: "Jenis gambar tidak dikenal." }, { status: 404 });
    const meta = await getAssetMeta();
    await db.delete(settings).where(eq(settings.key, ASSET_KEY[kind]));
    await upsert(ASSET_META_KEY, JSON.stringify({ ...meta, [kind]: 0 }));
    return Response.json({ ok: true });
  } catch (error) {
    return invoiceFailure("DELETE /api/invoice-assets", error);
  }
}
