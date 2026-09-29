import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderEvents, orderItems, orders, outsourceJobs, productionPartners } from "@/db/schema";
import { outsourceStatusMeta, OUTSOURCE_STATUSES } from "@/lib/outsource";

export type OutsourceRecord = {
  id: number;
  orderId: number;
  partnerId: number | null;
  partnerName: string;
  partnerKind: string | null;
  partnerPhone: string | null;
  status: string;
  vendorCost: number;
  sentAt: string | null;
  expectedDate: string;
  expectedTime: string;
  receivedAt: string | null;
  qcResult: string | null;
  notes: string | null;
  updatedAt: string;
  /**
   * Produk yang dikerjakan mitra ini. Kosong = seluruh pekerjaan
   * (arti lama, sebelum ada multi mitra).
   */
  itemIds: number[];
};

export async function listPartners() {
  return db.select().from(productionPartners).orderBy(desc(productionPartners.active), asc(productionPartners.name));
}

export async function createPartner(input: { name: string; kind: string; phone?: string; address?: string; notes?: string }) {
  const [row] = await db.insert(productionPartners).values({
    name: input.name,
    kind: input.kind,
    phone: input.phone || null,
    address: input.address || null,
    notes: input.notes || null,
  }).returning();
  return row;
}

const JOB_COLUMNS = {
  id: outsourceJobs.id,
  orderId: outsourceJobs.orderId,
  partnerId: outsourceJobs.partnerId,
  partnerName: outsourceJobs.partnerName,
  partnerKind: productionPartners.kind,
  partnerPhone: productionPartners.phone,
  status: outsourceJobs.status,
  vendorCost: outsourceJobs.vendorCost,
  sentAt: outsourceJobs.sentAt,
  expectedDate: outsourceJobs.expectedDate,
  expectedTime: outsourceJobs.expectedTime,
  receivedAt: outsourceJobs.receivedAt,
  qcResult: outsourceJobs.qcResult,
  notes: outsourceJobs.notes,
  updatedAt: outsourceJobs.updatedAt,
};

type JobRow = {
  sentAt: Date | null;
  receivedAt: Date | null;
  updatedAt: Date;
};

function serialize<T extends JobRow>(r: T) {
  return {
    ...r,
    sentAt: r.sentAt?.toISOString() ?? null,
    receivedAt: r.receivedAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
  };
}

async function itemIdsByJob(jobIds: number[]) {
  const map = new Map<number, number[]>();
  if (!jobIds.length) return map;
  const rows = await db
    .select({ id: orderItems.id, jobId: orderItems.outsourceJobId })
    .from(orderItems)
    .where(inArray(orderItems.outsourceJobId, jobIds))
    .orderBy(asc(orderItems.position), asc(orderItems.id));
  for (const r of rows) {
    if (r.jobId == null) continue;
    map.set(r.jobId, [...(map.get(r.jobId) ?? []), r.id]);
  }
  return map;
}

/** Semua mitra yang menangani satu pekerjaan, urut dari yang pertama dibuat. */
export async function listOutsource(orderId: number): Promise<OutsourceRecord[]> {
  const rows = await db
    .select(JOB_COLUMNS)
    .from(outsourceJobs)
    .leftJoin(productionPartners, eq(outsourceJobs.partnerId, productionPartners.id))
    .where(eq(outsourceJobs.orderId, orderId))
    .orderBy(asc(outsourceJobs.id));
  const links = await itemIdsByJob(rows.map((r) => r.id));
  return rows.map((r) => ({ ...serialize(r), itemIds: links.get(r.id) ?? [] }));
}

/** Dipertahankan untuk kode lama: mitra pertama sebuah pekerjaan. */
export async function getOutsource(orderId: number): Promise<OutsourceRecord | null> {
  return (await listOutsource(orderId))[0] ?? null;
}

/**
 * Tambah atau perbarui satu mitra.
 * - Tanpa `id`: menambah mitra baru ke pekerjaan ini.
 * - Dengan `id`: memperbarui mitra tersebut.
 * - `itemIds`: produk yang dikerjakan mitra ini. Satu produk hanya bisa
 *   di satu mitra, jadi produk yang dipilih otomatis dilepas dari mitra lain.
 */
export async function saveOutsource(input: {
  id?: number | null;
  orderId: number;
  partnerId?: number | null;
  partnerName: string;
  status: string;
  vendorCost: number;
  expectedDate: string;
  expectedTime: string;
  notes?: string | null;
  qcResult?: string | null;
  itemIds?: number[];
  actor?: string;
}) {
  const current = input.id ? (await listOutsource(input.orderId)).find((j) => j.id === input.id) ?? null : null;
  if (input.id && !current) return null;
  const now = new Date();
  const sentAt = ["dikirim", "proses", "siap_diambil", "diterima", "revisi"].includes(input.status)
    ? current?.sentAt ? new Date(current.sentAt) : now
    : null;
  const receivedAt = input.status === "diterima" ? (current?.receivedAt ? new Date(current.receivedAt) : now) : null;
  const values = {
    partnerId: input.partnerId ?? null,
    partnerName: input.partnerName,
    status: input.status,
    vendorCost: input.vendorCost,
    expectedDate: input.expectedDate,
    expectedTime: input.expectedTime,
    sentAt,
    receivedAt,
    qcResult: input.qcResult || null,
    notes: input.notes || null,
    updatedAt: now,
  };

  const [row] = current
    ? await db.update(outsourceJobs).set(values).where(eq(outsourceJobs.id, current.id)).returning()
    : await db.insert(outsourceJobs).values({ orderId: input.orderId, ...values }).returning();

  if (input.itemIds) {
    await db.update(orderItems).set({ outsourceJobId: null }).where(eq(orderItems.outsourceJobId, row.id));
    if (input.itemIds.length) {
      await db
        .update(orderItems)
        .set({ outsourceJobId: row.id })
        .where(and(eq(orderItems.orderId, input.orderId), inArray(orderItems.id, input.itemIds)));
    }
  }

  if (!current || current.status !== input.status) {
    await db.insert(orderEvents).values({
      orderId: input.orderId,
      fromStatus: current ? `mitra:${current.status}` : null,
      toStatus: `mitra:${input.status}`,
      note: `Produksi luar - ${input.partnerName}: ${outsourceStatusMeta(input.status).label}${input.notes ? `. ${input.notes}` : ""}`,
      actor: input.actor || "Owner",
    });
  }
  return { ...row, previousStatus: current?.status ?? null };
}

/** Kompatibilitas kode lama: perbarui mitra pertama, atau buat kalau belum ada. */
export async function upsertOutsource(input: Omit<Parameters<typeof saveOutsource>[0], "id">) {
  const first = await getOutsource(input.orderId);
  return saveOutsource({ ...input, id: first?.id ?? null });
}

/** Hapus satu mitra (jobId), atau semua mitra pekerjaan ini kalau jobId kosong. */
export async function deleteOutsource(orderId: number, jobId?: number) {
  const where = jobId
    ? and(eq(outsourceJobs.orderId, orderId), eq(outsourceJobs.id, jobId))
    : eq(outsourceJobs.orderId, orderId);
  return db.delete(outsourceJobs).where(where);
}

export type OutsourceOverview = OutsourceRecord & {
  orderCode: string;
  orderTitle: string;
  customerName: string;
  orderPrice: number;
  customerDueDate: string;
  customerDueTime: string;
};

export async function listOutsourceOverview(): Promise<OutsourceOverview[]> {
  const rows = await db
    .select({
      id: outsourceJobs.id,
      orderId: outsourceJobs.orderId,
      partnerId: outsourceJobs.partnerId,
      partnerName: outsourceJobs.partnerName,
      partnerKind: productionPartners.kind,
      partnerPhone: productionPartners.phone,
      status: outsourceJobs.status,
      vendorCost: outsourceJobs.vendorCost,
      sentAt: outsourceJobs.sentAt,
      expectedDate: outsourceJobs.expectedDate,
      expectedTime: outsourceJobs.expectedTime,
      receivedAt: outsourceJobs.receivedAt,
      qcResult: outsourceJobs.qcResult,
      notes: outsourceJobs.notes,
      updatedAt: outsourceJobs.updatedAt,
      orderCode: orders.code,
      orderTitle: orders.title,
      customerName: orders.customerName,
      orderPrice: orders.price,
      customerDueDate: orders.dueDate,
      customerDueTime: orders.dueTime,
    })
    .from(outsourceJobs)
    .innerJoin(orders, eq(outsourceJobs.orderId, orders.id))
    .leftJoin(productionPartners, eq(outsourceJobs.partnerId, productionPartners.id))
    .orderBy(asc(outsourceJobs.expectedDate), asc(outsourceJobs.expectedTime));
  const links = await itemIdsByJob(rows.map((r) => r.id));
  return rows.map((r) => ({ ...serialize(r), itemIds: links.get(r.id) ?? [] }));
}

/**
 * Ringkasan mitra per pekerjaan untuk kartu dashboard dan daftar.
 * Bentuknya tetap { status, partnerName } seperti dulu, jadi semua
 * pemakai lama tidak perlu diubah. Kalau ada beberapa mitra:
 *   - partnerName digabung, contoh "Sansina & Minang"
 *   - status = mitra yang paling tertinggal (paling perlu dipantau)
 */
export async function outsourceCounts(orderIds: number[]) {
  const map = new Map<number, { status: string; partnerName: string; count: number }>();
  if (!orderIds.length) return map;
  const rows = await db
    .select({ orderId: outsourceJobs.orderId, status: outsourceJobs.status, partnerName: outsourceJobs.partnerName })
    .from(outsourceJobs)
    .where(inArray(outsourceJobs.orderId, orderIds))
    .orderBy(asc(outsourceJobs.id));
  const rank = (status: string) => {
    if (status === "revisi") return -1;
    const i = OUTSOURCE_STATUSES.findIndex((s) => s.key === status);
    return i === -1 ? 0 : i;
  };
  for (const r of rows) {
    const prev = map.get(r.orderId);
    if (!prev) {
      map.set(r.orderId, { status: r.status, partnerName: r.partnerName, count: 1 });
      continue;
    }
    map.set(r.orderId, {
      status: rank(r.status) < rank(prev.status) ? r.status : prev.status,
      partnerName: prev.partnerName.split(" & ").includes(r.partnerName) ? prev.partnerName : `${prev.partnerName} & ${r.partnerName}`,
      count: prev.count + 1,
    });
  }
  return map;
}
