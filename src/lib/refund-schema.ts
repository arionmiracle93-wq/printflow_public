import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * SKEMA REFUND
 * ----------------------------------------------------------------
 * Tabel `refunds` untuk pengembalian uang (PRD refund). Seperti kolom
 * payments.reference, tabel ini disiapkan otomatis saat pertama dibutuhkan
 * supaya upgrade tidak mewajibkan membuka /api/setup dulu. Semua perintah
 * memakai IF NOT EXISTS: aman dipanggil berulang dan di banyak request.
 *
 * Dampak uang keluar HANYA untuk baris status "completed" — status lain
 * (pending/approved/rejected) adalah catatan proses, bukan pemindahan kas.
 *
 * WAJIB dipanggil sebelum query apa pun yang membaca/menulis tabel refunds.
 */
let schemaReady: Promise<void> | null = null;

export function ensureRefundSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS refunds (
          id serial PRIMARY KEY,
          invoice_id integer NOT NULL REFERENCES invoices(id) ON DELETE cascade,
          amount integer NOT NULL,
          method text NOT NULL DEFAULT 'Transfer',
          reason text NOT NULL DEFAULT '',
          reference text,
          status text NOT NULL DEFAULT 'pending',
          requested_by text NOT NULL DEFAULT 'Owner',
          decided_by text,
          decided_at timestamptz,
          decision_note text,
          completed_by text,
          completed_at timestamptz,
          paid_out_at date,
          client_ref text,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `));
      await db.execute(
        sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS refunds_client_ref_uidx ON refunds (client_ref) WHERE client_ref IS NOT NULL`),
      );
      await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS refunds_invoice_idx ON refunds (invoice_id)`));
      // Laporan kas keluar membaca refund selesai per tanggal keluar.
      await db.execute(
        sql.raw(`CREATE INDEX IF NOT EXISTS refunds_paid_out_idx ON refunds (paid_out_at) WHERE status = 'completed'`),
      );
    })().catch((error) => {
      // Jangan simpan promise yang gagal; request berikutnya boleh mencoba lagi.
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}
