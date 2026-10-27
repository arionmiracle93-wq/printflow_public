import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * SKEMA MONITORING PRODUKSI PER ITEM
 * ----------------------------------------------------------------
 * Database lama belum mengenal kolom:
 *   invoice_items.needs_production / prod_due_date / prod_due_time / line_key
 *   order_items.due_date / due_time / source_line_key
 *
 * Seperti skema katalog invoice, kolom-kolom ini disiapkan otomatis
 * sekali per instance server supaya fitur bisa dipakai tanpa harus
 * mengingat menjalankan /api/setup lebih dulu. Operasinya aditif dan
 * aman dijalankan berulang.
 *
 * Aturan penting:
 * - invoice_items.needs_production default TRUE. Item lama otomatis
 *   dianggap perlu produksi bila invoice-nya memang meminta monitoring,
 *   jadi perilaku invoice lama tidak berubah.
 * - invoice_items.line_key diisi otomatis untuk baris lama. Kunci ini
 *   bertahan saat invoice diedit, sehingga item yang sudah masuk
 *   produksi bisa dikenali dan tidak tersalin dua kali.
 * - order_items.due_date / due_time boleh kosong. Baris item yang dibuat
 *   sebelum fitur ini ada akan memakai deadline pekerjaan sebagai
 *   cadangan saat ditampilkan.
 */
let schemaReady: Promise<void> | null = null;

export function ensureItemProductionSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(
        sql.raw(
          `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS needs_production boolean NOT NULL DEFAULT true`,
        ),
      );
      await db.execute(sql.raw(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS prod_due_date date`));
      await db.execute(sql.raw(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS prod_due_time text`));
      await db.execute(sql.raw(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS line_key text`));
      // Baris lama mendapat kunci tetap berbasis id. Baris baru memakai UUID
      // dari editor; kunci ini tidak berubah walau isi invoice diedit.
      await db.execute(sql.raw(`UPDATE invoice_items SET line_key = 'inv-' || id WHERE line_key IS NULL`));
      await db.execute(
        sql.raw(`CREATE INDEX IF NOT EXISTS invoice_items_line_key_idx ON invoice_items (invoice_id, line_key)`),
      );
      await db.execute(sql.raw(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS due_date date`));
      await db.execute(sql.raw(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS due_time text`));
      await db.execute(sql.raw(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS source_line_key text`));
      await db.execute(
        sql.raw(`CREATE INDEX IF NOT EXISTS order_items_source_line_idx ON order_items (source_line_key)`),
      );
    })().catch((error) => {
      // Jangan simpan promise yang gagal; request berikutnya boleh mencoba lagi.
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}
