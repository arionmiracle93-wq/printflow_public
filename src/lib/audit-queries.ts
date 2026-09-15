import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { loginAudit, orderEvents, orderPhotos, orders, shiftHandovers } from "@/db/schema";
import { statusMeta } from "@/lib/domain";

export type AuditEntry = {
  id: string;
  type: "login_ok" | "login_gagal" | "status" | "mutasi" | "foto";
  actor: string;
  detail: string;
  orderId: number | null;
  orderCode: string | null;
  createdAt: Date;
};

const PER_SOURCE_LIMIT = 150;

/** Gabungan riwayat login, perubahan status, mutasi, dan upload foto — untuk halaman audit milik Owner. */
export async function listAuditEntries(): Promise<AuditEntry[]> {
  const [logins, statusChanges, handovers, photos] = await Promise.all([
    db.select().from(loginAudit).orderBy(desc(loginAudit.createdAt)).limit(PER_SOURCE_LIMIT),
    db
      .select({
        id: orderEvents.id,
        fromStatus: orderEvents.fromStatus,
        toStatus: orderEvents.toStatus,
        note: orderEvents.note,
        actor: orderEvents.actor,
        createdAt: orderEvents.createdAt,
        orderId: orderEvents.orderId,
        orderCode: orders.code,
      })
      .from(orderEvents)
      .innerJoin(orders, eq(orders.id, orderEvents.orderId))
      .orderBy(desc(orderEvents.createdAt))
      .limit(PER_SOURCE_LIMIT),
    db
      .select({
        id: shiftHandovers.id,
        fromOperator: shiftHandovers.fromOperator,
        toOperator: shiftHandovers.toOperator,
        handedOverAt: shiftHandovers.handedOverAt,
        acceptedAt: shiftHandovers.acceptedAt,
        acceptedBy: shiftHandovers.acceptedBy,
        orderId: shiftHandovers.orderId,
        orderCode: orders.code,
      })
      .from(shiftHandovers)
      .innerJoin(orders, eq(orders.id, shiftHandovers.orderId))
      .orderBy(desc(shiftHandovers.handedOverAt))
      .limit(PER_SOURCE_LIMIT),
    db
      .select({
        id: orderPhotos.id,
        uploadedBy: orderPhotos.uploadedBy,
        caption: orderPhotos.caption,
        createdAt: orderPhotos.createdAt,
        orderId: orderPhotos.orderId,
        orderCode: orders.code,
      })
      .from(orderPhotos)
      .innerJoin(orders, eq(orders.id, orderPhotos.orderId))
      .orderBy(desc(orderPhotos.createdAt))
      .limit(PER_SOURCE_LIMIT),
  ]);

  const entries: AuditEntry[] = [];

  for (const l of logins) {
    entries.push({
      id: `login-${l.id}`,
      type: l.success ? "login_ok" : "login_gagal",
      actor: l.username,
      detail: l.success ? `Login berhasil${l.ip ? ` dari ${l.ip}` : ""}` : `Percobaan login gagal${l.ip ? ` dari ${l.ip}` : ""}`,
      orderId: null,
      orderCode: null,
      createdAt: l.createdAt,
    });
  }

  for (const e of statusChanges) {
    const to = e.toStatus.startsWith("mitra:") ? `Mitra — ${e.toStatus.slice(6)}` : statusMeta(e.toStatus).label;
    const from = e.fromStatus ? (e.fromStatus.startsWith("mitra:") ? `Mitra — ${e.fromStatus.slice(6)}` : statusMeta(e.fromStatus).label) : null;
    entries.push({
      id: `status-${e.id}`,
      type: "status",
      actor: e.actor,
      detail: `${from ? `${from} → ` : ""}${to}${e.note ? ` — "${e.note}"` : ""}`,
      orderId: e.orderId,
      orderCode: e.orderCode,
      createdAt: e.createdAt,
    });
  }

  for (const h of handovers) {
    entries.push({
      id: `mutasi-${h.id}-serah`,
      type: "mutasi",
      actor: h.fromOperator,
      detail: `Menyerahkan pekerjaan ke ${h.toOperator}`,
      orderId: h.orderId,
      orderCode: h.orderCode,
      createdAt: h.handedOverAt,
    });
    if (h.acceptedAt) {
      entries.push({
        id: `mutasi-${h.id}-terima`,
        type: "mutasi",
        actor: h.acceptedBy ?? h.toOperator,
        detail: `Menerima pekerjaan dari ${h.fromOperator}`,
        orderId: h.orderId,
        orderCode: h.orderCode,
        createdAt: h.acceptedAt,
      });
    }
  }

  for (const p of photos) {
    entries.push({
      id: `foto-${p.id}`,
      type: "foto",
      actor: p.uploadedBy ?? "Tidak diketahui",
      detail: `Upload foto${p.caption ? ` — ${p.caption}` : ""}`,
      orderId: p.orderId,
      orderCode: p.orderCode,
      createdAt: p.createdAt,
    });
  }

  entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return entries;
}
