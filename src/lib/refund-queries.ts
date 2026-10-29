import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoiceEvents, refunds, type RefundRow } from "@/db/schema";
import { InvoiceError, lockInvoice } from "@/lib/invoice-queries";
import { formatRupiah, jakartaDateISO } from "@/lib/domain";
import { MAX_RUPIAH, isPayMethod } from "@/lib/invoice-pricing";
import { ensureRefundSchema } from "@/lib/refund-schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type RefundStatus = "pending" | "approved" | "rejected" | "completed";

/* ------------------------------------------------------------------ */
/* Validasi input                                                      */
/* ------------------------------------------------------------------ */

/** Pemotong teks, aturan sama dengan helper di invoice-queries.ts. */
function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Angka fleksibel, aturan sama dengan helper pembayaran (input "1.500" dsb. diproses UI). */
function numberOf(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export type RefundInput = {
  amount: number;
  method: "Transfer" | "Cash" | "QRIS";
  reason: string;
  reference: string | null;
  clientRef: string | null;
};

export function parseRefundInput(raw: unknown): RefundInput {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const amountNumber = numberOf(body.amount);
  const amount = Math.round(amountNumber);
  if (!Number.isFinite(amountNumber) || amount <= 0) {
    throw new InvoiceError(400, "NOMINAL_TIDAK_VALID", "Nominal refund harus lebih dari 0.");
  }
  if (amount > MAX_RUPIAH) throw new InvoiceError(400, "NOMINAL_TERLALU_BESAR", "Nominal refund terlalu besar.");
  const method = body.method === undefined || body.method === "" ? "Transfer" : body.method;
  if (!isPayMethod(method)) throw new InvoiceError(400, "METODE_TIDAK_VALID", "Metode refund harus Transfer, Cash, atau QRIS.");
  const reason = text(body.reason, 400);
  if (!reason) throw new InvoiceError(400, "ALASAN_KOSONG", "Alasan refund wajib diisi.");
  // Spasi berlebih dirapikan, sama seperti referensi pembayaran.
  const reference = text(body.reference, 60).replace(/\s+/g, " ") || null;
  const clientRef = text(body.clientRef, 100) || null;
  return { amount, method, reason, reference, clientRef };
}

export type RefundDecision = { action: "approve" | "reject"; note: string };

export function parseRefundDecision(raw: unknown): RefundDecision {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const action = body.action === "approve" ? "approve" : "reject";
  const note = text(body.note, 300);
  if (action === "reject" && !note) {
    throw new InvoiceError(400, "ALASAN_KOSONG", "Alasan penolakan wajib diisi.");
  }
  return { action, note };
}

export function parseRefundCompletion(raw: unknown): { paidOutAt: string } {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const today = jakartaDateISO();
  const paidOutAt = /^\d{4}-\d{2}-\d{2}$/.test(typeof body.paidOutAt === "string" ? body.paidOutAt : "")
    ? (body.paidOutAt as string)
    : today;
  // Tanggal keluar uang tidak boleh maju (toleransi 1 hari, sepert pembayaran).
  if (paidOutAt > today) {
    throw new InvoiceError(400, "TANGGAL_MASA_DEPAN", "Tanggal uang keluar tidak boleh di masa depan.");
  }
  return { paidOutAt };
}

/* ------------------------------------------------------------------ */
/* Angka batas refund                                                  */
/* ------------------------------------------------------------------ */

/**
 * SISA UANG YANG MASIH BOLEH DIREFUND untuk satu invoice:
 * uang aktif (pembayaran yang tidak dibatalkan) dikurangi seluruh refund
 * yang sudah mengikat (approved + completed). Pengajuan pending belum
 * mengikat, tapi pemeriksaan nominal tetap membandingkan dengan saldo
 * ini supaya rejek-exejek pengajuan tidak bisa melebihi uang saat itu.
 * excludeId dipakai saat rekalkulasi di akhir (refund itu sendiri tidak
 * ikut memotong dirinya).
 */
async function refundBufferInTx(tx: Tx, invoiceId: number, excludeId?: number): Promise<number> {
  const paidRes = await tx.execute<{ paid: string }>(
    sql`select coalesce(sum(amount), 0)::text as paid from payments where invoice_id = ${invoiceId} and voided_at is null`,
  );
  const poolRes = await tx.execute<{ pool: string }>(
    sql`select coalesce(sum(amount), 0)::text as pool from refunds
         where invoice_id = ${invoiceId} and status in ('approved', 'completed')
           and (${excludeId ?? 0} = 0 or id <> ${excludeId ?? 0})`,
  );
  const paid = Number.parseInt((paidRes.rows as { paid: string }[])[0]?.paid ?? "0", 10) || 0;
  const pool = Number.parseInt((poolRes.rows as { pool: string }[])[0]?.pool ?? "0", 10) || 0;
  return paid - pool;
}

/** Versi non-transaksi untuk kebutuhan tampilan (panel detail invoice). */
export async function refundBuffer(invoiceId: number): Promise<number> {
  return db.transaction((tx) => refundBufferInTx(tx, invoiceId));
}

/* ------------------------------------------------------------------ */
/* Kejadian (audit trail)                                              */
/* ------------------------------------------------------------------ */

function logRefundEvent(tx: Tx, invoiceId: number, actor: string, detail: string) {
  return tx.insert(invoiceEvents).values({ invoiceId, kind: "refund", actor, detail });
}

/* ------------------------------------------------------------------ */
/* Pengajuan                                                           */
/* ------------------------------------------------------------------ */

async function createRefundInTx(
  tx: Tx,
  invoiceId: number,
  input: RefundInput,
  actor: string,
): Promise<{ refund: RefundRow; duplicate: boolean }> {
  // Kunci baris invoice dulu supaya berlomba dengan catat/void pembayaran
  // atau pengajuan refund lain diarahkan serial (aturan anti-dobel PRD).
  const locked = await lockInvoice(tx, invoiceId);

  if (input.clientRef) {
    const existing = await tx.select().from(refunds).where(eq(refunds.clientRef, input.clientRef)).limit(1);
    if (existing[0]) {
      if (existing[0].invoiceId !== invoiceId) {
        throw new InvoiceError(409, "KODE_DIPAKAI", "Kode pengajuan refund ini sudah terpakai di invoice lain.");
      }
      return { refund: existing[0], duplicate: true };
    }
  }

  if (locked.docType !== "invoice") {
    throw new InvoiceError(409, "TANPA_PEMBAYARAN", "Hanya Invoice yang punya pembayaran jadi bisa direfund. Jadikan Invoice dulu kalau sudah deal.");
  }
  if (locked.status !== "terbit" && locked.status !== "batal") {
    // Refund diizinkan juga di invoice yang sudah dibatalkan: kasus paling
    // umum uang dikembalikan justru setelah invoice terbit lalu batal.
    throw new InvoiceError(409, "STATUS_TIDAK_COCOK", "Refund hanya bisa diajukan untuk Invoice yang terbit atau dibatalkan.");
  }

  const buffer = await refundBufferInTx(tx, invoiceId);
  if (input.amount > buffer) {
    throw new InvoiceError(
      409,
      "MELEBIHI_TERBAYAR",
      buffer > 0
        ? `Refund melebihi uang yang masih ada di invoice ini. Sisa yang boleh direfund ${formatRupiah(buffer)}.`
        : "Uang yang masih ada di invoice ini sudah habis (sudah direfund semua).",
    );
  }

  const [row] = await tx
    .insert(refunds)
    .values({
      invoiceId,
      amount: input.amount,
      method: input.method,
      reason: input.reason,
      reference: input.reference,
      clientRef: input.clientRef,
      requestedBy: actor,
    })
    .returning();

  await logRefundEvent(
    tx,
    invoiceId,
    actor,
    `Refund ${formatRupiah(input.amount)} via ${input.method} diajukan — alasan: ${input.reason}${input.reference ? ` (ref ${input.reference})` : ""}.`,
  );
  return { refund: row, duplicate: false };
}

export async function createRefund(invoiceId: number, input: RefundInput, actor: string) {
  await ensureRefundSchema();
  return db.transaction((tx) => createRefundInTx(tx, invoiceId, input, actor));
}

/* ------------------------------------------------------------------ */
/* Keputusan Owner (approve / reject)                                  */
/* ------------------------------------------------------------------ */

type LockedRefund = { invoiceId: number; amount: number; status: string; method: string };

/** Kunci baris refund dengan pola yang sama seperti lockInvoice. */
async function lockRefund(tx: Tx, refundId: number): Promise<LockedRefund | null> {
  const result = await tx.execute<{ invoice_id: number; amount: number; status: string; method: string }>(
    sql`select invoice_id, amount, status, method from refunds where id = ${refundId} for update`,
  );
  const row = (result.rows as { invoice_id: number; amount: number; status: string; method: string }[])[0];
  return row ? { invoiceId: row.invoice_id, amount: row.amount, status: row.status, method: row.method } : null;
}

async function decideRefundInTx(
  tx: Tx,
  invoiceId: number,
  refundId: number,
  decision: RefundDecision,
  actor: string,
): Promise<RefundRow> {
  const locked = await lockRefund(tx, refundId);
  if (!locked || locked.invoiceId !== invoiceId) {
    throw new InvoiceError(404, "REFUND_TIDAK_ADA", "Pengajuan refund tidak ditemukan.");
  }
  const statusNow = locked.status as RefundStatus;
  if (statusNow === "rejected" || statusNow === "completed") {
    throw new InvoiceError(409, "REFUND_SUDAH_SELESAI", `Pengajuan refund ini sudah ${statusNow === "rejected" ? "ditolak" : "terlaksana"}.`);
  }
  if (decision.action === "approve" && statusNow !== "pending") {
    throw new InvoiceError(409, "SUDAH_DISETUJUI", "Pengajuan refund ini sudah disetujui.");
  }

  // Penolakan berlaku di dua titik: menolak pengajuan pending, atau
  // membatalkan approval (katup keselamatan, mis. uang aktif mengecil
  // sejak pengajuan). Keduanya menyimpan alasan, tidak menghapus baris.
  await tx
    .update(refunds)
    .set({
      status: decision.action === "approve" ? "approved" : "rejected",
      decidedBy: actor,
      decidedAt: new Date(),
      decisionNote: decision.action === "reject" ? decision.note : null,
    })
    .where(eq(refunds.id, refundId));

  const nominal = formatRupiah(locked.amount);
  const detail =
    decision.action === "approve"
      ? `Refund ${nominal} via ${locked.method} disetujui Owner. Menunggu konfirmasi uang terkirim.`
      : statusNow === "approved"
        ? `Approval refund ${nominal} dibatalkan Owner — alasan: ${decision.note}.`
        : `Refund ${nominal} via ${locked.method} ditolak Owner — alasan: ${decision.note}.`;
  await logRefundEvent(tx, invoiceId, actor, detail);

  const [row] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).limit(1);
  return row;
}

export async function decideRefund(
  invoiceId: number,
  refundId: number,
  decision: RefundDecision,
  actor: string,
): Promise<RefundRow> {
  await ensureRefundSchema();
  return db.transaction((tx) => decideRefundInTx(tx, invoiceId, refundId, decision, actor));
}

/* ------------------------------------------------------------------ */
/* Realisasi (uang benar-benar keluar)                                 */
/* ------------------------------------------------------------------ */

async function completeRefundInTx(
  tx: Tx,
  invoiceId: number,
  refundId: number,
  actor: string,
  paidOutAt: string,
): Promise<RefundRow> {
  const locked = await lockRefund(tx, refundId);
  if (!locked || locked.invoiceId !== invoiceId) {
    throw new InvoiceError(404, "REFUND_TIDAK_ADA", "Pengajuan refund tidak ditemukan.");
  }
  const statusNow = locked.status as RefundStatus;
  if (statusNow === "completed") {
    throw new InvoiceError(409, "SUDAH_SELESAI", "Refund ini sudah ditandai terkirim.");
  }
  if (statusNow !== "approved") {
    throw new InvoiceError(409, "BELUM_DISETUJUI", "Refund masih harus disetujui Owner sebelum ditandai terkirim.");
  }

  // Rekalkulasi di akhir: kalau uang aktif mengecil sejak approval (mis.
  // pembayaran dibatalkan Owner), realisasi berhenti di sini — pengajuan
  // tetap aman, angka laporan tidak berbohong. Owner tinggal membatalkan
  // approval lalu mengajukan ulang dengan nominal yang benar.
  const buffer = await refundBufferInTx(tx, invoiceId, refundId);
  if (locked.amount > buffer) {
    throw new InvoiceError(
      409,
      "REFUND_TERLEBIH",
      `Uang aktif di invoice menyusut menjadi ${formatRupiah(Math.max(0, buffer))} — kurang dari nominal refund. Batalkan approval lalu ajukan ulang.`,
    );
  }

  await tx
    .update(refunds)
    .set({ status: "completed", completedBy: actor, completedAt: new Date(), paidOutAt })
    .where(eq(refunds.id, refundId));

  await logRefundEvent(
    tx,
    invoiceId,
    actor,
    `Refund ${formatRupiah(locked.amount)} via ${locked.method} ditandai terkirim (uang keluar per ${paidOutAt}).`,
  );

  const [row] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).limit(1);
  return row;
}

export async function completeRefund(invoiceId: number, refundId: number, actor: string, paidOutAt: string) {
  await ensureRefundSchema();
  return db.transaction((tx) => completeRefundInTx(tx, invoiceId, refundId, actor, paidOutAt));
}

/* ------------------------------------------------------------------ */
/* Baca data                                                           */
/* ------------------------------------------------------------------ */

/** Riwayat refund satu invoice — untuk panel di halaman detail. */
export async function listRefunds(invoiceId: number): Promise<RefundRow[]> {
  await ensureRefundSchema();
  return db.select().from(refunds).where(eq(refunds.invoiceId, invoiceId)).orderBy(desc(refunds.id));
}
