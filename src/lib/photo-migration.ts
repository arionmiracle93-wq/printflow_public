/**
 * PEMINDAHAN FOTO LAMA: database -> Vercel Blob
 * ---------------------------------------------------------------------
 * Dijalankan dari tombol di Pengaturan (khusus Owner), sedikit demi
 * sedikit supaya tiap permintaan selesai jauh sebelum batas waktu
 * fungsi Vercel. Urutan per foto:
 *   1. unggah ke Blob
 *   2. catat alamat Blob DAN kosongkan isi di database dalam satu
 *      perintah, hanya kalau foto itu belum dipindah proses lain
 * Kalau langkah 1 gagal, foto tetap utuh di database. Kalau langkah 2
 * tidak mengenai baris apa pun (misalnya fotonya baru dihapus), file
 * Blob yang terlanjur diunggah langsung dihapus lagi.
 */
import "server-only";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderPhotos } from "@/db/schema";
import { blobConfigured, deletePhotoBlobs, putPhotoBlob } from "@/lib/photo-storage";

export async function migratePhotosBatch(limit = 12): Promise<{ moved: number; failed: number; remaining: number; errors: string[] }> {
  if (!blobConfigured()) throw new Error("Vercel Blob belum dihubungkan ke project ini.");
  const rows = await db
    .select({ id: orderPhotos.id, orderId: orderPhotos.orderId, mime: orderPhotos.mime, data: orderPhotos.data })
    .from(orderPhotos)
    .where(and(isNull(orderPhotos.blobUrl), isNotNull(orderPhotos.data)))
    .orderBy(asc(orderPhotos.id))
    .limit(limit);

  let moved = 0;
  let failed = 0;
  const errors: string[] = [];
  const started = Date.now();
  for (const row of rows) {
    if (!row.data) continue;
    // Sisakan waktu jauh di bawah batas fungsi Vercel (maxDuration 60 detik).
    if (Date.now() - started > 40_000) break;
    let url: string | null = null;
    try {
      url = await putPhotoBlob(row.orderId, Buffer.from(row.data), row.mime);
      const updated = await db
        .update(orderPhotos)
        .set({ blobUrl: url, data: null })
        .where(and(eq(orderPhotos.id, row.id), isNull(orderPhotos.blobUrl)))
        .returning({ id: orderPhotos.id });
      if (updated.length) moved += 1;
      else await deletePhotoBlobs([url]);
    } catch (error) {
      failed += 1;
      if (url) await deletePhotoBlobs([url]);
      if (errors.length < 3) errors.push(`Foto #${row.id}: ${error instanceof Error ? error.message : String(error)}`);
      // Kalau Blob sedang bermasalah, foto berikutnya hampir pasti ikut gagal.
      // Berhenti di sini; tombol di Pengaturan bisa ditekan lagi nanti.
      break;
    }
  }
  return { moved, failed, remaining: await countPhotosInDatabase(), errors };
}

export async function countPhotosInDatabase(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`cast(count(*) as int)` })
    .from(orderPhotos)
    .where(and(isNull(orderPhotos.blobUrl), isNotNull(orderPhotos.data)));
  return Number(row?.n ?? 0);
}

/**
 * Setelah semua foto pindah, ruang bekas foto di database dikembalikan.
 * Tanpa ini, ruangnya hanya ditandai "boleh dipakai ulang" dan ukuran
 * database di Neon belum langsung turun. Aman: tabel foto kecil setelah
 * isinya dipindah, jadi prosesnya cepat. Kalau gagal, tidak ada data
 * yang rusak; ruang akan dipakai ulang oleh data baru.
 */
export async function reclaimPhotoSpace(): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.execute(sql.raw("VACUUM (FULL, ANALYZE) order_photos"));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
