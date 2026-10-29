import "server-only";
import { randomUUID } from "node:crypto";
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
import { MACHINES, customerLabel, estimateHoursForItems, formatRupiah, jakartaDateISO, orderCode } from "@/lib/domain";
import { bankMatch, onlyDigits } from "@/lib/invoice-due";
import { monthEnd } from "@/lib/invoice-period";
import { DOC_MODES, isDocType, type DocType } from "@/lib/invoice-modes";
import { computePayInfo } from "@/lib/invoice-pay";
import { ensureItemProductionSchema } from "@/lib/item-production";
import { ensurePaymentSchema } from "@/lib/payment-schema";
import { unmatchedInvoiceItems } from "@/lib/production-sync";
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
  /** Kunci stabil baris; dipakai untuk mencocokkan dengan item produksi. */
  lineKey: string;
  productName: string;
  description: string | null;
  unit: string;
  qty: number;
  areaM2: number;
  basePrice: number;
  tiers: InvoiceTierConfig | null;
  /** Ikut dibuat sebagai baris pekerjaan produksi saat invoice diterbitkan. */
  needsProduction: boolean;
  /** Deadline item. null = ikut deadline produksi utama invoice. */
  prodDueDate: string | null;
  prodDueTime: string | null;
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

/**
 * Baca pilihan produksi satu baris invoice.
 * - Bawaan TRUE supaya item lama / klien lama tetap ikut produksi.
 * - Tanggal & jam boleh kosong; nanti memakai deadline utama invoice.
 * - Jam tidak boleh diisi tanpa tanggal (mudah salah kalau dibiarkan).
 */
function parseItemProduction(
  row: Record<string, unknown>,
  index: number,
): { needsProduction: boolean; prodDueDate: string | null; prodDueTime: string | null } {
  const flag = row.needsProduction;
  const needsProduction = !(flag === false || flag === "false" || flag === 0);
  if (!needsProduction) return { needsProduction: false, prodDueDate: null, prodDueTime: null };

  const prodDueDate = isoDateOrNull(row.prodDueDate, `Deadline produksi baris ${index + 1}`);
  const rawTime = typeof row.prodDueTime === "string" ? row.prodDueTime.trim() : "";
  if (rawTime && !prodDueDate) {
    throw new InvoiceError(
      400,
      "JAM_TANPA_TANGGAL",
      `Baris ${index + 1}: isi tanggal deadline item dulu sebelum jamnya.`,
    );
  }
  if (rawTime && !TIME_HHMM.test(rawTime)) {
    throw new InvoiceError(
      400,
      "JAM_TIDAK_VALID",
      `Jam deadline item baris ${index + 1} tidak valid. Gunakan format 17:00.`,
    );
  }
  return { needsProduction: true, prodDueDate, prodDueTime: rawTime || null };
}

export function parseInvoiceInput(raw: unknown): InvoiceInput {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const docType: DocType = body.docType === undefined || body.docType === "" ? "invoice" : (body.docType as DocType);
  if (!isDocType(docType)) throw new InvoiceError(400, "JENIS_TIDAK_VALID", "Jenis dokumen tidak dikenal.");
  const mode = DOC_MODES[docType];

  // Data customer OPSIONAL. Kolomnya di database tetap NOT NULL, jadi kosong
  // disimpan sebagai string kosong, bukan null. Pelanggan tanpa nama tidak
  // dibuatkan di tabel pelanggan (lihat resolveCustomer) supaya daftar
  // Pelanggan tidak terganggu baris kosong.
  const customerName = text(body.customerName, 200);

  const orderIdNumber = Number(body.orderId);
  const linkedOrderId = docType === "invoice" && Number.isInteger(orderIdNumber) && orderIdNumber > 0 ? orderIdNumber : null;
  // Invoice yang dibuat dari pekerjaan sudah punya pekerjaan; hanya Invoice yang boleh minta produksi.
  const wantProduction = docType === "invoice" && !linkedOrderId && body.needsProduction === true;
  const deadline = wantProduction ? parseDeadline(body.prodDueDate, body.prodDueTime) : null;

  const itemsRaw = Array.isArray(body.items) ? body.items : [];
  if (itemsRaw.length > 200) throw new InvoiceError(400, "ITEM_TERLALU_BANYAK", "Maksimal 200 baris item per invoice.");
  const usedLineKeys = new Set<string>();
  const items: InvoiceItemInput[] = itemsRaw
    .map((entry, index) => {
      const r = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
      const cfg = r.tiers ? normalizeTiers(r.tiers) : null;
      const production = parseItemProduction(r, index);
      let lineKey = text(r.lineKey, 120);
      if (!lineKey || usedLineKeys.has(lineKey)) lineKey = randomUUID();
      usedLineKeys.add(lineKey);
      return {
        lineKey,
        productName: text(r.productName, 300),
        description: text(r.description, 1000) || null,
        unit: text(r.unit, 30) || "pcs",
        qty: Math.max(0, numberOf(r.qty)),
        areaM2: Math.max(0, numberOf(r.areaM2)),
        // Surat Jalan tidak memakai harga sama sekali.
        basePrice: mode.showPrices ? Math.max(0, Math.round(numberOf(r.basePrice))) : 0,
        tiers: mode.showPrices && cfg && cfg.list.length ? cfg : null,
        ...production,
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

  if (wantProduction) {
    const selected = items.filter((it) => it.needsProduction);
    if (!selected.length) {
      throw new InvoiceError(
        400,
        "ITEM_PRODUKSI_KOSONG",
        "Centang minimal satu item yang perlu masuk antrian produksi, atau matikan monitoring produksi.",
      );
    }
    for (const [index, it] of items.entries()) {
      if (it.needsProduction && it.prodDueDate && it.prodDueDate < jakartaDateISO()) {
        throw new InvoiceError(
          400,
          "DEADLINE_ITEM_LEWAT",
          `Deadline produksi baris ${index + 1} tidak boleh tanggal yang sudah lewat.`,
        );
      }
    }
  }

  const method = body.payMethod === undefined || body.payMethod === "" ? "Transfer" : body.payMethod;
  if (!isPayMethod(method)) {
    throw new InvoiceError(400, "METODE_TIDAK_VALID", "Metode bayar harus Transfer, Cash, atau QRIS.");
  }

  const termsRaw = Array.isArray(body.terms) ? body.terms : [];
  const terms = termsRaw.map((t) => text(t, 500)).filter(Boolean).slice(0, 30);

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
  /** No. referensi transaksi (RRN / ID transaksi QRIS atau bank). Opsional. */
  reference: string | null;
  /** True bila kasir sudah mengonfirmasi bahwa referensi yang sama memang sengaja dipakai lagi. */
  confirmDuplicateReference: boolean;
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
    // Spasi berlebih dirapikan supaya "ABC  123" dan "ABC 123" dianggap sama.
    reference: text(body.reference, 60).replace(/\s+/g, " ") || null,
    confirmDuplicateReference: body.confirmDuplicateReference === true,
  };
}

/* ------------------------------------------------------------------ */
/* Pembantu internal (di dalam transaksi)                              */
/* ------------------------------------------------------------------ */

type LockedInvoice = { id: number; status: string; version: number; orderId: number | null; total: number; docType: string };

/** Kunci baris invoice supaya dua perangkat tidak bisa mengubahnya bersamaan. */
/* Diexport supaya fitur lain di modul invoice (mis. refund) mengunci baris
   invoice dengan pola yang sama — satu pintu, tidak ada kunci ganda. */
export async function lockInvoice(tx: Tx, id: number): Promise<LockedInvoice> {
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
  // Invoice boleh tanpa data customer. Kalau begitu jangan sentuh tabel
  // pelanggan sama sekali - customerId dibiarkan null dan tidak muncul
  // baris kosong di halaman Pelanggan.
  if (!input.customerName.trim()) return null;
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
      lineKey: r.item.lineKey,
      productName: r.item.productName,
      description: r.item.description,
      unit: r.item.unit,
      qty: r.item.qty,
      areaM2: r.item.areaM2,
      basePrice: r.item.basePrice,
      tiers: r.item.tiers,
      unitPrice: Math.round(r.unitPrice * 100) / 100,
      amount: r.amount,
      needsProduction: r.item.needsProduction,
      prodDueDate: r.item.prodDueDate,
      prodDueTime: r.item.prodDueTime,
    })),
  );
}

type ProductionDeadline = { dueDate: string; dueTime: string };

/** Deadline item: pakai tanggal/jam item bila diisi, kalau tidak ikut deadline utama. */
function effectiveItemDeadline(
  item: { prodDueDate: string | null; prodDueTime: string | null },
  fallback: ProductionDeadline,
): ProductionDeadline {
  return {
    dueDate: item.prodDueDate ?? fallback.dueDate,
    dueTime: item.prodDueTime ?? fallback.dueTime,
  };
}

function earlierDeadline(a: ProductionDeadline, b: ProductionDeadline): ProductionDeadline {
  return `${a.dueDate}T${a.dueTime}` <= `${b.dueDate}T${b.dueTime}` ? a : b;
}

/**
 * Buat pekerjaan produksi dari invoice (idempoten): bila invoice sudah punya pekerjaan,
 * tidak membuat lagi. Hanya item yang dicentang "perlu produksi" yang disalin.
 * Deadline pekerjaan = deadline terawal dari item terpilih / deadline utama invoice.
 */
async function createOrderForInvoice(tx: Tx, invoiceId: number, actor: string): Promise<number | null> {
  const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!inv || inv.orderId || !inv.prodDueDate) return inv?.orderId ?? null;
  const items = await tx
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(asc(invoiceItems.position), asc(invoiceItems.id));

  const selected = items.filter((it) => it.needsProduction);
  if (!selected.length) {
    throw new InvoiceError(
      400,
      "ITEM_PRODUKSI_KOSONG",
      "Tidak ada item yang dicentang untuk produksi. Centang minimal satu item sebelum membuat pekerjaan.",
    );
  }
  const masterDeadline: ProductionDeadline = {
    dueDate: inv.prodDueDate,
    dueTime: inv.prodDueTime || "17:00",
  };
  const itemRows = selected.map((item) => ({ item, deadline: effectiveItemDeadline(item, masterDeadline) }));
  const orderDeadline = itemRows.reduce((earliest, row) => earlierDeadline(earliest, row.deadline), masterDeadline);

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

  const orderItemInputs = itemRows.map(({ item, deadline }) => ({
    productType: item.productName,
    quantity: Math.max(1, Math.round(item.qty)),
    unit: item.unit || "pcs",
    dueDate: deadline.dueDate,
    dueTime: deadline.dueTime,
    sourceLineKey: item.lineKey,
  }));
  const title =
    selected.length === 0
      ? `Order ${customerLabel(inv.customerName)}`
      : (selected.length === 1 ? selected[0].productName : `${selected[0].productName} +${selected.length - 1} lainnya`).slice(0, 120);

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
      dueDate: orderDeadline.dueDate,
      dueTime: orderDeadline.dueTime,
      estHours: estimateHoursForItems(orderItemInputs),
      notes: `Dibuat dari invoice ${inv.number ?? `#${inv.id}`} (${selected.length} item produksi).`,
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
  await logEvent(
    tx,
    invoiceId,
    "produksi",
    actor,
    `Pekerjaan produksi ${created.code} dibuat untuk ${selected.length} item (deadline ${orderDeadline.dueDate} ${orderDeadline.dueTime}).`,
  );
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

type ProductionSelection = {
  id: number;
  needsProduction: boolean;
  prodDueDate: string | null;
  prodDueTime: string | null;
};

/** Pilihan item dari modal "Buat Pekerjaan Produksi". null = jangan ubah pilihan lama. */
function parseProductionSelections(raw: unknown): ProductionSelection[] | null {
  if (!Array.isArray(raw)) return null;
  const byId = new Map<number, ProductionSelection>();
  for (const entry of raw.slice(0, 200)) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const id = Number(r.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const needsProduction = r.needsProduction === true;
    let prodDueDate: string | null = null;
    let prodDueTime: string | null = null;
    if (needsProduction) {
      prodDueDate = isoDateOrNull(r.prodDueDate, "Deadline item");
      const rawTime = typeof r.prodDueTime === "string" ? r.prodDueTime.trim() : "";
      if (rawTime && !prodDueDate) {
        throw new InvoiceError(400, "JAM_TANPA_TANGGAL", "Isi tanggal deadline item dulu sebelum jamnya.");
      }
      if (rawTime && !TIME_HHMM.test(rawTime)) {
        throw new InvoiceError(400, "JAM_TIDAK_VALID", "Jam deadline item tidak valid. Gunakan format 17:00.");
      }
      if (prodDueDate && prodDueDate < jakartaDateISO()) {
        throw new InvoiceError(400, "DEADLINE_ITEM_LEWAT", "Deadline item tidak boleh tanggal yang sudah lewat.");
      }
      prodDueTime = rawTime || null;
    }
    byId.set(id, { id, needsProduction, prodDueDate, prodDueTime });
  }
  return [...byId.values()];
}

/** Tombol "Buat Pekerjaan Produksi" untuk invoice terbit yang belum punya pekerjaan. 1 invoice = 1 pekerjaan. */
export async function createProductionForInvoice(
  id: number,
  rawDate: unknown,
  rawTime: unknown,
  actor: string,
  rawItems?: unknown,
) {
  await ensureItemProductionSchema();
  const deadline = parseDeadline(rawDate, rawTime);
  return db.transaction(async (tx) => {
    const locked = await lockInvoice(tx, id);
    if (locked.docType !== "invoice") throw new InvoiceError(409, "BUKAN_INVOICE", "Pekerjaan produksi hanya dibuat dari Invoice.");
    if (locked.status !== "terbit") throw new InvoiceError(409, "BELUM_TERBIT", "Terbitkan invoice dulu sebelum membuat pekerjaan produksi.");
    if (locked.orderId) throw new InvoiceError(409, "SUDAH_ADA_PEKERJAAN", "Invoice ini sudah punya pekerjaan produksi (1 invoice = 1 pekerjaan).");

    const selections = parseProductionSelections(rawItems);
    if (selections) {
      const existing = await tx
        .select({ id: invoiceItems.id })
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, id));
      const validIds = new Set(existing.map((row) => row.id));
      const byId = new Map(
        selections.filter((sel) => validIds.has(sel.id)).map((sel) => [sel.id, sel] as const),
      );
      // Daftar dari modal dianggap lengkap: item yang tidak dikirim = tidak ikut produksi.
      for (const row of existing) {
        const sel = byId.get(row.id);
        await tx
          .update(invoiceItems)
          .set({
            needsProduction: Boolean(sel?.needsProduction),
            prodDueDate: sel?.needsProduction ? sel.prodDueDate : null,
            prodDueTime: sel?.needsProduction ? sel.prodDueTime : null,
          })
          .where(and(eq(invoiceItems.id, row.id), eq(invoiceItems.invoiceId, id)));
      }
    }

    const selected = await tx
      .select({ id: invoiceItems.id })
      .from(invoiceItems)
      .where(and(eq(invoiceItems.invoiceId, id), eq(invoiceItems.needsProduction, true)))
      .limit(1);
    if (!selected.length) {
      throw new InvoiceError(
        400,
        "ITEM_PRODUKSI_KOSONG",
        "Centang minimal satu item yang perlu masuk antrian produksi.",
      );
    }

    await tx
      .update(invoices)
      .set({ needsProduction: true, prodDueDate: deadline.dueDate, prodDueTime: deadline.dueTime, updatedAt: new Date() })
      .where(eq(invoices.id, id));
    const orderId = await createOrderForInvoice(tx, id, actor);
    await syncOrderMirror(tx, id);
    return orderId;
  });
}

type ProductionAddition = {
  lineKey: string;
  prodDueDate: string | null;
  prodDueTime: string | null;
};

/** Pilihan item baru dari kartu "Tambah ke monitoring produksi". */
function parseProductionAdditions(raw: unknown): ProductionAddition[] {
  if (!Array.isArray(raw)) {
    throw new InvoiceError(400, "ITEM_TIDAK_VALID", "Pilih item yang akan ditambahkan ke produksi.");
  }
  const byKey = new Map<string, ProductionAddition>();
  for (const entry of raw.slice(0, 200)) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const lineKey = text(r.lineKey, 120);
    if (!lineKey) continue;
    const prodDueDate = isoDateOrNull(r.prodDueDate, "Deadline item");
    const rawTime = typeof r.prodDueTime === "string" ? r.prodDueTime.trim() : "";
    if (rawTime && !prodDueDate) {
      throw new InvoiceError(400, "JAM_TANPA_TANGGAL", "Isi tanggal deadline item dulu sebelum jamnya.");
    }
    if (rawTime && !TIME_HHMM.test(rawTime)) {
      throw new InvoiceError(400, "JAM_TIDAK_VALID", "Jam deadline item tidak valid. Gunakan format 17:00.");
    }
    if (prodDueDate && prodDueDate < jakartaDateISO()) {
      throw new InvoiceError(400, "DEADLINE_ITEM_LEWAT", "Deadline item tidak boleh tanggal yang sudah lewat.");
    }
    byKey.set(lineKey, { lineKey, prodDueDate, prodDueTime: rawTime || null });
  }
  if (!byKey.size) {
    throw new InvoiceError(400, "ITEM_TIDAK_VALID", "Pilih minimal satu item yang akan ditambahkan ke produksi.");
  }
  return [...byKey.values()];
}

/**
 * Tambah item invoice yang belum masuk ke pekerjaan produksi yang sudah ada.
 *
 * Dipakai saat invoice sudah terbit dan pekerjaannya sudah dibuat, lalu
 * pemilik menambah produk baru lewat revisi invoice. Item lama TIDAK diubah:
 * status, mitra, dan deadline-nya tetap. Hanya item baru yang disalin.
 */
export async function addInvoiceItemsToProduction(id: number, rawItems: unknown, actor: string) {
  await ensureItemProductionSchema();
  const additions = parseProductionAdditions(rawItems);

  return db.transaction(async (tx) => {
    const locked = await lockInvoice(tx, id);
    if (locked.docType !== "invoice") {
      throw new InvoiceError(409, "BUKAN_INVOICE", "Item produksi hanya bisa ditambahkan ke Invoice.");
    }
    if (locked.status !== "terbit") {
      throw new InvoiceError(409, "BELUM_TERBIT", "Terbitkan invoice dulu sebelum menambah item produksi.");
    }
    if (!locked.orderId) {
      throw new InvoiceError(409, "BELUM_ADA_PEKERJAAN", "Invoice ini belum punya pekerjaan produksi. Buat pekerjaan produksi dulu.");
    }

    // Kunci pekerjaan supaya dua penambahan bersamaan tidak berebut posisi.
    await tx.execute(sql`select id from orders where id = ${locked.orderId} for update`);
    const [order] = await tx.select().from(orders).where(eq(orders.id, locked.orderId)).limit(1);
    if (!order) throw new InvoiceError(404, "TIDAK_DITEMUKAN", "Pekerjaan produksi tidak ditemukan.");
    if (order.status === "selesai" || order.status === "batal" || order.status === "siap") {
      throw new InvoiceError(
        409,
        "PEKERJAAN_FINAL",
        "Pekerjaan produksi ini sudah siap, selesai, atau dibatalkan. Buat invoice / pekerjaan baru untuk tambahan produk.",
      );
    }

    const [invoiceRow] = await tx
      .select({ number: invoices.number, prodDueTime: invoices.prodDueTime })
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);
    const invoiceRows = await tx
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, id))
      .orderBy(asc(invoiceItems.position), asc(invoiceItems.id));
    const orderRows = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(asc(orderItems.position), asc(orderItems.id));

    const candidates = unmatchedInvoiceItems(invoiceRows, orderRows).filter((item) => item.needsProduction);
    const candidateByKey = new Map<string, (typeof candidates)[number]>();
    for (const item of candidates) {
      if (item.lineKey) candidateByKey.set(item.lineKey, item);
    }
    const requested: { addition: ProductionAddition; item: (typeof candidates)[number] }[] = [];
    for (const addition of additions) {
      const item = candidateByKey.get(addition.lineKey);
      if (item) requested.push({ addition, item });
    }

    // Bisa terjadi kalau tombol dikirim dua kali / item sudah ditambahkan di
    // perangkat lain. Anggap sukses supaya aman diulang.
    if (!requested.length) {
      return { orderId: order.id, added: 0, skipped: additions.length };
    }

    let nextPosition = orderRows.reduce((max, item) => Math.max(max, item.position), -1) + 1;
    let earliestDue = { dueDate: order.dueDate, dueTime: order.dueTime };
    const values = [];

    for (const { addition, item } of requested) {
      await tx
        .update(invoiceItems)
        .set({
          needsProduction: true,
          prodDueDate: addition.prodDueDate,
          prodDueTime: addition.prodDueTime,
        })
        .where(and(eq(invoiceItems.id, item.id), eq(invoiceItems.invoiceId, id)));

      values.push({
        orderId: order.id,
        productType: item.productName,
        quantity: Math.max(1, Math.round(item.qty)),
        unit: item.unit || "pcs",
        position: nextPosition,
        // null = ikut status pekerjaan. Operator bisa memecah status item
        // lewat popup update cepat kalau produk ini mulai dari awal.
        status: null,
        dueDate: addition.prodDueDate,
        dueTime: addition.prodDueTime,
        sourceLineKey: item.lineKey,
      });
      nextPosition += 1;

      if (addition.prodDueDate) {
        const dueTime = addition.prodDueTime ?? invoiceRow?.prodDueTime ?? order.dueTime;
        if (`${addition.prodDueDate}T${dueTime}` < `${earliestDue.dueDate}T${earliestDue.dueTime}`) {
          earliestDue = { dueDate: addition.prodDueDate, dueTime };
        }
      }
    }

    await tx.insert(orderItems).values(values);

    const allItems = [...orderRows, ...values];
    await tx
      .update(orders)
      .set({
        dueDate: earliestDue.dueDate,
        dueTime: earliestDue.dueTime,
        estHours: estimateHoursForItems(
          allItems.map((item) => ({
            productType: item.productType,
            quantity: item.quantity,
            unit: item.unit,
          })),
        ),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    const nama = requested
      .slice(0, 3)
      .map(({ item }) => item.productName)
      .join(", ");
    const note = `${requested.length} item baru dari invoice ${invoiceRow?.number ?? `#${id}`} ditambahkan ke produksi${nama ? `: ${nama}${requested.length > 3 ? ", …" : ""}` : ""}.`;
    await tx.insert(orderEvents).values({
      orderId: order.id,
      fromStatus: null,
      toStatus: order.status,
      note,
      actor,
    });
    await logEvent(tx, id, "produksi", actor, `${note} Pekerjaan: ${order.code}.`);
    // Harga & terbayar tetap cermin invoice (invoice mungkin baru direvisi).
    await syncOrderMirror(tx, id);

    return { orderId: order.id, added: values.length, skipped: additions.length - values.length };
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

  // Referensi yang sama sudah tercatat (di invoice ini atau invoice lain)? Bisa jadi satu
  // transaksi dicatat dua kali. Satu transfer memang boleh melunasi beberapa invoice, jadi
  // ini peringatan yang bisa dikonfirmasi, bukan penolakan mutlak. Pembayaran yang sudah
  // dibatalkan tidak dihitung.
  if (input.reference && !input.confirmDuplicateReference) {
    const dupRow = await tx.execute<{ number: string | null; invoice_id: number }>(
      sql`select i.number as number, p.invoice_id as invoice_id
          from payments p join invoices i on i.id = p.invoice_id
          where lower(p.reference) = lower(${input.reference}) and p.voided_at is null
          order by p.id limit 1`,
    );
    const dup = (dupRow.rows as { number: string | null; invoice_id: number }[])[0];
    if (dup) {
      const where = dup.invoice_id === invoiceId ? "di invoice ini" : `di ${dup.number ?? "dokumen lain"}`;
      throw new InvoiceError(
        409,
        "REFERENSI_KEMBAR",
        `No. referensi "${input.reference}" sudah tercatat ${where}. Konfirmasi dulu kalau memang sengaja (mis. satu transfer untuk beberapa invoice).`,
      );
    }
  }

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
      reference: input.reference,
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
      input.reference ? ` (ref ${input.reference})` : ""
    }${summary.status === "lunas" ? " — LUNAS" : ""}${overBy > 0 ? ` (lebih ${formatRupiah(overBy)}, dikonfirmasi)` : ""}.`,
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
  /** Hanya dokumen bertanggal persis di satu hari ("YYYY-MM-DD"). */
  tanggal?: string;
  /** Awal rentang tanggal dokumen ("YYYY-MM-DD"), inklusif. */
  dari?: string;
  /** Akhir rentang tanggal dokumen ("YYYY-MM-DD"), inklusif. */
  sampai?: string;
  /** "lewat" = Invoice terbit, belum lunas, jatuh tempo sudah lewat. */
  due?: string;
  /** Aktifkan pencocokan nominal/kode unik transfer saat q berisi angka. */
  uniqueCode?: boolean;
  limit?: number;
  offset?: number;
  /**
   * Lewati query ringkasan (openCount + outstanding) dan kembalikan
   * stats bernilai nol.
   *
   * Dipakai oleh pencarian di header. Tanpa ini, setiap ketikan di kotak
   * cari akan menyapu SELURUH tabel invoices untuk menghitung dua
   * angka yang memang tidak pernah ditampilkan di sana - hanya untuk
   * kartu ringkasan di halaman riwayat. Di Neon yang lewat internet,
   * itu satu bolak-balik penuh per ketikan, dan hasilnya dibuang.
   *
   * Stats yang nol tidak boleh dipakai untuk apa pun yang terlihat.
   * Jangan pakai ini di halaman yang menampilkan angka dari `stats`.
   * Halaman riwayat /invoice juga memakainya: kartu ringkasannya datang
   * dari getARSummary, dan `stats` tidak dibaca di sana (dulu hanya untuk
   * teks "N belum dibayar" yang menghitung seluruh tabel, bukan periode
   * yang sedang tampil).
   */
  tanpaStats?: boolean;
};

/**
 * Cocokkan Mutasi Bank: cari Invoice yang nominal transfernya (sisa + kode unik), totalnya,
 * kode uniknya, atau akhiran angkanya cocok dengan angka yang diketik.
 *
 * Aturan/details ada di bankMatch (src/lib/invoice-due.ts). Yang perlu
 * diketahui di sini: "akhiran" hanya berlaku kalau angka yang diketik
 * habis dibagi 3, jadi tidak pernah menyeberangi kelompok ribuan.
 * Dulu tidak begitu - "5000" ikut cocok dengan 75.000 dan 25.000.
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
    /* Rentang tanggal biasa, BUKAN to_char(issue_date, 'YYYY-MM'): fungsi di
       sisi kolom membuat index invoices_issue_date_idx tidak terpakai. */
    conditions.push(sql`${invoices.issueDate} >= ${`${filter.month}-01`}::date`);
    conditions.push(sql`${invoices.issueDate} <= ${monthEnd(filter.month)}::date`);
  }
  /* Satu hari. Sama seperti filter bulan, ini menyentuh issueDate
     (tanggal dokumen dibuat), bukan jatuh tempo.

     Ditulis sebagai rentang satu hari - ">= tanggal" sekaligus
     "<= tanggal yang sama" - supaya persis sama perlakuannya dengan
     penyaring dari/sampai di bawah, bukan pembanding "=" yang
     menggantung pada bagaimana kolom timestam-nya ditafsirkan. */
  if (filter.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(filter.tanggal)) {
    conditions.push(sql`${invoices.issueDate} >= ${filter.tanggal}::date`);
    conditions.push(sql`${invoices.issueDate} <= ${filter.tanggal}::date`);
  }
  /* Rentang tanggal dokumen. Sama seperti filter bulan, ini menyentuh
     issueDate (tanggal dokumen dibuat) - bukan jatuh tempo, karena
     jatuh tempo bisa kosong pada dokumen yang tidak punya termin.

     Dua-duanya inklusif, jadi "7 hari terakhir" ditulis dari =
     hariini - 6 sampai = hariini. */
  if (filter.dari && /^\d{4}-\d{2}-\d{2}$/.test(filter.dari)) {
    conditions.push(sql`${invoices.issueDate} >= ${filter.dari}::date`);
  }
  if (filter.sampai && /^\d{4}-\d{2}-\d{2}$/.test(filter.sampai)) {
    conditions.push(sql`${invoices.issueDate} <= ${filter.sampai}::date`);
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

  /* Ringkasan hanya dihitung kalau pemanggil memintanya. Pencarian di
     header lewat tanpaStats karena tidak menampilkan kartu ringkasan,
     dan query ini menyapu seluruh tabel invoices - mahal, dan hasilnya
     di sana tidak pernah dipakai. */
  if (filter.tanpaStats) {
    return { rows, stats: { openCount: 0, outstanding: 0 } };
  }

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
  await ensureItemProductionSchema();
  await ensurePaymentSchema();
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
  await ensureItemProductionSchema();
  await ensurePaymentSchema();
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
  await ensureItemProductionSchema();
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
  await ensureItemProductionSchema();
  return db.transaction((tx) => issueInTx(tx, id, actor));
}

export async function addPayment(invoiceId: number, input: PaymentInput, actor: string) {
  await ensurePaymentSchema();
  return db.transaction((tx) => addPaymentInTx(tx, invoiceId, input, actor));
}

/** Batalkan satu pembayaran (soft). Hanya Owner — dicek di route. */
export async function voidPayment(invoiceId: number, paymentId: number, reason: string, actor: string) {
  const why = reason.trim().slice(0, 300);
  if (!why) throw new InvoiceError(400, "ALASAN_KOSONG", "Alasan pembatalan wajib diisi.");
  await ensurePaymentSchema();
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

/** Salin isi dokumen jadi DRAFT baru. Pembayaran, nomor, dan tautan produksi tidak ikut tersalin.

    Jatuh tempo TIDAK ikut disalin dan tidak diisi otomatis. Dua alasan:
    menyalin tempo dokumen lama ke dokumen baru hampir selalu salah
    (tempo lama dihitung dari tanggal dokumen lama), dan mengisinya
    dengan "tanggal hari ini + N hari" berarti menerbitkan tagihan
    dengan tenggat yang tidak pernah dipilih orang. Jadi kosong dulu,
    dan yang mengisi tempo adalah orang yang membuat draft-nya. */
async function copyAsDraft(
  tx: Tx,
  src: SourceDoc,
  docType: DocType,
  actor: string,
  opts: { sourceId: number | null; label: string },
): Promise<number> {
  const today = jakartaDateISO();
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
      dueDate: null,
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
        // Dokumen baru = kunci baru; jangan memakai kunci invoice asal.
        lineKey: randomUUID(),
        productName: it.productName,
        description: it.description,
        unit: it.unit,
        qty: it.qty,
        areaM2: it.areaM2,
        basePrice: it.basePrice,
        tiers: it.tiers,
        unitPrice: it.unitPrice,
        amount: it.amount,
        needsProduction: it.needsProduction,
        // Deadline lama tidak ikut disalin: tanggalnya sudah lewat / milik dokumen lama.
        prodDueDate: null,
        prodDueTime: null,
      })),
    );
  }
  await logEvent(tx, created.id, "dibuat", actor, opts.label);
  return created.id;
}

/** "Jadikan Invoice": salin Estimasi / PO / Surat Jalan jadi draft Invoice baru. Satu dokumen hanya boleh sekali. */
export async function convertToInvoice(id: number, actor: string) {
  await ensureItemProductionSchema();
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
      sourceId: id,
      label: `Draft Invoice dibuat dari ${DOC_MODES[(isDocType(src.invoice.docType) ? src.invoice.docType : "invoice")].label} ${src.invoice.number ?? ""}.`.trim(),
    });
    await logEvent(tx, id, "dikonversi", actor, `Dijadikan Invoice (draft #${newId}).`);
    return newId;
  });
}

/** Duplikat: salinan draft dari dokumen mana pun (jenis sama). */
export async function duplicateInvoice(id: number, actor: string) {
  await ensureItemProductionSchema();
  return db.transaction(async (tx) => {
    const src = await loadSource(tx, id);
    const type: DocType = isDocType(src.invoice.docType) ? src.invoice.docType : "invoice";
    return copyAsDraft(tx, src, type, actor, {
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

/** Bahan isi awal form "Buat Invoice dari Pekerjaan Ini": pelanggan + item pekerjaan.
 *  Dulu TIGA query berurutan (order -> items -> telepon pelanggan); masing-masing satu
 *  bolak-balik ke database lewat internet. Sekarang DUA query paralel, dan telepon
 *  pelanggan ikut lewat LEFT JOIN di query order, jadi tidak ada langkah ketiga. */
export async function getOrderPrefill(orderId: number) {
  if (!Number.isInteger(orderId) || orderId <= 0) return null;
  const [[order], items] = await Promise.all([
    db
      .select({
        id: orders.id,
        code: orders.code,
        customerName: orders.customerName,
        customerId: orders.customerId,
        title: orders.title,
        phone: customers.phone,
      })
      .from(orders)
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .where(eq(orders.id, orderId))
      .limit(1),
    db
      .select({ productType: orderItems.productType, quantity: orderItems.quantity, unit: orderItems.unit })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.position), asc(orderItems.id)),
  ]);
  if (!order) return null;
  return { order, items, phone: order.phone ?? null };
}
