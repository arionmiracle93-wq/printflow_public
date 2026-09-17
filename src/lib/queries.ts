import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiNotes, customers, orderEvents, orderItems, orderPhotos, orders, settings } from "@/db/schema";
import { ACTIVE_STATUSES, estimateHoursForItems, orderCode, type StatusKey } from "@/lib/domain";
import { type OrderItem, type OrderItemInput } from "@/lib/order-items";
import type { AiOrder } from "@/lib/ai";

export type OrderFilter = {
  status?: string;
  scope?: "aktif" | "semua" | "selesai";
  q?: string;
  machine?: string;
  limit?: number;
};

const toAiOrder = (row: typeof orders.$inferSelect, items: OrderItem[]): AiOrder => ({
  id: row.id,
  code: row.code,
  customerName: row.customerName,
  title: row.title,
  items,
  machine: row.machine,
  operator: row.operator,
  status: row.status,
  priority: row.priority,
  price: row.price,
  paidAmount: row.paidAmount,
  dueDate: row.dueDate,
  dueTime: row.dueTime,
  estHours: row.estHours,
  notes: row.notes,
  createdAt: row.createdAt.toISOString(),
});

/**
 * Ambil item milik BANYAK pekerjaan sekaligus dalam satu query.
 *
 * Sengaja tidak memakai query per pekerjaan (N+1) karena halaman daftar &
 * dashboard bisa memuat ratusan pekerjaan — satu query per pekerjaan akan
 * menghabiskan slot koneksi Neon dan membuat halaman terasa berat.
 */
export async function itemsByOrderId(ids: number[]): Promise<Map<number, OrderItem[]>> {
  const map = new Map<number, OrderItem[]>();
  if (!ids.length) return map;
  const rows = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      productType: orderItems.productType,
      quantity: orderItems.quantity,
      unit: orderItems.unit,
    })
    .from(orderItems)
    .where(inArray(orderItems.orderId, ids))
    .orderBy(asc(orderItems.position), asc(orderItems.id));

  for (const row of rows) {
    const list = map.get(row.orderId) ?? [];
    list.push({ id: row.id, productType: row.productType, quantity: row.quantity, unit: row.unit });
    map.set(row.orderId, list);
  }
  return map;
}

/** Ambil item milik satu pekerjaan, sudah urut sesuai posisi. */
export async function listOrderItems(orderId: number): Promise<OrderItem[]> {
  const map = await itemsByOrderId([orderId]);
  return map.get(orderId) ?? [];
}

export async function listOrders(filter: OrderFilter = {}): Promise<AiOrder[]> {
  const where = [];
  if (filter.status && filter.status !== "all") {
    where.push(eq(orders.status, filter.status));
  } else if (filter.scope === "aktif") {
    where.push(inArray(orders.status, [...ACTIVE_STATUSES]));
  } else if (filter.scope === "selesai") {
    where.push(inArray(orders.status, ["selesai", "batal"]));
  }
  if (filter.machine && filter.machine !== "all") {
    where.push(eq(orders.machine, filter.machine));
  }
  if (filter.q) {
    const like = `%${filter.q.toLowerCase()}%`;
    // Pencarian ikut menjangkau nama produk di dalam pekerjaan, supaya
    // mengetik "stiker" tetap menemukan job yang judulnya "Order Pak Budi"
    // tapi isinya ada baris stiker.
    where.push(
      or(
        sql`lower(${orders.title}) like ${like}`,
        sql`lower(${orders.customerName}) like ${like}`,
        sql`lower(${orders.code}) like ${like}`,
        sql`exists (
          select 1 from order_items oi
          where oi.order_id = ${orders.id} and lower(oi.product_type) like ${like}
        )`,
      ),
    );
  }

  const rows = await db
    .select()
    .from(orders)
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(orders.dueDate), asc(orders.dueTime), desc(orders.id))
    .limit(filter.limit ?? 300);

  const itemMap = await itemsByOrderId(rows.map((r) => r.id));
  return rows.map((row) => toAiOrder(row, itemMap.get(row.id) ?? []));
}

export async function getOrderById(id: number) {
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!rows[0]) return null;
  return toAiOrder(rows[0], await listOrderItems(id));
}

/**
 * Ganti seluruh isi item sebuah pekerjaan dengan daftar baru.
 *
 * Pola "hapus semua lalu tulis ulang" dipilih karena jumlah barisnya sedikit
 * (maksimal 20) dan pengguna mengedit tabel item sebagai satu kesatuan —
 * jauh lebih sederhana dan tidak mungkin meninggalkan baris yatim
 * dibanding melacak baris mana yang ditambah/diubah/dihapus satu per satu.
 * Estimasi jam kerja pekerjaan ikut dihitung ulang agar analisa risiko AI
 * tetap nyambung dengan isi terbaru.
 */
export async function replaceOrderItems(orderId: number, items: OrderItemInput[]) {
  await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
  if (items.length) {
    await db.insert(orderItems).values(
      items.map((item, index) => ({
        orderId,
        productType: item.productType,
        quantity: item.quantity,
        unit: item.unit,
        position: index,
      })),
    );
  }
  await db
    .update(orders)
    .set({ estHours: estimateHoursForItems(items), updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  return listOrderItems(orderId);
}

export async function getOrderEvents(orderId: number) {
  return db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(desc(orderEvents.createdAt), desc(orderEvents.id));
}

export async function getAiNotes(orderId: number) {
  return db
    .select()
    .from(aiNotes)
    .where(eq(aiNotes.orderId, orderId))
    .orderBy(desc(aiNotes.createdAt))
    .limit(10);
}

export async function listCustomers() {
  return db.select().from(customers).orderBy(asc(customers.name));
}

export async function nextOrderCode(): Promise<string> {
  const result = await db.execute<{ count: string }>(sql`select count(*)::text as count from orders`);
  const rows = result.rows as { count: string }[];
  const count = Number.parseInt(rows[0]?.count ?? "0", 10);
  let candidate = orderCode(count + 1);
  let attempt = count + 1;
  // pastikan kode benar-benar unik
  for (let i = 0; i < 50; i += 1) {
    const exists = await db.select({ id: orders.id }).from(orders).where(eq(orders.code, candidate)).limit(1);
    if (!exists.length) return candidate;
    attempt += 1;
    candidate = orderCode(attempt);
  }
  return `PJ-${Date.now()}`;
}

export async function createOrder(payload: {
  customerName: string;
  customerId?: number | null;
  title: string;
  /** Daftar produk di dalam pekerjaan ini — boleh lebih dari satu baris. */
  items: OrderItemInput[];
  machine: string;
  operator?: string | null;
  priority: string;
  price: number;
  paidAmount: number;
  dueDate: string;
  dueTime: string;
  notes?: string | null;
  pic?: string | null;
}) {
  const code = await nextOrderCode();
  const [created] = await db
    .insert(orders)
    .values({
      code,
      customerId: payload.customerId ?? null,
      customerName: payload.customerName,
      title: payload.title,
      machine: payload.machine,
      operator: payload.operator ?? null,
      status: "antrian",
      priority: payload.priority,
      price: payload.price,
      paidAmount: payload.paidAmount,
      dueDate: payload.dueDate,
      dueTime: payload.dueTime,
      estHours: estimateHoursForItems(payload.items),
      notes: payload.notes ?? null,
      pic: payload.pic || "Owner",
    })
    .returning();

  if (payload.items.length) {
    await db.insert(orderItems).values(
      payload.items.map((item, index) => ({
        orderId: created.id,
        productType: item.productType,
        quantity: item.quantity,
        unit: item.unit,
        position: index,
      })),
    );
  }

  // Rincian produk ikut ditulis di catatan riwayat pertama supaya jejak
  // "pekerjaan ini awalnya berisi apa saja" tetap ada meski itemnya
  // kemudian diubah/dihapus.
  const rincian = payload.items
    .map((item) => `${item.productType} ${item.quantity} ${item.unit}`)
    .join(", ");
  await db.insert(orderEvents).values({
    orderId: created.id,
    fromStatus: null,
    toStatus: "antrian",
    note: rincian
      ? `Pekerjaan dibuat & masuk antrian. Isi: ${rincian}.`
      : "Pekerjaan dibuat & masuk antrian.",
    actor: payload.pic || "Owner",
  });

  return { ...created, items: await listOrderItems(created.id) };
}

export async function updateOrderStatus(
  id: number,
  toStatus: string,
  note: string | null,
  actor: string,
) {
  const current = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!current.length) return null;
  const from = current[0].status;
  await db
    .update(orders)
    .set({ status: toStatus, updatedAt: new Date() })
    .where(eq(orders.id, id));
  await db.insert(orderEvents).values({
    orderId: id,
    fromStatus: from,
    toStatus,
    note: note || null,
    actor: actor || "Owner",
  });
  return { from, to: toStatus };
}

export async function saveAiNote(input: {
  orderId: number | null;
  riskScore: number;
  riskLevel: string;
  message: string;
  source: string;
  kind?: string;
}) {
  await db.insert(aiNotes).values({
    orderId: input.orderId,
    kind: input.kind ?? "insight",
    riskScore: input.riskScore,
    riskLevel: input.riskLevel,
    message: input.message,
    source: input.source,
  });
}

/** Baca satu pengaturan ringan (null kalau belum ada / database bermasalah). */
export async function getSetting(key: string): Promise<string | null> {
  try {
    const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

/** Baca semua pengaturan ringan sebagai peta key → value. */
export async function getSettingsMap(): Promise<Record<string, string>> {
  try {
    const rows = await db.select().from(settings);
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;
    return map;
  } catch {
    return {};
  }
}

import { MAX_PHOTOS_PER_ORDER, PHOTO_KINDS, type PhotoItem } from "@/lib/photos";

export { MAX_PHOTOS_PER_ORDER, PHOTO_KINDS, photoKindLabel } from "@/lib/photos";
export type { PhotoItem as PhotoMeta } from "@/lib/photos";

export async function listPhotos(orderId: number): Promise<PhotoItem[]> {
  const rows = await db
    .select({
      id: orderPhotos.id,
      orderId: orderPhotos.orderId,
      kind: orderPhotos.kind,
      mime: orderPhotos.mime,
      sizeBytes: orderPhotos.sizeBytes,
      caption: orderPhotos.caption,
      createdAt: orderPhotos.createdAt,
    })
    .from(orderPhotos)
    .where(eq(orderPhotos.orderId, orderId))
    .orderBy(asc(orderPhotos.id));

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    url: `/api/photos/${row.id}`,
  }));
}

export async function insertPhoto(input: {
  orderId: number;
  kind: string;
  mime: string;
  sizeBytes: number;
  caption: string | null;
  data: Buffer;
  uploadedBy?: string | null;
}): Promise<PhotoItem> {
  const [row] = await db
    .insert(orderPhotos)
    .values({
      orderId: input.orderId,
      kind: input.kind,
      mime: input.mime,
      sizeBytes: input.sizeBytes,
      caption: input.caption,
      uploadedBy: input.uploadedBy ?? null,
      data: input.data,
    })
    .returning({ id: orderPhotos.id, createdAt: orderPhotos.createdAt });

  const created: PhotoItem = {
    id: row.id,
    kind: input.kind,
    caption: input.caption,
    sizeBytes: input.sizeBytes,
    createdAt: row.createdAt.toISOString(),
    url: `/api/photos/${row.id}`,
  };
  return created;
}

export async function getPhotoBlob(
  photoId: number,
): Promise<{ data: Buffer; mime: string } | null> {
  const rows = await db
    .select({ data: orderPhotos.data, mime: orderPhotos.mime })
    .from(orderPhotos)
    .where(eq(orderPhotos.id, photoId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { data: Buffer.from(row.data), mime: row.mime };
}

export async function deletePhoto(photoId: number, orderId: number): Promise<boolean> {
  const removed = await db
    .delete(orderPhotos)
    .where(and(eq(orderPhotos.id, photoId), eq(orderPhotos.orderId, orderId)))
    .returning({ id: orderPhotos.id });
  return removed.length > 0;
}

export async function countPhotos(orderId: number): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`cast(count(*) as int)` })
    .from(orderPhotos)
    .where(eq(orderPhotos.orderId, orderId));
  return Number(row?.total ?? 0);
}

/** Jumlah foto per pekerjaan untuk banyak pekerjaan sekaligus (dipakai daftar pekerjaan). */
export async function photoCounts(ids: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (!ids.length) return map;
  const rows = await db
    .select({ orderId: orderPhotos.orderId, total: sql<number>`cast(count(*) as int)` })
    .from(orderPhotos)
    .where(inArray(orderPhotos.orderId, ids))
    .groupBy(orderPhotos.orderId);
  for (const row of rows) map.set(row.orderId, Number(row.total));
  return map;
}

/* ============================================================
   FITUR LACAK PELANGGAN (/lacak/TOKEN)
   ============================================================ */

const SHARE_ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

function randomToken(length = 22): string {
  let out = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i += 1) out += SHARE_ALPHABET[bytes[i] % SHARE_ALPHABET.length];
  return out;
}

/** Ambil token lacak milik pekerjaan; buat baru bila belum ada (idempoten). */
export async function ensureShareToken(orderId: number): Promise<string | null> {
  const rows = await db
    .select({ token: orders.shareToken })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  const existing = rows[0]?.token;
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = randomToken();
    const updated = await db
      .update(orders)
      .set({ shareToken: token, updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), isNull(orders.shareToken)))
      .returning({ token: orders.shareToken });
    if (updated[0]?.token) return updated[0].token;
  }
  const again = await db
    .select({ token: orders.shareToken })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return again[0]?.token ?? null;
}

export type PublicTracking = {
  code: string;
  title: string;
  customerName: string;
  status: string;
  priority: string;
  /** Rincian produk yang dipesan — ditampilkan apa adanya ke pelanggan. */
  items: OrderItem[];
  dueDate: string;
  dueTime: string;
  notes: string | null;
  createdAt: string;
  timeline: { toStatus: string; note: string | null; createdAt: string }[];
  photos: PhotoItem[];
};

/** Baca data pekerjaan berdasarkan token lacak. Token salah = null (tidak dibocorkan). */
export async function getPublicTracking(token: string): Promise<PublicTracking | null> {
  const rows = await db.select().from(orders).where(eq(orders.shareToken, token)).limit(1);
  const order = rows[0];
  if (!order) return null;

  const [events, photos, items] = await Promise.all([
    getOrderEvents(order.id),
    db
      .select({
        id: orderPhotos.id,
        kind: orderPhotos.kind,
        caption: orderPhotos.caption,
        sizeBytes: orderPhotos.sizeBytes,
        createdAt: orderPhotos.createdAt,
      })
      .from(orderPhotos)
      .where(and(eq(orderPhotos.orderId, order.id), inArray(orderPhotos.kind, ["hasil", "referensi"])))
      .orderBy(asc(orderPhotos.id)),
    listOrderItems(order.id),
  ]);

  return {
    code: order.code,
    title: order.title,
    customerName: order.customerName,
    status: order.status,
    priority: order.priority,
    items,
    dueDate: order.dueDate,
    dueTime: order.dueTime,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    timeline: events
      // Detail vendor/percetakan pusat adalah informasi internal dan tidak ditampilkan ke pelanggan.
      .filter(
        (e) =>
          !e.toStatus.startsWith("mitra:") &&
          !e.fromStatus?.startsWith("mitra:") &&
          !e.toStatus.startsWith("shift:") &&
          !e.fromStatus?.startsWith("shift:"),
      )
      .map((e) => ({
        toStatus: e.toStatus,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
    photos: photos.map((p) => ({
      id: p.id,
      kind: p.kind,
      caption: p.caption,
      sizeBytes: p.sizeBytes,
      createdAt: p.createdAt.toISOString(),
      url: `/api/photos/${p.id}`,
    })),
  };
}

/** Total penyimpanan yang dipakai foto (untuk halaman pengaturan). */
export async function photoStorageUsage(): Promise<{ files: number; bytes: number }> {
  const [row] = await db
    .select({
      files: sql<number>`cast(count(*) as int)`,
      bytes: sql<number>`cast(coalesce(sum(size_bytes),0) as bigint)`,
    })
    .from(orderPhotos);
  return { files: Number(row?.files ?? 0), bytes: Number(row?.bytes ?? 0) };
}

export async function statusCounts() {
  const rows = await db
    .select({ status: orders.status, count: sql<number>`count(*)::int` })
    .from(orders)
    .groupBy(orders.status);
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.status, Number(row.count));
  return map;
}

export function statusLabelOf(key: string) {
  return key;
}

export type { StatusKey };
