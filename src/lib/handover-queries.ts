import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderEvents, orders, shiftHandovers } from "@/db/schema";

export type HandoverRecord = {
  id: number;
  orderId: number;
  fromOperator: string;
  toOperator: string;
  toUserId: number | null;
  shiftLabel: string | null;
  lastPosition: string;
  blocker: string | null;
  nextAction: string;
  note: string | null;
  status: string;
  handedOverAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
};

function mapRow(row: typeof shiftHandovers.$inferSelect): HandoverRecord {
  return {
    ...row,
    handedOverAt: row.handedOverAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
  };
}

export async function listHandovers(orderId: number): Promise<HandoverRecord[]> {
  const rows = await db.select().from(shiftHandovers).where(eq(shiftHandovers.orderId, orderId)).orderBy(desc(shiftHandovers.handedOverAt));
  return rows.map(mapRow);
}

export async function createHandover(input: {
  orderId: number;
  fromOperator: string;
  toOperator: string;
  toUserId: number;
  shiftLabel?: string | null;
  lastPosition: string;
  blocker?: string | null;
  nextAction: string;
  note?: string | null;
}) {
  const [row] = await db.insert(shiftHandovers).values({
    orderId: input.orderId,
    fromOperator: input.fromOperator,
    toOperator: input.toOperator,
    toUserId: input.toUserId,
    shiftLabel: input.shiftLabel || null,
    lastPosition: input.lastPosition,
    blocker: input.blocker || null,
    nextAction: input.nextAction,
    note: input.note || null,
    status: "menunggu",
  }).returning();

  await db.insert(orderEvents).values({
    orderId: input.orderId,
    fromStatus: "shift:aktif",
    toStatus: "shift:menunggu",
    note: `Serah terima ${input.fromOperator} → ${input.toOperator}. Posisi: ${input.lastPosition}. Berikutnya: ${input.nextAction}${input.blocker ? `. Kendala: ${input.blocker}` : ""}`,
    actor: input.fromOperator,
  });
  return mapRow(row);
}

export async function acceptHandover(input: { id: number; orderId: number; acceptedBy: string }) {
  const now = new Date();
  const [row] = await db.update(shiftHandovers).set({
    status: "diterima",
    acceptedAt: now,
    acceptedBy: input.acceptedBy,
  }).where(and(eq(shiftHandovers.id, input.id), eq(shiftHandovers.orderId, input.orderId), eq(shiftHandovers.status, "menunggu"))).returning();
  if (!row) return null;

  await db.update(orders).set({ operator: input.acceptedBy, updatedAt: now }).where(eq(orders.id, input.orderId));
  await db.insert(orderEvents).values({
    orderId: input.orderId,
    fromStatus: "shift:menunggu",
    toStatus: "shift:diterima",
    note: `Serah terima diterima oleh ${input.acceptedBy}. Tanggung jawab operator pekerjaan diperbarui.`,
    actor: input.acceptedBy,
  });
  return mapRow(row);
}

export type PendingHandover = HandoverRecord & { orderCode: string; orderTitle: string; customerName: string; dueDate: string; dueTime: string };

export async function pendingHandoverCount(): Promise<number> {
  const rows = await db
    .select({ id: shiftHandovers.id })
    .from(shiftHandovers)
    .where(eq(shiftHandovers.status, "menunggu"));
  return rows.length;
}

export async function listPendingHandovers(): Promise<PendingHandover[]> {
  const rows = await db.select({
    id: shiftHandovers.id,
    orderId: shiftHandovers.orderId,
    fromOperator: shiftHandovers.fromOperator,
    toOperator: shiftHandovers.toOperator,
    toUserId: shiftHandovers.toUserId,
    shiftLabel: shiftHandovers.shiftLabel,
    lastPosition: shiftHandovers.lastPosition,
    blocker: shiftHandovers.blocker,
    nextAction: shiftHandovers.nextAction,
    note: shiftHandovers.note,
    status: shiftHandovers.status,
    handedOverAt: shiftHandovers.handedOverAt,
    acceptedAt: shiftHandovers.acceptedAt,
    acceptedBy: shiftHandovers.acceptedBy,
    orderCode: orders.code,
    orderTitle: orders.title,
    customerName: orders.customerName,
    dueDate: orders.dueDate,
    dueTime: orders.dueTime,
  }).from(shiftHandovers).innerJoin(orders, eq(shiftHandovers.orderId, orders.id)).where(eq(shiftHandovers.status, "menunggu")).orderBy(asc(orders.dueDate), asc(orders.dueTime));
  return rows.map((r) => ({ ...r, handedOverAt: r.handedOverAt.toISOString(), acceptedAt: r.acceptedAt?.toISOString() ?? null }));
}
