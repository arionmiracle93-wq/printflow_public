import { hash } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, ROLES, setSessionCookie, type UserRole } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentUser();
  if (current?.role !== "owner") return Response.json({ ok: false, error: "Hanya Owner." }, { status: 403 });
  const id = Number.parseInt((await params).id, 10);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (id === current.id && body.active === false) return Response.json({ ok: false, error: "Owner tidak dapat menonaktifkan akun yang sedang dipakai." }, { status: 400 });
  if (id === current.id && typeof body.role === "string" && body.role !== "owner") return Response.json({ ok: false, error: "Owner tidak dapat menurunkan role akun yang sedang dipakai." }, { status: 400 });

  const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  let revoke = false;
  if (typeof body.name === "string" && body.name.trim().length >= 2) patch.name = body.name.trim();
  if (typeof body.username === "string") {
    const username = body.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      return Response.json({ ok: false, error: "Username harus 3–30 karakter: huruf kecil, angka, titik, underscore, atau minus." }, { status: 400 });
    }
    const duplicate = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (duplicate[0] && duplicate[0].id !== id) {
      return Response.json({ ok: false, error: "Username sudah dipakai pengguna lain." }, { status: 409 });
    }
    patch.username = username;
    revoke = true;
  }
  if (typeof body.role === "string" && ROLES.includes(body.role as typeof ROLES[number])) { patch.role = body.role; revoke = true; }
  if (typeof body.active === "boolean") { patch.active = body.active; revoke = true; }
  if (typeof body.password === "string" && body.password.length >= 8) { patch.passwordHash = await hash(body.password, 12); revoke = true; }
  if (revoke) patch.tokenVersion = sql`${users.tokenVersion} + 1` as unknown as number;

  try {
    const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning({ id: users.id, name: users.name, username: users.username, role: users.role, active: users.active, tokenVersion: users.tokenVersion });
    if (!row) return Response.json({ ok: false, error: "Pengguna tidak ditemukan." }, { status: 404 });

    // Owner mengubah AKUN SENDIRI (mis. reset password miliknya dari halaman
    // Pengguna). Perangkat lain miliknya tetap ter-logout karena tokenVersion
    // naik, tetapi perangkat yang sedang dipakai ini langsung diberi cookie
    // baru — sama seperti perilaku halaman "Ganti Password". Tanpa ini, owner
    // ikut terlempar ke halaman login padahal dia hanya mengelola akun.
    const mengubahDiriSendiri = id === current.id && revoke;
    if (mengubahDiriSendiri) {
      await setSessionCookie({
        id: row.id,
        username: row.username,
        name: row.name,
        role: row.role as UserRole,
        tokenVersion: row.tokenVersion,
        sessionId: current.sessionId,
      });
    }

    return Response.json({
      ok: true,
      data: { id: row.id, name: row.name, username: row.username, role: row.role, active: row.active },
      reloginRequired: revoke,
      // Sesi perangkat ini TIDAK lagi ikut dicabut saat owner mengubah akunnya
      // sendiri — cookie-nya sudah diperbarui di atas.
      currentSessionRevoked: false,
      selfUpdated: mengubahDiriSendiri,
      // Dipakai UI untuk menyusun pesan yang tepat sasaran.
      changed: {
        password: typeof body.password === "string" && body.password.length >= 8,
        username: typeof body.username === "string",
        role: typeof body.role === "string",
        active: typeof body.active === "boolean",
      },
      targetName: row.name,
      targetUsername: row.username,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return Response.json({ ok: false, error: "Username sudah dipakai pengguna lain." }, { status: 409 });
    return Response.json({ ok: false, error: "Gagal mengubah pengguna." }, { status: 500 });
  }
}
