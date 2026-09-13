import { compare } from "bcryptjs";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginAudit, users } from "@/db/schema";
import { setSessionCookie, type UserRole } from "@/lib/auth";

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) return Response.json({ ok: false, error: "Username dan password wajib diisi." }, { status: 400 });
  const ip = clientIp(request);
  try {
    const since = new Date(Date.now() - 15 * 60_000);
    const [attempt] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(loginAudit).where(and(eq(loginAudit.username, username), eq(loginAudit.success, false), gte(loginAudit.createdAt, since)));
    if (Number(attempt?.count ?? 0) >= 8) return Response.json({ ok: false, error: "Terlalu banyak percobaan gagal. Tunggu 15 menit lalu coba lagi." }, { status: 429 });

    const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const user = rows[0];
    const valid = Boolean(user?.active && await compare(password, user.passwordHash));
    await db.insert(loginAudit).values({ username, userId: user?.id ?? null, success: valid, ip, userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null });
    if (!valid || !user) return Response.json({ ok: false, error: "Username atau password salah, atau akun dinonaktifkan." }, { status: 401 });

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    await setSessionCookie({ id: user.id, username: user.username, name: user.name, role: user.role as UserRole, tokenVersion: user.tokenVersion });
    return Response.json({ ok: true, user: { name: user.name, role: user.role } });
  } catch (error) {
    console.error("Login failed", error);
    return Response.json({ ok: false, error: "Sistem login belum siap. Buka /api/setup sekali, lalu coba lagi." }, { status: 500 });
  }
}
