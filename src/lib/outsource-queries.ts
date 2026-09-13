import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderEvents, orders, outsourceJobs, productionPartners } from "@/db/schema";

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

export async function getOutsource(orderId: number): Promise<OutsourceRecord | null> {
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
    })
    .from(outsourceJobs)
    .leftJoin(productionPartners, eq(outsourceJobs.partnerId, productionPartners.id))
    .where(eq(outsourceJobs.orderId, orderId))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    ...r,
    sentAt: r.sentAt?.toISOString() ?? null,
    receivedAt: r.receivedAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function upsertOutsource(input: {
  orderId: number;
  partnerId?: number | null;
  partnerName: string;
  status: string;
  vendorCost: number;
  expectedDate: string;
  expectedTime: string;
  notes?: string | null;
  qcResult?: string | null;
  actor?: string;
}) {
  const current = await getOutsource(input.orderId);
  const now = new Date();
  const sentAt = ["dikirim", "proses", "siap_diambil", "diterima", "revisi"].includes(input.status)
    ? current?.sentAt ? new Date(current.sentAt) : now
    : null;
  const receivedAt = input.status === "diterima" ? current?.receivedAt ? new Date(current.receivedAt) : now : null;

  const [row] = await db
    .insert(outsourceJobs)
    .values({
      orderId: input.orderId,
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
    })
    .onConflictDoUpdate({
      target: outsourceJobs.orderId,
      set: {
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
      },
    })
    .returning();

  if (!current || current.status !== input.status) {
    await db.insert(orderEvents).values({
      orderId: input.orderId,
      fromStatus: current ? `mitra:${current.status}` : null,
      toStatus: `mitra:${input.status}`,
      note: `Produksi luar — ${input.partnerName}: ${input.status.replaceAll("_", " ")}${input.notes ? `. ${input.notes}` : ""}`,
      actor: input.actor || "Owner",
    });
  }
  return row;
}

export async function deleteOutsource(orderId: number) {
  return db.delete(outsourceJobs).where(eq(outsourceJobs.orderId, orderId));
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
  return rows.map((r) => ({
    ...r,
    sentAt: r.sentAt?.toISOString() ?? null,
    receivedAt: r.receivedAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function outsourceCounts(orderIds: number[]) {
  const map = new Map<number, { status: string; partnerName: string }>();
  if (!orderIds.length) return map;
  const rows = await db
    .select({ orderId: outsourceJobs.orderId, status: outsourceJobs.status, partnerName: outsourceJobs.partnerName })
    .from(outsourceJobs)
    .where(inArray(outsourceJobs.orderId, orderIds));
  for (const r of rows) map.set(r.orderId, { status: r.status, partnerName: r.partnerName });
  return map;
}
