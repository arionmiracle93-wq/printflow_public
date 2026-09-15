import { compare, hash } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, setSessionCookie } from "@/lib/auth";

export async function PATCH(request: Request) {
  const me = await getCurrentUser();
  if (!me) return Response.json({ ok: false, error: "Sesi habis, silakan login lagi." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < 8) {
    return Response.json({ ok: false, error: "Password baru minimal 8 karakter." }, { status: 400 });
  }

  try {
    const rows = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
    const row = rows[0];
    if (!row) return Response.json({ ok: false, error: "Akun tidak ditemukan." }, { status: 404 });

    const valid = await compare(currentPassword, row.passwordHash);
    if (!valid) return Response.json({ ok: false, error: "Password saat ini salah." }, { status: 401 });

    const passwordHash = await hash(newPassword, 12);
    const [updated] = await db
      .update(users)
      .set({ passwordHash, tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() })
      .where(eq(users.id, me.id))
      .returning({ tokenVersion: users.tokenVersion });

    // Perangkat lain otomatis ter-logout (tokenVersion berubah). Perangkat yang
    // dipakai sekarang langsung diberi cookie baru supaya tidak perlu login ulang.
    await setSessionCookie({ id: me.id, username: me.username, name: me.name, role: me.role, tokenVersion: updated.tokenVersion, sessionId: me.sessionId });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/account/password", error);
    return Response.json({ ok: false, error: "Gagal mengganti password." }, { status: 500 });
  }
}
