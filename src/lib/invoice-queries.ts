import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  invoiceEvents,
  invoiceItems,
  invoices,
  orderEvents,
  orderItems,
  orders,
  payments,
  type InvoiceEventRow,
  type InvoiceItemRow,
  type InvoiceTierConfig,
  type PaymentRow,
} from "@/db/schema";
import { MACHINES, estimateHoursForItems, formatRupiah, jakartaDateISO, orderCode } from "@/lib/domain";
import { bankMatch, onlyDigits } from "@/lib/invoice-due";
import { DOC_MODES, isDocType, type DocType } from "@/lib/invoice-modes";
import { computePayInfo } from "@/lib/invoice-pay";
import {
  MAX_RUPIAH,
  computeInvoiceTotals,
  computeRowPricing,
  isDiscountType,
  isPayMethod,
  type DiscountType,
  normalizeTiers,
  summarizePayments,
  type PayMethod,
  type PayStatus,
} from "@/lib/invoice-pricing";

/**
 * QUERY MODUL INVOICE
 *
 * Prinsip yang dijaga di file ini:
 *  1. Server SELALU menghitung ulang harga, total, terbayar, dan status
 *     bayar. Angka kiriman browser tidak dipercaya.
 *  2. Nomor invoice resmi diambil atomik dari database (tidak ada nomor kembar).
 *  3. Pembayaran hanya ditambah; koreksi = "batalkan" (jejak uang tetap utuh).
 *  4. Pembayaran punya kode unik (clientRef) sehingga kiriman ulang tidak
 *     tercatat dobel — fondasi untuk antrean offline nanti.
 *  5. Setiap perubahan uang memperbarui "cermin" harga & terbayar di
 *     pesanan produksi yang tertaut, dalam transaksi yang sama.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Error yang pesannya aman dibaca kasir (bahasa Indonesia). */
export class InvoiceError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "InvoiceError";
    this.status = status;
    this.code = code;
  }
}

export function invoiceErrorResponse(error: unknown): Response | null {
  if (error instanceof InvoiceError) {
    return Response.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Validasi input                                                      */
/* ------------------------------------------------------------------ */

export type InvoiceItemInput = {
  productName: string;
  description: string | null;
  unit: string;
  qty: number;
  areaM2: number;
  basePrice: number;
  tiers: InvoiceTierConfig | null;
};

export type InvoiceInput = {
  docType: DocType;
  customerId: number | null;
  customerName: string;
  customerPhone: string | null;
  issueDate: string;
  dueDate: string | null;
  payMethod: PayMethod;
  discountType: DiscountType;
  /** Isian diskon mentah: persen atau rupiah, sesuai discountType. */
  discountInput: number;
  taxRate: number;
  notes: string | null;
  terms: string[];
  items: InvoiceItemInput[];
  orderId: number | null;
  /** Perlu monitoring produksi: pekerjaan dibuat otomatis saat invoice diterbitkan. */
  needsProduction: boolean;
  prodDueDate: string | null;
  prodDueTime: string | null;
};

const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Validasi deadline produksi (tanggal ISO wajib, tidak boleh sudah lewat; jam HH:MM, bawaan 17:00). */
export function parseDeadline(dateRaw: unknown, timeRaw: unknown): { dueDate: string; dueTime: string } {
  const dueDate = typeof dateRaw === "string" ? dateRaw.trim() : "";
  if (!ISO_DATE.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`))) {
    throw new InvoiceError(400, "DEADLINE_WAJIB", "Deadline produksi wajib diisi (tanggal).");
  }
  if (dueDate < jakartaDateISO()) {
    throw new InvoiceError(400, "DEADLINE_LEWAT", "Deadline produksi tidak boleh tanggal yang sudah lewat.");
  }
  const dueTime = typeof timeRaw === "string" && timeRaw.trim() ? timeRaw.trim() : "17:00";
  if (!TIME_HHMM.test(dueTime)) throw new InvoiceError(400, "JAM_TIDAK_VALID", "Jam deadline tidak valid. Gunakan format 17:00.");
  return { dueDate, dueTime };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function numberOf(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function isoDateOrNull(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new InvoiceError(400, "TANGGAL_TIDAK_VALID", `${label} tidak valid. Gunakan format tahun-bulan-tanggal.`);
  }
  return value;
}

export function parseInvoiceInput(raw: unknown): InvoiceInput {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const docType: DocType = body.docType === undefined || body.docType === "" ? "invoice" : (body.docType as DocType);
  if (!isDocType(docType)) throw new InvoiceError(400, "JENIS_TIDAK_VALID", "Jenis dokumen tidak dikenal.");
  const mode = DOC_MODES[docType];

  const customerName = text(body.customerName, 200);
  if (!customerName) throw new InvoiceError(400, "PELANGGAN_KOSONG", "Nama pelanggan wajib diisi.");

  const itemsRaw = Array.isArray(body.items) ? body.items : [];
  if (itemsRaw.length > 200) throw new InvoiceError(400, "ITEM_TERLALU_BANYAK", "Maksimal 200 baris item per invoice.");
  const items: InvoiceItemInput[] = itemsRaw
    .map((entry) => {
      const r = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
      const cfg = r.tiers ? normalizeTiers(r.tiers) : null;
      return {
        productName: text(r.productName, 300),
        description: text(r.description, 1000) || null,
        unit: text(r.unit, 30) || "pcs",
        qty: Math.max(0, numberOf(r.qty)),
        areaM2: Math.max(0, numberOf(r.areaM2)),
        // Surat Jalan tidak memakai harga sama sekali.
        basePrice: mode.showPrices ? Math.max(0, Math.round(numberOf(r.basePrice))) : 0,
        tiers: mode.showPrices && cfg && cfg.list.length ? cfg : null,
      };
    })
    // Baris yang benar-benar kosong (belum diisi apa-apa) dibuang diam-diam.
    .filter((it) => it.productName || it.qty > 0 || it.basePrice > 0);

  for (const [index, it] of items.entries()) {
    const no = index + 1;
    if (!it.productName) throw new InvoiceError(400, "ITEM_TANPA_NAMA", `Baris ${no}: nama produk wajib diisi.`);
    if (it.qty <= 0) throw new InvoiceError(400, "ITEM_QTY", `Baris ${no}: jumlah (qty) harus lebih dari 0.`);
    if (it.basePrice > MAX_RUPIAH) throw new InvoiceError(400, "ITEM_HARGA", `Baris ${no}: harga terlalu besar.`);
  }

  const method = body.payMethod === undefined || body.payMethod === "" ? "Transfer" : body.payMethod;
  if (!isPayMethod(method)) {
    throw new InvoiceError(400, "METODE_TIDAK_VALID", "Metode bayar harus Transfer, Cash, atau QRIS.");
  }

  const termsRaw = Array.isArray(body.terms) ? body.terms : [];
  const terms = termsRaw.map((t) => text(t, 500)).filter(Boolean).slice(0, 30);

  const orderIdNumber = Number(body.orderId);
  const linkedOrderId = docType === "invoice" && Number.isInteger(orderIdNumber) && orderIdNumber > 0 ? orderIdNumber : null;
  // Invoice yang dibuat dari pekerjaan sudah punya pekerjaan; hanya Invoice yang boleh minta produksi.
  const wantProduction = docType === "invoice" && !linkedOrderId && body.needsProduction === true;
  const deadline = wantProduction ? parseDeadline(body.prodDueDate, body.prodDueTime) : null;
  const discountType: DiscountType = isDiscountType(body.discountType)
    ? body.discountType
    : body.discountType === "nominal"
      ? "rp"
      : "persen";

  return {
    docType,
    customerId: Number.isInteger(Number(body.customerId)) && Number(body.customerId) > 0 ? Number(body.customerId) : null,
    customerName,
    customerPhone: text(body.customerPhone, 40) || null,
    issueDate: isoDateOrNull(body.issueDate, "Tanggal invoice") ?? jakartaDateISO(),
    dueDate: isoDateOrNull(body.dueDate, "Tanggal jatuh tempo"),
    payMethod: method,
    discountType: mode.showTotals ? discountType : "persen",
    discountInput: mode.showTotals ? numberOf(body.discountValue ?? body.discountInput ?? body.discountRate) : 0,
    taxRate: mode.showTotals ? numberOf(body.taxRate) : 0,
    notes: text(body.notes, 2000) || null,
    terms,
    items,
    // Hanya invoice yang boleh tertaut ke pekerjaan produksi.
    orderId: linkedOrderId,
    needsProduction: wantProduction,
    prodDueDate: deadline?.dueDate ?? null,
    prodDueTime: deadline?.dueTime ?? null,
  };
}

/** Hitung ulang semua baris + total dari input mentah (satu-satunya sumber angka resmi). */
function priceInvoice(input: InvoiceInput) {
  const rows = input.items.map((it) => {
    const pricing = computeRowPricing({ qty: it.qty, areaM2: it.areaM2, basePrice: it.basePrice, tiers: it.tiers });
    return { item: it, unitPrice: pricing.unitPrice, amount: pricing.amount };
  });
  for (const [index, row] of rows.entries()) {
    if (row.amount > MAX_RUPIAH) {
      throw new InvoiceError(400, "NOMINAL_TERLALU_BESAR", `Baris ${index + 1}: jumlahnya terlalu besar.`);
    }
  }
  const totals = computeInvoiceTotals(rows.map((r) => r.amount), input.discountInput, input.taxRate, input.discountType);
  if (totals.subtotal > MAX_RUPIAH || totals.total > MAX_RUPIAH) {
    throw new InvoiceError(400, "NOMINAL_TERLALU_BESAR", "Total invoice terlalu besar (maksimal Rp 2 miliar).");
  }
  return { rows, totals };
}

export type PaymentInput = {
  amount: number;
  method: PayMethod;
  paidAt: Date;
  note: string | null;
  kind: "dp" | "bayar";
  clientRef: string | null;
  confirmOverpay: boolean;
};

export function parsePaymentInput(raw: unknown): PaymentInput {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const amountNumber = numberOf(body.amount);
  const amount = Math.round(amountNumber);
  if (!Number.isFinite(amountNumber) || amount <= 0) {
    throw new InvoiceError(400, "NOMINAL_TIDAK_VALID", "Nominal pembayaran harus lebih dari 0.");
  }
  if (amount > MAX_RUPIAH) throw new InvoiceError(400, "NOMINAL_TERLALU_BESAR", "Nominal pembayaran terlalu besar.");
  const method = body.method === undefined || body.method === "" ? "Transfer" : body.method;
  if (!isPayMethod(method)) throw new InvoiceError(400, "METODE_TIDAK_VALID", "Metode bayar harus Transfer, Cash, atau QRIS.");

  let paidAt = new Date();
  if (typeof body.paidAt === "string" && body.paidAt) {
    const parsed = new Date(body.paidAt);
    if (Number.isNaN(parsed.getTime())) throw new InvoiceError(400, "TANGGAL_TIDAK_VALID", "Tanggal pembayaran tidak valid.");
    // Toleransi 1 hari ke depan (selisih jam perangkat), selebihnya ditolak.
    if (parsed.getTime() > Date.now() + 24 * 3600 * 1000) {
      throw new InvoiceError(400, "TANGGAL_MASA_DEPAN", "Tanggal pembayaran tidak boleh di masa depan.");
    }
    paidAt = parsed;
  }
  const ref = text(body.clientRef, 100);
  return {
    amount,
    method,
    paidAt,
    note: text(body.note, 500) || null,
    kind: body.kind === "dp" ? "dp" : "bayar",
    clientRef: ref || null,
    confirmOverpay: body.confirmOverpay === true,
  };
}

/* ------------------------------------------------------------------ */
/* Pembantu internal (di dalam transaksi)                              */
/* ------------------------------------------------------------------ */

type LockedInvoice = { id: number; status: string; version: number; orderId: number | null; total: number; docType: string };

/** Kunci baris invoice supaya dua perangkat tidak bisa mengubahnya bersamaan. */
async function lockInvoice(tx: Tx, id: number): Promise<LockedInvoice> {
  type Row = { id: number; status: string; version: number; order_id: number | null; total: number; doc_type: string };
  const result = await tx.execute<Row>(
    sql`select id, status, version, order_id, total, doc_type from invoices where id = ${id} for update`,
  );
  const row = (result.rows as Row[])[0];
  if (!row) throw new InvoiceError(404, "TIDAK_DITEMUKAN", "Dokumen tidak ditemukan.");
  return { id: row.id, status: row.status, version: row.version, orderId: row.order_id, total: row.total, docType: row.doc_type };
}

async function logEvent(tx: Tx, invoiceId: number, kind: string, actor: string, detail?: string) {
  await tx.insert(invoiceEvents).values({ invoiceId, kind, actor, detail: detail ?? null });
}

/** Hitung ulang terbayar & status bayar dari tabel pembayaran, simpan di invoice. */
async function recomputePaid(tx: Tx, invoiceId: number, total: number) {
  const result = await tx.execute<{ paid: string }>(
    sql`select coalesce(sum(amount), 0)::text as paid from payments where invoice_id = ${invoiceId} and voided_at is null`,
  );
  const paid = Number.parseInt((result.rows as { paid: string }[])[0]?.paid ?? "0", 10) || 0;
  const summary = summarizePayments(total, paid);
  await tx
    .update(invoices)
    .set({ paidAmount: summary.paid, payStatus: summary.status, updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId));
  return summary;
}

/** Cermin harga & terbayar ke pesanan produksi yang tertaut (hanya untuk invoice terbit). */
async function syncOrderMirror(tx: Tx, invoiceId: number) {
  await tx.execute(sql`
    update orders
       set price = i.total,
           paid_amount = i.paid_amount
      from invoices i
     where i.id = ${invoiceId}
       and i.status = 'terbit'
       and orders.id = i.order_id
  `);
}

async function nextInvoiceNumber(tx: Tx, docType: string): Promise<string> {
  const prefix = isDocType(docType) ? DOC_MODES[docType].prefix : "INV";
  const day = jakartaDateISO().replace(/-/g, "");
  // Invoice tetap memakai kunci YYYYMMDD (kompatibel dengan data tahap A/B);
  // jenis lain punya penghitung sendiri: EST-YYYYMMDD, SJ-YYYYMMDD, PO-YYYYMMDD.
  const key = prefix === "INV" ? day : `${prefix}-${day}`;
  const result = await tx.execute<{ last_seq: number }>(sql`
    insert into invoice_counters (period_key, last_seq) values (${key}, 1)
    on conflict (period_key) do update set last_seq = invoice_counters.last_seq + 1
    returning last_seq
  `);
  const seq = (result.rows as { last_seq: number }[])[0]?.last_seq ?? 1;
  return `${prefix}-${day}-${String(seq).padStart(3, "0")}`;
}

/** Cari pelanggan dengan nama sama (tanpa peduli huruf besar/kecil); belum ada → buat baru. */
async function resolveCustomer(tx: Tx, input: InvoiceInput): Promise<number | null> {
  if (input.customerId) {
    const found = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, input.customerId)).limit(1);
    if (found[0]) return found[0].id;
  }
  const byName = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(sql`lower(${customers.name}) = lower(${input.customerName})`)
    .limit(1);
  if (byName[0]) return byName[0].id;
  const [created] = await tx
    .insert(customers)
    .values({ name: input.customerName, phone: input.customerPhone })
    .returning({ id: customers.id });
  return created.id;
}

async function writeItems(tx: Tx, invoiceId: number, rows: ReturnType<typeof priceInvoice>["rows"]) {
  await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
  if (!rows.length) return;
  await tx.insert(invoiceItems).values(
    rows.map((r, index) => ({
      invoiceId,
      position: index,
      productName: r.item.productName,
      description: r.item.description,
      unit: r.item.unit,
      qty: r.item.qty,
      areaM2: r.item.areaM2,
      basePrice: r.item.basePrice,
      tiers: r.item.tiers,
      unitPrice: Math.round(r.unitPrice * 100) / 100,
      amount: r.amount,
    })),
  );
}

/**
 * Buat pekerjaan produksi dari invoice (idempoten): bila invoice sudah punya pekerjaan,
 * tidak membuat lagi. Isi awal: status Antrian, tanpa operator, pelanggan dan item dari
 * invoice, deadline dari kasir. Harga & terbayar di pekerjaan jadi cermin invoice.
 */
async function createOrderForInvoice(tx: Tx, invoiceId: number, actor: string): Promise<number | null> {
  const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!inv || inv.orderId || !inv.prodDueDate) return inv?.orderId ?? null;
  const items = await tx
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(asc(invoiceItems.position), asc(invoiceItems.id));

  // Penomoran pekerjaan di dalam transaksi + kunci agar dua pembuatan bersamaan tidak berebut kode.
  await tx.execute(sql`select pg_advisory_xact_lock(7001)`);
  const cnt = await tx.execute<{ count: string }>(sql`select count(*)::text as count from orders`);
  let attempt = Number.parseInt((cnt.rows as { count: string }[])[0]?.count ?? "0", 10) + 1;
  let code = orderCode(attempt);
  for (let i = 0; i < 50; i += 1) {
    const exists = await tx.select({ id: orders.id }).from(orders).where(eq(orders.code, code)).limit(1);
    if (!exists.length) break;
    attempt += 1;
    code = orderCode(attempt);
  }

  const orderItemInputs = items.map((it) => ({
    productType: it.productName,
    quantity: Math.max(1, Math.round(it.qty)),
    unit: it.unit || "pcs",
  }));
  const title =
    items.length === 0
      ? `Order ${inv.customerName}`
      : (items.length === 1 ? items[0].productName : `${items[0].productName} +${items.length - 1} lainnya`).slice(0, 120);

  const [created] = await tx
    .insert(orders)
    .values({
      code,
      customerId: inv.customerId,
      customerName: inv.customerName,
      title,
      machine: MACHINES[0],
      operator: null,
      status: "antrian",
      priority: "normal",
      price: inv.total,
      paidAmount: inv.paidAmount,
      dueDate: inv.prodDueDate,
      dueTime: inv.prodDueTime || "17:00",
      estHours: estimateHoursForItems(orderItemInputs),
      notes: `Dibuat dari invoice ${inv.number ?? `#${inv.id}`}.`,
      pic: actor,
    })
    .returning({ id: orders.id, code: orders.code });
  if (orderItemInputs.length) {
    await tx.insert(orderItems).values(orderItemInputs.map((it, index) => ({ orderId: created.id, ...it, position: index })));
  }
  const rincian = orderItemInputs.map((it) => `${it.productType} ${it.quantity} ${it.unit}`).join(", ");
  await tx.insert(orderEvents).values({
    orderId: created.id,
    fromStatus: null,
    toStatus: "antrian",
    note: `Pekerjaan dibuat otomatis dari invoice ${inv.number ?? `#${inv.id}`} & masuk antrian.${rincian ? ` Isi: ${rincian}.` : ""}`,
    actor,
  });
  await tx.update(invoices).set({ orderId: created.id, updatedAt: new Date() }).where(eq(invoices.id, invoiceId));
  await logEvent(tx, invoiceId, "produksi", actor, `Pekerjaan produksi ${created.code} dibuat (deadline ${inv.prodDueDate} ${inv.prodDueTime || "17:00"}).`);
  return created.id;
}

/** Dipanggil saat invoice terbit: bila diminta, pekerjaan produksi dibuat otomatis. */
async function ensureProductionTx(tx: Tx, invoiceId: number, actor: string) {
  const [inv] = await tx
    .select({ docType: invoices.docType, needs: invoices.needsProduction, orderId: invoices.orderId })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!inv || inv.docType !== "invoice" || !inv.needs || inv.orderId) return;
  await createOrderForInvoice(tx, invoiceId, actor);
}

/** Tombol "Buat Pekerjaan Produksi" untuk invoice terbit yang belum punya pekerjaan. 1 invoice = 1 pekerjaan. */
export async function createProductionForInvoice(id: number, rawDate: unknown, rawTime: unknown, actor: string) {
  const deadline = parseDeadline(rawDate, rawTime);
  return db.transaction(async (tx) => {
    const locked = await lockInvoice(tx, id);
    if (locked.docType !== "invoice") throw new InvoiceError(409, "BUKAN_INVOICE", "Pekerjaan produksi hanya dibuat dari Invoice.");
    if (locked.status !== "terbit") throw new InvoiceError(409, "BELUM_TERBIT", "Terbitkan invoice dulu sebelum membuat pekerjaan produksi.");
    if (locked.orderId) throw new InvoiceError(409, "SUDAH_ADA_PEKERJAAN", "Invoice ini sudah punya pekerjaan produksi (1 invoice = 1 pekerjaan).");
    await tx
      .update(invoices)
      .set({ needsProduction: true, prodDueDate: deadline.dueDate, prodDueTime: deadline.dueTime, updatedAt: new Date() })
      .where(eq(invoices.id, id));
    const orderId = await createOrderForInvoice(tx, id, actor);
    await syncOrderMirror(tx, id);
    return orderId;
  });
}

async function issueInTx(tx: Tx, invoiceId: number, actor: string) {
  const locked = await lockInvoice(tx, invoiceId);
  if (locked.status === "terbit") throw new InvoiceError(409, "SUDAH_TERBIT", "Dokumen ini sudah diterbitkan.");
  if (locked.status !== "draft") throw new InvoiceError(409, "STATUS_TIDAK_COCOK", "Hanya draft yang bisa diterbitkan.");
  const itemCount = await tx.select({ id: invoiceItems.id }).from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId)).limit(1);
  if (!itemCount.length) throw new InvoiceError(400, "ITEM_KOSONG", "Isi minimal satu baris item sebelum menerbitkan invoice.");
  // Surat Jalan memang tanpa harga, jadi total Rp 0 wajar.
  if (locked.total <= 0 && locked.docType !== "suratjalan") {
    throw new InvoiceError(400, "TOTAL_NOL", "Total masih Rp 0. Isi harga dulu sebelum menerbitkan.");
  }
  const number = await nextInvoiceNumber(tx, locked.docType);
  await tx
    .update(invoices)
    .set({ number, status: "terbit", issuedAt: new Date(), updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId));
  await logEvent(tx, invoiceId, "terbit", actor, `${DOC_MODES[(isDocType(locked.docType) ? locked.docType : "invoice")].label} diterbitkan dengan nomor ${number}.`);
  await ensureProductionTx(tx, invoiceId, actor);
  await syncOrderMirror(tx, invoiceId);
  return number;
}

async function addPaymentInTx(
  tx: Tx,
  invoiceId: number,
  input: PaymentInput,
  actor: string,
): Promise<{ payment: PaymentRow; duplicate: boolean }> {
  const locked = await lockInvoice(tx, invoiceId);

  // Kode unik sudah pernah dipakai? Anggap pengiriman ulang: jangan catat dobel.
  if (input.clientRef) {
    const existing = await tx.select().from(payments).where(eq(payments.clientRef, input.clientRef)).limit(1);
    if (existing[0]) {
      if (existing[0].invoiceId !== invoiceId) {
        throw new InvoiceError(409, "KODE_DIPAKAI", "Kode pembayaran ini sudah terpakai di invoice lain.");
      }
      return { payment: existing[0], duplicate: true };
    }
  }

  if (locked.docType !== "invoice") {
    throw new InvoiceError(409, "TANPA_PEMBAYARAN", "Hanya Invoice yang punya pembayaran. Jadikan Invoice dulu kalau sudah deal.");
  }
  if (locked.status === "draft") throw new InvoiceError(409, "MASIH_DRAFT", "Terbitkan invoice dulu sebelum mencatat pembayaran.");
  if (locked.status === "batal") throw new InvoiceError(409, "SUDAH_BATAL", "Invoice ini sudah dibatalkan.");

  const sumRow = await tx.execute<{ paid: string }>(
    sql`select coalesce(sum(amount), 0)::text as paid from payments where invoice_id = ${invoiceId} and voided_at is null`,
  );
  const paidBefore = Number.parseInt((sumRow.rows as { paid: string }[])[0]?.paid ?? "0", 10) || 0;
  const overBy = paidBefore + input.amount - locked.total;
  if (overBy > 0 && !input.confirmOverpay) {
    throw new InvoiceError(
      409,
      "KELEBIHAN_BAYAR",
      `Pembayaran ini melebihi tagihan sebesar ${formatRupiah(overBy)}. Konfirmasi dulu kalau memang sengaja.`,
    );
  }

  const [payment] = await tx
    .insert(payments)
    .values({
      invoiceId,
      kind: input.kind,
      amount: input.amount,
      method: input.method,
      paidAt: input.paidAt,
      note: input.note,
      clientRef: input.clientRef,
      createdBy: actor,
    })
    .returning();

  const summary = await recomputePaid(tx, invoiceId, locked.total);
  await syncOrderMirror(tx, invoiceId);
  await logEvent(
    tx,
    invoiceId,
    "bayar",
    actor,
    `${input.kind === "dp" ? "DP" : "Pembayaran"} ${formatRupiah(input.amount)} via ${input.method}${
      summary.status === "lunas" ? " — LUNAS" : ""
    }${overBy > 0 ? ` (lebih ${formatRupiah(overBy)}, dikonfirmasi)` : ""}.`,
  );
  return { payment, duplicate: false };
}

/* ------------------------------------------------------------------ */
/* Baca data                                                           */
/* ------------------------------------------------------------------ */

export type InvoiceListRow = {
  id: number;
  docType: string;
  number: string | null;
  status: string;
  customerName: string;
  issueDate: string;
  dueDate: string | null;
  total: number;
  paidAmount: number;
  payStatus: string;
  orderId: number | null;
  orderCode: string | null;
  orderStatus: string | null;
  payMethod: string;
  createdAt: Date;
};

export type InvoiceListFilter = {
  docType?: string;
  status?: string;
  payStatus?: string;
  q?: string;
  /** Hanya dokumen bertanggal di bulan ini ("YYYY-MM"). */
  month?: string;
  /** "lewat" = Invoice terbit, belum lunas, jatuh tempo sudah lewat. */
  due?: string;
  /** Aktifkan pencocokan nominal/kode unik transfer saat q berisi angka. */
  uniqueCode?: boolean;
  limit?: number;
  offset?: number;
};

/**
 * Cocokkan Mutasi Bank: cari Invoice yang nominal transfernya (sisa + kode unik), totalnya,
 * kode uniknya, atau akhiran angkanya cocok dengan angka yang diketik. Aturan sama dengan app lama.
 */
export async function bankMatchIds(digits: string, uniqueCodeEnabled: boolean): Promise<number[]> {
  if (!digits) return [];
  const rows = await db
    .select({ id: invoices.id, number: invoices.number, total: invoices.total, paid: invoices.paidAmount, method: invoices.payMethod })
    .from(invoices)
    .where(and(eq(invoices.docType, "invoice"), eq(invoices.status, "terbit")))
    .orderBy(desc(invoices.id))
    .limit(3000);
  return rows
    .filter((r) => {
      const info = computePayInfo({ total: r.total, paid: r.paid, method: r.method, number: r.number, uniqueCodeEnabled });
      return bankMatch(digits, { total: r.total, payable: info.payable, code: info.code }) !== null;
    })
    .map((r) => r.id);
}

export async function listInvoices(filter: InvoiceListFilter = {}) {
  const conditions: SQL[] = [];
  if (isDocType(filter.docType)) conditions.push(eq(invoices.docType, filter.docType));
  if (filter.status && ["draft", "terbit", "batal"].includes(filter.status)) {
    conditions.push(eq(invoices.status, filter.status));
  }
  if (filter.payStatus && ["belum", "sebagian", "lunas"].includes(filter.payStatus)) {
    conditions.push(eq(invoices.payStatus, filter.payStatus));
    // Status bayar hanya bermakna untuk invoice yang sudah terbit.
    conditions.push(eq(invoices.status, "terbit"));
  }
  if (filter.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(filter.month)) {
    conditions.push(sql`to_char(${invoices.issueDate}, 'YYYY-MM') = ${filter.month}`);
  }
  if (filter.due === "lewat") {
    conditions.push(eq(invoices.docType, "invoice"));
    conditions.push(eq(invoices.status, "terbit"));
    conditions.push(sql`${invoices.payStatus} <> 'lunas'`);
    conditions.push(sql`${invoices.dueDate} < ${jakartaDateISO()}::date`);
  }
  const q = filter.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const textMatch = or(ilike(invoices.number, like), ilike(invoices.customerName, like));
    const digits = onlyDigits(q);
    const ids = digits ? await bankMatchIds(digits, Boolean(filter.uniqueCode)) : [];
    const match = ids.length && textMatch ? or(textMatch, inArray(invoices.id, ids)) : textMatch;
    if (match) conditions.push(match);
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const rows: InvoiceListRow[] = await db
    .select({
      id: invoices.id,
      docType: invoices.docType,
      number: invoices.number,
      status: invoices.status,
      customerName: invoices.customerName,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      total: invoices.total,
      paidAmount: invoices.paidAmount,
      payStatus: invoices.payStatus,
      orderId: invoices.orderId,
      orderCode: orders.code,
      orderStatus: orders.status,
      payMethod: invoices.payMethod,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .leftJoin(orders, eq(orders.id, invoices.orderId))
    .where(where)
    .orderBy(desc(invoices.createdAt), desc(invoices.id))
    .limit(limit)
    .offset(offset);

  const stat = await db.execute<{ open_count: string; outstanding: string }>(sql`
    select count(*)::text as open_count,
           coalesce(sum(total - paid_amount), 0)::text as outstanding
      from invoices
     where doc_type = 'invoice' and status = 'terbit' and pay_status <> 'lunas'
  `);
  const s = (stat.rows as { open_count: string; outstanding: string }[])[0];
  return {
    rows,
    stats: {
      openCount: Number.parseInt(s?.open_count ?? "0", 10) || 0,
      outstanding: Number.parseInt(s?.outstanding ?? "0", 10) || 0,
    },
  };
}

export type InvoiceDetail = {
  invoice: typeof invoices.$inferSelect;
  items: InvoiceItemRow[];
  payments: PaymentRow[];
  events: InvoiceEventRow[];
  order: { id: number; code: string; status: string } | null;
  summary: { paid: number; remaining: number; overpaid: number; status: PayStatus };
  /** Dokumen asal (bila ini hasil "Jadikan Invoice"). */
  source: { id: number; number: string | null; docType: string } | null;
  /** Dokumen turunan (invoice yang dibuat dari dokumen ini). */
  converted: { id: number; number: string | null; status: string }[];
};

export async function getInvoiceDetail(id: number): Promise<InvoiceDetail | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!invoice) return null;
  const [items, pays, events, orderRows, sourceRows, convertedRows] = await Promise.all([
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(asc(invoiceItems.position), asc(invoiceItems.id)),
    db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(asc(payments.paidAt), asc(payments.id)),
    db.select().from(invoiceEvents).where(eq(invoiceEvents.invoiceId, id)).orderBy(desc(invoiceEvents.createdAt), desc(invoiceEvents.id)),
    invoice.orderId
      ? db.select({ id: orders.id, code: orders.code, status: orders.status }).from(orders).where(eq(orders.id, invoice.orderId)).limit(1)
      : Promise.resolve([] as { id: number; code: string; status: string }[]),
    invoice.sourceId
      ? db.select({ id: invoices.id, number: invoices.number, docType: invoices.docType }).from(invoices).where(eq(invoices.id, invoice.sourceId)).limit(1)
      : Promise.resolve([] as { id: number; number: string | null; docType: string }[]),
    db.select({ id: invoices.id, number: invoices.number, status: invoices.status }).from(invoices).where(eq(invoices.sourceId, id)).orderBy(asc(invoices.id)),
  ]);
  return {
    invoice,
    items,
    payments: pays,
    events,
    order: orderRows[0] ?? null,
    summary: summarizePayments(invoice.total, invoice.paidAmount),
    source: sourceRows[0] ?? null,
    converted: convertedRows,
  };
}

/* ------------------------------------------------------------------ */
/* Tulis data                                                          */
/* ------------------------------------------------------------------ */

export type CreateInvoiceOptions = {
  /** Langsung terbitkan (nomor resmi keluar). false = simpan sebagai draft. */
  issue?: boolean;
  /** DP awal (hanya bila langsung diterbitkan). Dicatat sebagai pembayaran pertama berjenis "dp". */
  dp?: PaymentInput | null;
  /** Kode unik dari perangkat agar kiriman ganda tidak membuat invoice dobel. */
  clientRef?: string | null;
  /** Dokumen asal (dipakai "Jadikan Invoice"). */
  sourceId?: number | null;
};

export async function createInvoice(input: InvoiceInput, actor: string, options: CreateInvoiceOptions = {}) {
  const ref = options.clientRef?.trim().slice(0, 100) || null;
  if (ref) {
    const existing = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.clientRef, ref)).limit(1);
    if (existing[0]) return { id: existing[0].id, duplicate: true };
  }
  if (options.dp && input.docType !== "invoice") {
    throw new InvoiceError(400, "TANPA_PEMBAYARAN", "Hanya Invoice yang bisa memakai DP.");
  }
  if (options.dp && !options.issue) {
    throw new InvoiceError(400, "DP_BUTUH_TERBIT", "DP hanya bisa dicatat saat invoice langsung diterbitkan.");
  }
  const { rows, totals } = priceInvoice(input);

  const id = await db.transaction(async (tx) => {
    if (input.orderId) {
      const order = await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, input.orderId)).limit(1);
      if (!order[0]) throw new InvoiceError(404, "PESANAN_TIDAK_ADA", "Pekerjaan yang dipilih tidak ditemukan.");
      const taken = await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.orderId, input.orderId)).limit(1);
      if (taken[0]) throw new InvoiceError(409, "PESANAN_SUDAH_PUNYA_INVOICE", "Pekerjaan ini sudah punya invoice (1 invoice = 1 pekerjaan).");
    }
    const customerId = await resolveCustomer(tx, input);
    const [created] = await tx
      .insert(invoices)
      .values({
        docType: input.docType,
        status: "draft",
        needsProduction: input.needsProduction,
        prodDueDate: input.prodDueDate,
        prodDueTime: input.prodDueTime,
        sourceId: options.sourceId ?? null,
        customerId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        payMethod: input.payMethod,
        subtotal: totals.subtotal,
        discountType: totals.discountType,
        discountInput: totals.discountInput,
        discountRate: totals.discountRate,
        discountAmount: totals.discountAmount,
        taxRate: totals.taxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
        notes: input.notes,
        terms: input.terms,
        orderId: input.orderId,
        clientRef: ref,
        createdBy: actor,
      })
      .returning({ id: invoices.id });
    await writeItems(tx, created.id, rows);
    await logEvent(
      tx,
      created.id,
      "dibuat",
      actor,
      `Draft ${DOC_MODES[input.docType].label} dibuat (${rows.length} item${DOC_MODES[input.docType].showTotals ? `, total ${formatRupiah(totals.total)}` : ""}).`,
    );
    if (options.issue) {
      await issueInTx(tx, created.id, actor);
      if (options.dp) await addPaymentInTx(tx, created.id, { ...options.dp, kind: "dp" }, actor);
    }
    return created.id;
  });
  return { id, duplicate: false };
}

export async function updateInvoice(
  id: number,
  input: InvoiceInput,
  expectedVersion: number,
  actor: { name: string; isOwner: boolean },
) {
  const { rows, totals } = priceInvoice(input);
  await db.transaction(async (tx) => {
    const locked = await lockInvoice(tx, id);
    if (locked.status === "batal") throw new InvoiceError(409, "SUDAH_BATAL", "Dokumen yang sudah dibatalkan tidak bisa diedit.");
    if (locked.docType !== input.docType) {
      throw new InvoiceError(400, "JENIS_TIDAK_BISA_DIUBAH", "Jenis dokumen tidak bisa diubah setelah dibuat. Buat dokumen baru, atau pakai Jadikan Invoice.");
    }
    if (locked.version !== expectedVersion) {
      throw new InvoiceError(
        409,
        "VERSI_BERBEDA",
        "Invoice ini baru saja diubah di perangkat lain. Muat ulang halaman supaya perubahan orang lain tidak tertimpa.",
      );
    }
    if (locked.status === "terbit" && !actor.isOwner) {
      const active = await tx.select({ id: payments.id }).from(payments).where(and(eq(payments.invoiceId, id), isNull(payments.voidedAt))).limit(1);
      if (active.length) {
        throw new InvoiceError(403, "HANYA_OWNER", "Invoice yang sudah ada pembayarannya hanya boleh diedit oleh Owner.");
      }
    }
    const customerId = await resolveCustomer(tx, input);
    await tx
      .update(invoices)
      .set({
        customerId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        payMethod: input.payMethod,
        subtotal: totals.subtotal,
        discountType: totals.discountType,
        discountInput: totals.discountInput,
        discountRate: totals.discountRate,
        discountAmount: totals.discountAmount,
        taxRate: totals.taxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
        notes: input.notes,
        terms: input.terms,
        // Produksi hanya bisa diminta lewat edit selama pekerjaan belum dibuat.
        ...(locked.orderId ? {} : { needsProduction: input.needsProduction, prodDueDate: input.prodDueDate, prodDueTime: input.prodDueTime }),
        version: locked.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, id));
    await writeItems(tx, id, rows);
    const summary = await recomputePaid(tx, id, totals.total);
    await syncOrderMirror(tx, id);
    await logEvent(
      tx,
      id,
      "diedit",
      actor.name,
      `Isi invoice diubah (${rows.length} item, total ${formatRupiah(totals.total)}${
        summary.overpaid > 0 ? `, kelebihan bayar ${formatRupiah(summary.overpaid)}` : ""
      }).`,
    );
  });
}

export async function issueInvoice(id: number, actor: string) {
  return db.transaction((tx) => issueInTx(tx, id, actor));
}

export async function addPayment(invoiceId: number, input: PaymentInput, actor: string) {
  return db.transaction((tx) => addPaymentInTx(tx, invoiceId, input, actor));
}

/** Batalkan satu pembayaran (soft). Hanya Owner — dicek di route. */
export async function voidPayment(invoiceId: number, paymentId: number, reason: string, actor: string) {
  const why = reason.trim().slice(0, 300);
  if (!why) throw new InvoiceError(400, "ALASAN_KOSONG", "Alasan pembatalan wajib diisi.");
  await db.transaction(async (tx) => {
    const locked = await lockInvoice(tx, invoiceId);
    if (locked.status === "batal") throw new InvoiceError(409, "SUDAH_BATAL", "Invoice ini sudah dibatalkan.");
    const [pay] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.invoiceId, invoiceId)))
      .limit(1);
    if (!pay) throw new InvoiceError(404, "PEMBAYARAN_TIDAK_ADA", "Pembayaran tidak ditemukan.");
    if (pay.voidedAt) throw new InvoiceError(409, "SUDAH_DIBATALKAN", "Pembayaran ini sudah dibatalkan sebelumnya.");
    await tx.update(payments).set({ voidedAt: new Date(), voidedBy: actor, voidReason: why }).where(eq(payments.id, paymentId));
    await recomputePaid(tx, invoiceId, locked.total);
    await syncOrderMirror(tx, invoiceId);
    await logEvent(tx, invoiceId, "bayar_batal", actor, `Pembayaran ${formatRupiah(pay.amount)} (${pay.method}) dibatalkan: ${why}`);
  });
}

/** Batalkan invoice terbit. Hanya Owner. Pembayaran aktif harus dibatalkan dulu supaya uangnya tidak "menggantung". */
export async function voidInvoice(id: number, reason: string, actor: string) {
  const why = reason.trim().slice(0, 300);
  if (!why) throw new InvoiceError(400, "ALASAN_KOSONG", "Alasan pembatalan wajib diisi.");
  await db.transaction(async (tx) => {
    const locked = await lockInvoice(tx, id);
    if (locked.status === "batal") throw new InvoiceError(409, "SUDAH_BATAL", "Invoice ini sudah dibatalkan.");
    if (locked.status === "draft") {
      throw new InvoiceError(409, "MASIH_DRAFT", "Draft tidak perlu dibatalkan — hapus saja.");
    }
    const active = await tx.select({ id: payments.id }).from(payments).where(and(eq(payments.invoiceId, id), isNull(payments.voidedAt))).limit(1);
    if (active.length) {
      throw new InvoiceError(409, "MASIH_ADA_PEMBAYARAN", "Masih ada pembayaran aktif. Batalkan pembayarannya dulu, baru invoice ini.");
    }
    await tx
      .update(invoices)
      .set({ status: "batal", voidReason: why, voidedAt: new Date(), updatedAt: new Date() })
      .where(eq(invoices.id, id));
    await logEvent(tx, id, "batal", actor, `Invoice dibatalkan: ${why}`);
  });
}

/** Hapus draft (belum punya nomor resmi, belum ada uang). Invoice terbit tidak bisa dihapus, hanya dibatalkan. */
export async function deleteDraft(id: number, actor: { name: string; isOwner: boolean }) {
  await db.transaction(async (tx) => {
    const locked = await lockInvoice(tx, id);
    if (locked.status !== "draft") {
      throw new InvoiceError(409, "BUKAN_DRAFT", "Hanya draft yang bisa dihapus. Invoice yang sudah terbit hanya bisa dibatalkan.");
    }
    const [row] = await tx.select({ createdBy: invoices.createdBy }).from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!actor.isOwner && row?.createdBy !== actor.name) {
      throw new InvoiceError(403, "BUKAN_PEMBUAT", "Draft milik orang lain hanya bisa dihapus oleh Owner.");
    }
    await tx.delete(invoices).where(eq(invoices.id, id));
  });
}


/* ------------------------------------------------------------------ */
/* Jadikan Invoice & Duplikat                                          */
/* ------------------------------------------------------------------ */

type SourceDoc = {
  invoice: typeof invoices.$inferSelect;
  items: InvoiceItemRow[];
};

async function loadSource(tx: Tx, id: number): Promise<SourceDoc> {
  await lockInvoice(tx, id);
  const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!invoice) throw new InvoiceError(404, "TIDAK_DITEMUKAN", "Dokumen tidak ditemukan.");
  const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(asc(invoiceItems.position), asc(invoiceItems.id));
  return { invoice, items };
}

/** Salin isi dokumen jadi DRAFT baru. Pembayaran, nomor, dan tautan produksi tidak ikut tersalin. */
async function copyAsDraft(
  tx: Tx,
  src: SourceDoc,
  docType: DocType,
  actor: string,
  opts: { dueDays: number; sourceId: number | null; label: string },
): Promise<number> {
  const mode = DOC_MODES[docType];
  const today = jakartaDateISO();
  const [y, m, d] = today.split("-").map(Number);
  const due = opts.dueDays > 0 && mode.dueLabel ? new Date(Date.UTC(y, m - 1, d + opts.dueDays)).toISOString().slice(0, 10) : null;
  const [created] = await tx
    .insert(invoices)
    .values({
      docType,
      status: "draft",
      sourceId: opts.sourceId,
      customerId: src.invoice.customerId,
      customerName: src.invoice.customerName,
      customerPhone: src.invoice.customerPhone,
      issueDate: today,
      dueDate: due,
      payMethod: src.invoice.payMethod,
      subtotal: src.invoice.subtotal,
      discountType: src.invoice.discountType,
      discountInput: src.invoice.discountInput,
      discountRate: src.invoice.discountRate,
      discountAmount: src.invoice.discountAmount,
      taxRate: src.invoice.taxRate,
      taxAmount: src.invoice.taxAmount,
      total: src.invoice.total,
      notes: src.invoice.notes,
      terms: src.invoice.terms,
      createdBy: actor,
    })
    .returning({ id: invoices.id });
  if (src.items.length) {
    await tx.insert(invoiceItems).values(
      src.items.map((it, index) => ({
        invoiceId: created.id,
        position: index,
        productName: it.productName,
        description: it.description,
        unit: it.unit,
        qty: it.qty,
        areaM2: it.areaM2,
        basePrice: it.basePrice,
        tiers: it.tiers,
        unitPrice: it.unitPrice,
        amount: it.amount,
      })),
    );
  }
  await logEvent(tx, created.id, "dibuat", actor, opts.label);
  return created.id;
}

/** "Jadikan Invoice": salin Estimasi / PO / Surat Jalan jadi draft Invoice baru. Satu dokumen hanya boleh sekali. */
export async function convertToInvoice(id: number, actor: string, dueDays: number) {
  return db.transaction(async (tx) => {
    const src = await loadSource(tx, id);
    if (src.invoice.docType === "invoice") throw new InvoiceError(409, "SUDAH_INVOICE", "Dokumen ini sudah berupa Invoice.");
    if (src.invoice.status !== "terbit") throw new InvoiceError(409, "BELUM_TERBIT", "Terbitkan dokumennya dulu sebelum dijadikan Invoice.");
    const existing = await tx.select({ id: invoices.id, number: invoices.number }).from(invoices).where(eq(invoices.sourceId, id)).limit(1);
    if (existing[0]) {
      throw new InvoiceError(
        409,
        "SUDAH_DIKONVERSI",
        `Dokumen ini sudah dijadikan Invoice (${existing[0].number ?? `draft #${existing[0].id}`}). Buka yang itu saja supaya tidak dobel.`,
      );
    }
    const newId = await copyAsDraft(tx, src, "invoice", actor, {
      dueDays,
      sourceId: id,
      label: `Draft Invoice dibuat dari ${DOC_MODES[(isDocType(src.invoice.docType) ? src.invoice.docType : "invoice")].label} ${src.invoice.number ?? ""}.`.trim(),
    });
    await logEvent(tx, id, "dikonversi", actor, `Dijadikan Invoice (draft #${newId}).`);
    return newId;
  });
}

/** Duplikat: salinan draft dari dokumen mana pun (jenis sama). */
export async function duplicateInvoice(id: number, actor: string, dueDays: number) {
  return db.transaction(async (tx) => {
    const src = await loadSource(tx, id);
    const type: DocType = isDocType(src.invoice.docType) ? src.invoice.docType : "invoice";
    return copyAsDraft(tx, src, type, actor, {
      dueDays,
      sourceId: null,
      label: `Draft dibuat dengan menduplikat ${src.invoice.number ?? `draft #${src.invoice.id}`}.`,
    });
  });
}

/* ------------------------------------------------------------------ */
/* Sambungan dengan pekerjaan produksi (sisi halaman pekerjaan)          */
/* ------------------------------------------------------------------ */

export type OrderInvoiceLink = {
  id: number;
  number: string | null;
  status: string;
  total: number;
  paidAmount: number;
  payStatus: string;
};

/** Invoice yang tertaut ke sebuah pekerjaan (null bila belum ada / sudah dibatalkan). */
export async function getInvoiceForOrder(orderId: number): Promise<OrderInvoiceLink | null> {
  const [row] = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      total: invoices.total,
      paidAmount: invoices.paidAmount,
      payStatus: invoices.payStatus,
    })
    .from(invoices)
    .where(and(eq(invoices.orderId, orderId), eq(invoices.docType, "invoice")))
    .limit(1);
  return row ?? null;
}

/** Bahan isi awal form "Buat Invoice dari Pekerjaan Ini": pelanggan + item pekerjaan. */
export async function getOrderPrefill(orderId: number) {
  if (!Number.isInteger(orderId) || orderId <= 0) return null;
  const [order] = await db
    .select({ id: orders.id, code: orders.code, customerName: orders.customerName, customerId: orders.customerId, title: orders.title })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return null;
  const items = await db
    .select({ productType: orderItems.productType, quantity: orderItems.quantity, unit: orderItems.unit })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.position), asc(orderItems.id));
  const phone = order.customerId
    ? (await db.select({ phone: customers.phone }).from(customers).where(eq(customers.id, order.customerId)).limit(1))[0]?.phone ?? null
    : null;
  return { order, items, phone };
}
