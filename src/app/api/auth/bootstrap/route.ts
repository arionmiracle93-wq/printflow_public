import { hash } from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const setupToken = process.env.SETUP_TOKEN;
  if (setupToken && body.setupToken !== setupToken) return Response.json({ ok: false, error: "Token setup salah." }, { status: 401 });
  if (name.length < 2 || !/^[a-z0-9._-]{3,30}$/.test(username) || password.length < 8) {
    return Response.json({ ok: false, error: "Nama wajib diisi, username 3–30 karakter (huruf kecil/angka), password minimal 8 karakter." }, { status: 400 });
  }
  try {
    const passwordHash = await hash(password, 12);
    const row = await db.transaction(async (tx) => {
      // Cegah dua akun Owner pertama tercipta bersamaan pada deployment baru.
      await tx.execute(sql`select pg_advisory_xact_lock(7042026)`);
      const [count] = await tx.select({ value: sql<number>`cast(count(*) as int)` }).from(users);
      if (Number(count?.value ?? 0) > 0) return null;
      const [created] = await tx.insert(users).values({ name, username, passwordHash, role: "owner", active: true }).returning();
      return created;
    });
    if (!row) return Response.json({ ok: false, error: "Akun Owner sudah pernah dibuat. Silakan login." }, { status: 409 });
    await setSessionCookie({ id: row.id, username: row.username, name: row.name, role: "owner", tokenVersion: row.tokenVersion });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Bootstrap owner failed", error);
    return Response.json({ ok: false, error: "Gagal membuat akun. Pastikan /api/setup sudah dijalankan." }, { status: 500 });
  }
}
