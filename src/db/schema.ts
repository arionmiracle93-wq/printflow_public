import {
  boolean,
  customType,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Kolom biner (bytea) untuk menyimpan isi file gambar langsung di database.
 * Dipilih supaya pemilik percetakan tidak perlu mendaftar layanan storage lain.
 */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * PELANGGAN
 * Data pemesan jasa cetak (toko, kantor, instansi, perorangan).
 */
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * PEKERJAAN / ORDER CETAK
 * Satu baris = satu pekerjaan cetak yang dipantau statusnya.
 * Detail produk (jenis + jumlah + satuan) TIDAK lagi disimpan di sini —
 * satu pekerjaan bisa berisi banyak produk, lihat tabel `orderItems`.
 */
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id, {
    onDelete: "set null",
  }),
  customerName: text("customer_name").notNull(),
  title: text("title").notNull(),
  machine: text("machine").notNull().default("Digital Print"),
  operator: text("operator"),
  status: text("status").notNull().default("antrian"),
  priority: text("priority").notNull().default("normal"),
  price: integer("price").notNull().default(0),
  paidAmount: integer("paid_amount").notNull().default(0),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  dueTime: text("due_time").notNull().default("17:00"),
  estHours: integer("est_hours").notNull().default(4),
  notes: text("notes"),
  pic: text("pic").notNull().default("Owner"),
  /**
   * Kode rahasia untuk halaman lacak pelanggan (/lacak/TOKEN).
   * Null = belum pernah dibagikan. Dibuat otomatis saat pertama kali dibagikan.
   */
  shareToken: text("share_token").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * ITEM PEKERJAAN
 * Rincian produk di dalam satu pekerjaan. Satu pekerjaan (order) bisa
 * punya banyak baris item — masing-masing jenis produk, jumlah, dan
 * satuannya sendiri — tapi tetap satu status/mesin/operator/deadline
 * untuk keseluruhan pekerjaan (dicatat di tabel `orders`).
 * Contoh: pekerjaan "Order Pak Budi" bisa berisi baris
 * "Spanduk · 2 · pcs" + "Stiker · 500 · lembar" + "Kartu Nama · 1 · box".
 */
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productType: text("product_type").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unit: text("unit").notNull().default("pcs"),
  /** Urutan tampil baris item di dalam satu pekerjaan. */
  position: integer("position").notNull().default(0),
  /**
   * Status produk ini sendiri. null = ikut status pekerjaan (bawaan).
   * Lihat src/lib/item-status.ts untuk aturan penghitungannya.
   */
  status: text("status"),
  /** Mitra yang mengerjakan produk ini. null = dikerjakan sendiri. */
  outsourceJobId: integer("outsource_job_id").references(() => outsourceJobs.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * RIWAYAT STATUS
 * Setiap perubahan status dicatat supaya bisa dilihat jejak produksinya.
 */
export const orderEvents = pgTable("order_events", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  note: text("note"),
  actor: text("actor").notNull().default("Owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * CATATAN AI
 * Hasil analisa AI per pekerjaan disimpan supaya riwayat rekomendasi bisa dibaca ulang.
 */
export const aiNotes = pgTable("ai_notes", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("insight"),
  riskScore: integer("risk_score").notNull().default(0),
  riskLevel: text("risk_level").notNull().default("aman"),
  message: text("message").notNull(),
  source: text("source").notNull().default("engine"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * PENGATURAN SEDERHANA (key-value)
 * Dipakai untuk menyimpan pengingat/konfigurasi ringan.
 */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * LAMPIRAN FOTO PEKERJAAN
 * Menyimpan foto desain/referensi, hasil jadi, atau nota supaya pekerjaan
 * yang namanya mirip mudah dibedakan hanya dengan melihat gambarnya.
 */
export const orderPhotos = pgTable("order_photos", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("referensi"),
  mime: text("mime").notNull().default("image/jpeg"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  caption: text("caption"),
  uploadedBy: text("uploaded_by"),
  /**
   * Isi foto. Terisi untuk foto lama / saat Vercel Blob belum dipasang.
   * null kalau fotonya sudah disimpan di Vercel Blob (lihat blobUrl).
   */
  data: bytea("data"),
  /** Alamat file di Vercel Blob (private). null = foto masih di database. */
  blobUrl: text("blob_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * MITRA PRODUKSI
 * Percetakan lain / pusat yang menerima pekerjaan lemparan.
 */
export const productionPartners = pgTable("production_partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("vendor"),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * PEKERJAAN PRODUKSI LUAR
 * Detail penyerahan satu order ke vendor / percetakan pusat.
 */
export const outsourceJobs = pgTable("outsource_jobs", {
  id: serial("id").primaryKey(),
  // Tidak lagi unique: satu pekerjaan boleh dilempar ke beberapa mitra,
  // masing-masing mengerjakan produk yang berbeda (order_items.outsource_job_id).
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  partnerId: integer("partner_id").references(() => productionPartners.id, { onDelete: "set null" }),
  partnerName: text("partner_name").notNull(),
  status: text("status").notNull().default("belum_dikirim"),
  vendorCost: integer("vendor_cost").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  expectedDate: date("expected_date", { mode: "string" }).notNull(),
  expectedTime: text("expected_time").notNull().default("12:00"),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  qcResult: text("qc_result"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * PENGGUNA INTERNAL
 * Akun Owner dan Karyawan dengan password yang sudah di-hash.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("karyawan"),
  active: boolean("active").notNull().default(true),
  /**
   * Izin membuka modul Invoice (melihat harga & mencatat pembayaran).
   * Owner SELALU boleh, kolom ini hanya berlaku untuk akun Karyawan.
   * Bawaan false: operator produksi tidak otomatis melihat harga.
   */
  canInvoice: boolean("can_invoice").notNull().default(false),
  tokenVersion: integer("token_version").notNull().default(1),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loginAudit = pgTable("login_audit", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  success: boolean("success").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * SESI PERANGKAT
 * Satu baris = satu kali login dari satu perangkat/browser. Dipakai untuk
 * fitur "lihat perangkat aktif & logout perangkat tertentu" milik owner.
 */
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

/**
 * SUBSCRIPTION PUSH PERANGKAT
 * Endpoint browser/PWA Android untuk menerima notifikasi sistem.
 */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  deviceName: text("device_name"),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  operatorName: text("operator_name"),
  userRole: text("user_role"),
  userAgent: text("user_agent"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * SERAH TERIMA SHIFT
 * Mencatat perpindahan tanggung jawab pekerjaan antar operator.
 */
export const shiftHandovers = pgTable("shift_handovers", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  fromOperator: text("from_operator").notNull(),
  toOperator: text("to_operator").notNull(),
  toUserId: integer("to_user_id").references(() => users.id, { onDelete: "set null" }),
  shiftLabel: text("shift_label"),
  lastPosition: text("last_position").notNull(),
  blocker: text("blocker"),
  nextAction: text("next_action").notNull(),
  note: text("note"),
  status: text("status").notNull().default("menunggu"),
  handedOverAt: timestamp("handed_over_at", { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedBy: text("accepted_by"),
});

/**
 * BRANDING USAHA
 * Satu baris aktif untuk logo yang tampil di header aplikasi.
 */
export const businessBranding = pgTable("business_branding", {
  id: integer("id").primaryKey().default(1),
  mime: text("mime").notNull().default("image/png"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  data: bytea("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * ===================== MODUL INVOICE =====================
 * Invoice = acuan UANG (total, DP, cicilan, lunas).
 * Pesanan (`orders`) = acuan PRODUKSI. Keduanya nyambung lewat
 * `invoices.orderId`, tapi invoice TIDAK wajib punya pesanan.
 * Semua nominal rupiah disimpan sebagai integer (sama seperti orders.price).
 */

/** Konfigurasi harga bertingkat per baris item (lihat src/lib/invoice-pricing.ts). */
export type InvoiceTierConfig = {
  mode: "flat" | "graduated";
  basis: "qty" | "m2";
  list: { min: number; price: number }[];
};

/**
 * PENOMORAN INVOICE
 * Satu baris per hari (WIB), format kunci YYYYMMDD. Nomor urut diambil
 * secara atomik lewat INSERT ... ON CONFLICT DO UPDATE ... RETURNING,
 * jadi dua kasir yang menerbitkan invoice bersamaan tidak akan dapat nomor kembar.
 */
export const invoiceCounters = pgTable("invoice_counters", {
  periodKey: text("period_key").primaryKey(),
  lastSeq: integer("last_seq").notNull().default(0),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  /** Kosong selama masih draft. Nomor resmi baru dibuat saat "Terbitkan". */
  number: text("number").unique(),
  /** Jenis dokumen: invoice | estimasi | suratjalan | po. Hanya "invoice" yang punya pembayaran & masuk omzet. */
  docType: text("doc_type").notNull().default("invoice"),
  /** draft | terbit | batal */
  status: text("status").notNull().default("draft"),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  /** Salinan nama/HP pelanggan saat invoice dibuat, supaya invoice lama tidak berubah kalau data pelanggan diedit. */
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  issueDate: date("issue_date", { mode: "string" }).notNull(),
  dueDate: date("due_date", { mode: "string" }),
  /** Transfer | Cash | QRIS */
  payMethod: text("pay_method").notNull().default("Transfer"),
  subtotal: integer("subtotal").notNull().default(0),
  /** Tipe diskon: persen (0-100) atau rp (nominal, dibatasi maksimal subtotal). */
  discountType: text("discount_type").notNull().default("persen"),
  /** Isian mentah kasir: persen atau rupiah, sesuai discountType. */
  discountInput: numeric("discount_input", { precision: 14, scale: 3, mode: "number" }).notNull().default(0),
  /** Persentase diskon (0 bila tipe rp). Dipertahankan agar data lama tetap terbaca. */
  discountRate: numeric("discount_rate", { precision: 6, scale: 3, mode: "number" }).notNull().default(0),
  discountAmount: integer("discount_amount").notNull().default(0),
  taxRate: numeric("tax_rate", { precision: 6, scale: 3, mode: "number" }).notNull().default(0),
  taxAmount: integer("tax_amount").notNull().default(0),
  total: integer("total").notNull().default(0),
  /** Cache: jumlah pembayaran yang tidak dibatalkan. Selalu dihitung ulang oleh server. */
  paidAmount: integer("paid_amount").notNull().default(0),
  /** belum | sebagian | lunas — cache, dihitung ulang oleh server. */
  payStatus: text("pay_status").notNull().default("belum"),
  notes: text("notes"),
  terms: jsonb("terms").$type<string[]>().notNull().default([]),
  /**
   * Perlu monitoring produksi? Bila true, saat invoice DITERBITKAN otomatis dibuatkan
   * pekerjaan produksi (status Antrian) dengan deadline di bawah ini. Idempoten: 1 invoice = 1 pekerjaan.
   */
  needsProduction: boolean("needs_production").notNull().default(false),
  prodDueDate: date("prod_due_date", { mode: "string" }),
  prodDueTime: text("prod_due_time"),
  /** Dokumen asal bila ini hasil "Jadikan Invoice" dari Estimasi/PO/SJ. */
  sourceId: integer("source_id"),
  /** Pekerjaan produksi yang tertaut. Unik bila terisi: 1 invoice = 1 pekerjaan. */
  orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
  /** Kode unik dari perangkat agar pembuatan invoice yang terkirim dua kali tidak jadi dobel. */
  clientRef: text("client_ref").unique(),
  /** Naik 1 setiap isi invoice diedit. Dipakai untuk mendeteksi edit bersamaan. */
  version: integer("version").notNull().default(1),
  voidReason: text("void_reason"),
  createdBy: text("created_by").notNull().default("Owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
});

export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  productName: text("product_name").notNull(),
  description: text("description"),
  unit: text("unit").notNull().default("pcs"),
  qty: numeric("qty", { precision: 14, scale: 3, mode: "number" }).notNull().default(1),
  /** Luas per unit (m²). 0 = bukan produk berbasis luas. */
  areaM2: numeric("area_m2", { precision: 14, scale: 4, mode: "number" }).notNull().default(0),
  basePrice: integer("base_price").notNull().default(0),
  tiers: jsonb("tiers").$type<InvoiceTierConfig>(),
  /** Hasil hitung server, disimpan sebagai arsip. */
  unitPrice: numeric("unit_price", { precision: 14, scale: 2, mode: "number" }).notNull().default(0),
  amount: integer("amount").notNull().default(0),
});

/**
 * PEMBAYARAN
 * Catatan hanya ditambah (append-only). Salah input dikoreksi dengan
 * "membatalkan" (voidedAt terisi), bukan dihapus — jejak uang tetap utuh.
 */
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  /** dp | bayar */
  kind: text("kind").notNull().default("bayar"),
  amount: integer("amount").notNull(),
  method: text("method").notNull().default("Transfer"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  note: text("note"),
  /** Kode unik dari perangkat (anti-dobel saat pembayaran dikirim ulang / dari antrean offline). */
  clientRef: text("client_ref").unique(),
  createdBy: text("created_by").notNull().default("Owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidedBy: text("voided_by"),
  voidReason: text("void_reason"),
});

/** JEJAK AKTIVITAS INVOICE (dibuat, diedit, terbit, bayar, batal, ...). */
export const invoiceEvents = pgTable("invoice_events", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  actor: text("actor").notNull().default("Owner"),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItemRow = typeof invoiceItems.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type InvoiceEventRow = typeof invoiceEvents.$inferSelect;

export type Customer = typeof customers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type AiNote = typeof aiNotes.$inferSelect;
export type OrderPhoto = typeof orderPhotos.$inferSelect;
