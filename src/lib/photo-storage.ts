/**
 * PENYIMPANAN FOTO (server saja, jangan diimpor dari komponen klien)
 * =====================================================================
 * Foto baru disimpan di Vercel Blob (private) kalau store sudah
 * dihubungkan ke project di Vercel. Kalau belum, foto tetap disimpan di
 * database seperti dulu, jadi aplikasi TIDAK rusak sebelum langkah
 * setup dilakukan, dan foto tidak pernah hilang kalau Blob bermasalah.
 *
 * Kenapa dipindah dari database:
 *   Paket gratis Neon hanya 0,5 GB. Foto memakan hampir seluruhnya,
 *   padahal data teks ribuan pekerjaan hanya beberapa MB. Kalau database
 *   penuh, aplikasi tidak bisa menyimpan apa pun, bukan hanya foto.
 *
 * Kenapa store PRIVATE:
 *   Foto desain dan nota pelanggan tidak boleh bisa dibuka orang lain.
 *   File private hanya bisa dibaca lewat server aplikasi ini, dan server
 *   memeriksa login (atau token lacak pelanggan) setiap kali.
 *
 * Cara aktifkan (sekali, di dashboard Vercel):
 *   Project > Storage > Create > Blob > pilih akses PRIVATE > Connect ke
 *   project ini > Redeploy. Vercel otomatis menambahkan variabel
 *   BLOB_STORE_ID / BLOB_READ_WRITE_TOKEN. Tidak ada kunci yang perlu
 *   disalin manual.
 */
import "server-only";
import { del, get, put } from "@vercel/blob";

/** Blob sudah dihubungkan ke project (variabel lingkungannya ada). */
export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

/*
 * PENGAMAN SAAT VERCEL BLOB BERMASALAH
 * Bawaan SDK mencoba ulang hingga 10 kali dengan jeda makin panjang. Kalau
 * Blob sedang gangguan, unggahan bisa tertahan sampai fungsi Vercel
 * dihentikan paksa, dan foto gagal tersimpan sama sekali. Karena itu:
 *   - tiap operasi dibatasi waktunya (OP_TIMEOUT_MS), dan
 *   - setelah satu kegagalan, Blob dilewati sementara (BREAKER_MS) supaya
 *     foto berikutnya langsung disimpan ke database tanpa menunggu.
 */
// SDK membaca jumlah percobaan ulang dari variabel ini setiap kali dipanggil
// (bawaan 10, dengan jeda 1, 2, 4, 8, 16 detik...). Batas waktu di bawah
// hanya berlaku saat permintaan berjalan, tidak saat SDK menunggu jeda,
// jadi tanpa ini satu unggahan bisa tertahan lebih dari 30 detik.
// Kalau pemilik sengaja menyetel VERCEL_BLOB_RETRIES di Vercel, nilainya dihormati.
if (!process.env.VERCEL_BLOB_RETRIES) process.env.VERCEL_BLOB_RETRIES = "2";
const OP_TIMEOUT_MS = 15_000;
const BREAKER_MS = 60_000;
let blobDownUntil = 0;

/** Blob terpasang DAN tidak sedang dalam masa jeda setelah gagal. */
export function blobUsable(): boolean {
  return blobConfigured() && Date.now() >= blobDownUntil;
}

function markBlobDown() {
  blobDownUntil = Date.now() + BREAKER_MS;
}

/**
 * Simpan satu foto ke Blob. Nama file diberi akhiran acak oleh Vercel,
 * jadi tiap foto punya alamat unik dan tidak pernah tertimpa.
 * Mengembalikan alamat file (bukan alamat publik; tetap butuh izin untuk dibaca).
 */
export async function putPhotoBlob(orderId: number, bytes: Buffer, mime: string): Promise<string> {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  try {
    const result = await put(`pesanan/${orderId}/foto.${ext}`, bytes, {
      access: "private",
      addRandomSuffix: true,
      contentType: mime,
      // Isi file tidak pernah berubah setelah diunggah, jadi aman disimpan lama di cache Vercel.
      cacheControlMaxAge: 60 * 60 * 24 * 365,
      abortSignal: AbortSignal.timeout(OP_TIMEOUT_MS),
    });
    return result.url;
  } catch (error) {
    markBlobDown();
    throw error;
  }
}

/** Baca foto dari Blob sebagai stream. null kalau file tidak ada. */
export async function getPhotoBlobStream(url: string) {
  const result = await get(url, { access: "private", abortSignal: AbortSignal.timeout(OP_TIMEOUT_MS) });
  if (!result || result.statusCode !== 200) return null;
  return { stream: result.stream, contentType: result.blob.contentType, size: result.blob.size, etag: result.blob.etag };
}

/**
 * Hapus file di Blob. Tidak pernah melempar error: kalau gagal, yang
 * tersisa hanya file yatim di Blob, bukan data aplikasi yang rusak.
 */
export async function deletePhotoBlobs(urls: (string | null | undefined)[]): Promise<void> {
  const list = urls.filter((u): u is string => typeof u === "string" && u.length > 0);
  if (!list.length || !blobConfigured()) return;
  for (let i = 0; i < list.length; i += 100) {
    try {
      await del(list.slice(i, i + 100), { abortSignal: AbortSignal.timeout(OP_TIMEOUT_MS) });
    } catch (error) {
      console.error("deletePhotoBlobs: gagal menghapus sebagian file di Blob", error);
    }
  }
}

/**
 * Uji koneksi: unggah file kecil, baca lagi, lalu hapus.
 * Dipakai tombol di Pengaturan supaya pemilik tahu setup-nya benar
 * sebelum memindahkan foto lama. Pesan error dibuat bisa dipahami orang awam.
 */
export async function testBlobConnection(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!blobConfigured()) {
    return { ok: false, error: "Vercel Blob belum dihubungkan ke project ini. Ikuti langkah di kartu ini lalu Redeploy." };
  }
  let url: string | null = null;
  try {
    const res = await put("uji-koneksi/printflow.txt", Buffer.from("ok"), {
      access: "private",
      addRandomSuffix: true,
      contentType: "text/plain",
      abortSignal: AbortSignal.timeout(OP_TIMEOUT_MS),
    });
    url = res.url;
    // Uji berhasil = pengaman jeda dilepas, supaya pemindahan bisa langsung jalan.
    blobDownUntil = 0;
    const back = await get(url, { access: "private", useCache: false, abortSignal: AbortSignal.timeout(OP_TIMEOUT_MS) });
    if (!back || back.statusCode !== 200) return { ok: false, error: "File uji terunggah tapi tidak bisa dibaca kembali." };
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/abort|timeout/i.test(message)) {
      return { ok: false, error: "Vercel Blob tidak merespons dalam 15 detik. Coba lagi beberapa saat lagi." };
    }
    if (/public/i.test(message) && /private/i.test(message)) {
      return { ok: false, error: "Store Blob dibuat dengan akses Public. Buat store baru dengan akses PRIVATE, hubungkan ke project, lalu Redeploy." };
    }
    return { ok: false, error: `Koneksi ke Vercel Blob gagal: ${message}` };
  } finally {
    if (url) await deletePhotoBlobs([url]);
  }
}
