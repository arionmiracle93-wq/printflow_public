import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * NOTIFIKASI NATIVE ANDROID LEWAT ONESIGNAL
 * ---------------------------------------------------------------
 * APK hasil "web to apk" memakai WebView. WebView tidak mendukung Web
 * Push (service worker + VAPID), jadi notifikasi untuk APK itu dikirim
 * lewat OneSignal, yang menyampaikannya ke HP lewat Firebase (FCM).
 * Jalur Web Push lama di src/lib/push.ts tetap berjalan untuk Chrome
 * dan APK TWA; kedua jalur dikirim bersamaan dari sendPushToAll().
 *
 * Variabel Vercel:
 *   ONESIGNAL_APP_ID         App ID OneSignal (UUID 36 karakter)
 *   ONESIGNAL_REST_API_KEY   App API Key (OneSignal > Settings > Keys & IDs)
 *   ONESIGNAL_TARGETING      "all" (bawaan) atau "external_id"
 *
 * Mode target:
 *   all          semua perangkat yang berlangganan menerima semuanya.
 *                Berfungsi tanpa syarat apa pun di sisi APK.
 *   external_id  hanya owner + pengguna yang dituju (sama seperti aturan
 *                Web Push). SYARAT: APK harus memanggil
 *                OneSignal.login("<id pengguna PrintFlow>") di perangkat,
 *                kalau tidak notifikasi tidak akan sampai ke siapa pun.
 */

export type OneSignalPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  requireInteraction?: boolean;
};

export type OneSignalTargeting = "all" | "external_id";

export type OneSignalTarget =
  | { mode: "all" }
  | { mode: "external_id"; ids: string[] };

export type OneSignalResult = {
  configured: boolean;
  ok: boolean;
  id: string | null;
  recipients: number | null;
  error?: string;
};

const ENDPOINT = "https://api.onesignal.com/notifications?c=push";

export function oneSignalConfig() {
  const appId = process.env.ONESIGNAL_APP_ID?.trim() || "";
  // Kalau yang ditempel ikut berawalan "Key ", buang agar tidak ganda.
  const apiKey = (process.env.ONESIGNAL_REST_API_KEY?.trim() || "").replace(/^key\s+/i, "");
  const targeting: OneSignalTargeting =
    process.env.ONESIGNAL_TARGETING?.trim().toLowerCase() === "external_id" ? "external_id" : "all";
  return { appId, apiKey, targeting, ready: Boolean(appId && apiKey) };
}

/** Tentukan siapa penerimanya. Aturannya meniru sendPushToAll() di push.ts. */
export async function resolveOneSignalTarget(
  targetOperator?: string,
  targetUserId?: number,
): Promise<OneSignalTarget> {
  if (oneSignalConfig().targeting === "all") return { mode: "all" };
  const normalized = targetOperator?.trim().toLocaleLowerCase("id-ID");
  const targeted = Boolean(targetUserId || normalized);
  const rows = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.active, true));
  const ids = rows
    .filter(
      (row) =>
        !targeted ||
        row.role === "owner" ||
        (targetUserId ? row.id === targetUserId : row.name.trim().toLocaleLowerCase("id-ID") === normalized),
    )
    .map((row) => String(row.id));
  return { mode: "external_id", ids };
}

/**
 * Isi permintaan ke OneSignal. Alamat halaman TIDAK dikirim sebagai `url`
 * (di Android itu membuka browser HP, bukan APK), tapi sebagai data
 * tambahan. Ketukan pada notifikasi membuka aplikasinya.
 */
export function buildOneSignalBody(appId: string, payload: OneSignalPayload, target: OneSignalTarget) {
  const body: Record<string, unknown> = {
    app_id: appId,
    target_channel: "push",
    headings: { en: payload.title, id: payload.title },
    contents: { en: payload.body, id: payload.body },
    data: { url: payload.url, tag: payload.tag ?? null },
    ttl: 60 * 60,
    priority: 10,
  };
  if (payload.tag) body.collapse_id = payload.tag.slice(0, 64);
  if (target.mode === "all") body.included_segments = ["Total Subscriptions"];
  else body.include_aliases = { external_id: target.ids };
  return body;
}

function describeErrors(errors: unknown): string | undefined {
  if (!errors) return undefined;
  if (Array.isArray(errors)) return errors.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("; ").slice(0, 300);
  if (typeof errors === "object") return JSON.stringify(errors).slice(0, 300);
  return String(errors).slice(0, 300);
}

export async function sendOneSignal(payload: OneSignalPayload, target: OneSignalTarget): Promise<OneSignalResult> {
  const config = oneSignalConfig();
  if (!config.ready) {
    return { configured: false, ok: false, id: null, recipients: null, error: "OneSignal belum dikonfigurasi di Vercel." };
  }
  if (target.mode === "external_id" && target.ids.length === 0) {
    return { configured: true, ok: false, id: null, recipients: null, error: "Tidak ada penerima aktif untuk notifikasi ini." };
  }
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        Authorization: `Key ${config.apiKey}`,
      },
      body: JSON.stringify(buildOneSignalBody(config.appId, payload, target)),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const json = (await response.json().catch(() => ({}))) as {
      id?: string;
      recipients?: number;
      errors?: unknown;
    };
    const id = typeof json.id === "string" && json.id ? json.id : null;
    const recipients = typeof json.recipients === "number" ? json.recipients : null;
    if (response.ok && id) return { configured: true, ok: true, id, recipients };
    const detail = describeErrors(json.errors);
    return {
      configured: true,
      ok: false,
      id,
      recipients,
      error: detail ?? `OneSignal menolak permintaan (status ${response.status}).`,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      id: null,
      recipients: null,
      error: error instanceof Error ? error.message.slice(0, 300) : "Gagal menghubungi OneSignal.",
    };
  }
}

/** Gabungan: tentukan target lalu kirim. Tidak pernah melempar error. */
export async function sendOneSignalFor(
  payload: OneSignalPayload,
  targetOperator?: string,
  targetUserId?: number,
): Promise<OneSignalResult> {
  if (!oneSignalConfig().ready) {
    return { configured: false, ok: false, id: null, recipients: null };
  }
  try {
    const target = await resolveOneSignalTarget(targetOperator, targetUserId);
    return await sendOneSignal(payload, target);
  } catch (error) {
    return {
      configured: true,
      ok: false,
      id: null,
      recipients: null,
      error: error instanceof Error ? error.message.slice(0, 300) : "Gagal menyiapkan penerima OneSignal.",
    };
  }
}
