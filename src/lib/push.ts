import "server-only";
import webpush from "web-push";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  requireInteraction?: boolean;
};

export function pushConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || "";
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@example.com";
  return { publicKey, privateKey, subject, ready: Boolean(publicKey && privateKey && subject) };
}

let configuredFor = "";
function configure() {
  const config = pushConfig();
  if (!config.ready) return false;
  const signature = `${config.subject}:${config.publicKey.slice(0, 12)}`;
  if (configuredFor !== signature) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    configuredFor = signature;
  }
  return true;
}

/** Broadcast versi sekarang: semua perangkat internal aktif menerima notifikasi. */
export async function sendPushToAll(payload: PushPayload, targetOperator?: string, targetUserId?: number) {
  if (!configure()) return { configured: false, attempted: 0, sent: 0, failed: 0, removed: 0, errors: [] };
  const activeRows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.active, true));
  const normalizedTarget = targetOperator?.trim().toLocaleLowerCase("id-ID");
  const targeted = Boolean(targetUserId || normalizedTarget);
  const rows = targeted
    ? activeRows.filter(
        (row) =>
          row.userRole === "owner" ||
          (targetUserId
            ? row.userId === targetUserId
            : row.operatorName?.trim().toLocaleLowerCase("id-ID") === normalizedTarget),
      )
    : activeRows;
  let sent = 0;
  let failed = 0;
  let removed = 0;
  const errors: Array<{ statusCode: number | null; message: string; deviceName: string | null }> = [];

  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60, urgency: payload.requireInteraction ? "high" : "normal", topic: payload.tag?.slice(0, 32) },
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        const pushError = error as { statusCode?: number; message?: string; body?: string };
        const status = pushError.statusCode;
        errors.push({
          statusCode: status ?? null,
          message: (pushError.body || pushError.message || "Push service menolak pengiriman").slice(0, 300),
          deviceName: row.deviceName,
        });
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id));
          removed += 1;
        }
      }
    }),
  );
  return { configured: true, attempted: rows.length, sent, failed, removed, errors };
}

/**
 * Jadwalkan setelah response dikirim: tombol tetap cepat dan Vercel menunggu
 * callback selesai, berbeda dari promise fire-and-forget biasa yang bisa diputus.
 */
export function notifyInBackground(payload: PushPayload, targetOperator?: string, targetUserId?: number) {
  after(async () => {
    try {
      await sendPushToAll(payload, targetOperator, targetUserId);
    } catch (error) {
      console.error("Push notification failed", error);
    }
  });
}
