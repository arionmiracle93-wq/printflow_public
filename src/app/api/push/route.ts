import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { problemResponse } from "@/lib/dbcheck";
import { pushConfig, sendPushToAll } from "@/lib/push";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const current = await getCurrentUser();
    if (!current) return Response.json({ ok: false, error: "Sesi login diperlukan." }, { status: 401 });
    const config = pushConfig();
    const [all, mine] = await Promise.all([
      db.select({ count: sql<number>`cast(count(*) as int)` }).from(pushSubscriptions).where(eq(pushSubscriptions.active, true)),
      db.select({ count: sql<number>`cast(count(*) as int)` }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, current.id)),
    ]);
    return Response.json(
      {
        ok: true,
        configured: config.ready,
        publicKey: config.publicKey || null,
        subscriptions: Number(all[0]?.count ?? 0),
        mySubscriptions: Number(mine[0]?.count ?? 0),
        user: { name: current.name, role: current.role },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) { return problemResponse(error); }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "subscribe";
  try {
    const current = await getCurrentUser();
    if (!current) return Response.json({ ok: false, error: "Sesi login diperlukan." }, { status: 401 });
    if (action === "test") {
      const result = await sendPushToAll(
        {
          title: "Uji Push Server Print Flow",
          body: `Push Vercel → Android berhasil untuk ${current.name}.`,
          url: "/notifikasi",
          tag: `push-test-${current.id}`,
          requireInteraction: true,
        },
        current.name,
        current.id,
      );
      const error = !result.configured
        ? "VAPID belum dikonfigurasi di Vercel."
        : result.attempted === 0
          ? "Tidak ada subscription database untuk akun ini. Tekan Perbaiki Subscription."
          : result.sent === 0
            ? "Push service menolak semua pengiriman. Lihat detail errors dan perbaiki subscription."
            : undefined;
      return Response.json({ ok: result.configured && result.sent > 0, ...result, error });
    }

    if (action === "reset-mine") {
      const deleted = await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, current.id))
        .returning({ id: pushSubscriptions.id });
      return Response.json({ ok: true, deleted: deleted.length });
    }

    const subscription = body.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined;
    const endpoint = subscription?.endpoint?.trim() || "";
    if (action === "unsubscribe") {
      if (endpoint) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
      return Response.json({ ok: true });
    }
    const config = pushConfig();
    if (!config.ready) return Response.json({ ok: false, error: "VAPID belum dikonfigurasi di Vercel." }, { status: 503 });
    const p256dh = subscription?.keys?.p256dh || "";
    const auth = subscription?.keys?.auth || "";
    if (!endpoint || !p256dh || !auth) return Response.json({ ok: false, error: "Subscription perangkat tidak lengkap." }, { status: 400 });

    await db.insert(pushSubscriptions).values({
      endpoint, p256dh, auth,
      deviceName: typeof body.deviceName === "string" ? body.deviceName.trim().slice(0, 100) : null,
      userId: current.id,
      operatorName: current.name,
      userRole: current.role,
      userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      active: true,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh, auth, userId: current.id, operatorName: current.name, userRole: current.role, active: true, updatedAt: new Date() },
    });
    return Response.json({ ok: true });
  } catch (error) { return problemResponse(error); }
}
