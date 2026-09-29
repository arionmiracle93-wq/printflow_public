import { problemResponse } from "@/lib/dbcheck";
import { getCurrentUser } from "@/lib/auth";
import { blobConfigured, testBlobConnection } from "@/lib/photo-storage";
import { countPhotosInDatabase, migratePhotosBatch, reclaimPhotoSpace } from "@/lib/photo-migration";
import { photoStorageUsage } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * PENYIMPANAN FOTO (khusus Owner; /api/admin/ sudah dibatasi Owner di proxy,
 * dan diperiksa lagi di sini).
 *
 * GET  -> status: Blob terpasang atau belum, jumlah foto di database dan di Blob.
 * POST { action: "test" }     -> uji koneksi ke Blob.
 * POST { action: "migrate" }  -> pindahkan satu batch foto lama ke Blob.
 * POST { action: "reclaim" }  -> kembalikan ruang database setelah semua pindah.
 */
async function requireOwner() {
  const user = await getCurrentUser();
  return user?.role === "owner" ? user : null;
}

export async function GET() {
  if (!(await requireOwner())) return Response.json({ ok: false, error: "Akses ini hanya untuk Owner." }, { status: 403 });
  try {
    return Response.json({ ok: true, blob: blobConfigured(), usage: await photoStorageUsage() });
  } catch (error) {
    return problemResponse(error);
  }
}

export async function POST(request: Request) {
  if (!(await requireOwner())) return Response.json({ ok: false, error: "Akses ini hanya untuk Owner." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  try {
    if (body.action === "test") return Response.json(await testBlobConnection());
    if (body.action === "migrate") {
      if (!blobConfigured()) return Response.json({ ok: false, error: "Vercel Blob belum dihubungkan ke project ini." }, { status: 400 });
      return Response.json({ ok: true, ...(await migratePhotosBatch()) });
    }
    if (body.action === "reclaim") {
      if ((await countPhotosInDatabase()) > 0) {
        return Response.json({ ok: false, error: "Masih ada foto di database. Pindahkan semua dulu." }, { status: 400 });
      }
      const result = await reclaimPhotoSpace();
      return Response.json(result.ok ? { ok: true } : { ok: false, error: result.error }, { status: result.ok ? 200 : 500 });
    }
    return Response.json({ ok: false, error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (error) {
    return problemResponse(error);
  }
}
