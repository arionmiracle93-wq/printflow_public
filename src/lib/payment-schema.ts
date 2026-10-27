import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * SKEMA PEMBAYARAN
 * ----------------------------------------------------------------
 * Database lama belum punya kolom payments.reference (No. referensi
 * transaksi bank / QRIS). Seperti skema produksi per item, kolom ini
 * disiapkan otomatis saat pertama dibutuhkan, jadi upgrade tidak
 * mewajibkan membuka /api/setup dulu. Semua perintah memakai IF NOT
 * EXISTS: aman dipanggil berulang dan di banyak request sekaligus.
 *
 * WAJIB dipanggil sebelum query apa pun yang membaca/menulis seluruh
 * kolom tabel payments (select() tanpa daftar kolom, insert, returning).
 */
let schemaReady: Promise<void> | null = null;

export function ensurePaymentSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql.raw(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference text`));
      await db.execute(
        sql.raw(
          `CREATE INDEX IF NOT EXISTS payments_reference_idx ON payments (lower(reference)) WHERE reference IS NOT NULL`,
        ),
      );
    })().catch((error) => {
      // Jangan simpan promise yang gagal; request berikutnya boleh mencoba lagi.
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}
