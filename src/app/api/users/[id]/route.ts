import { hash } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, ROLES } from "@/lib/auth";

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
    const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning({ id: users.id, name: users.name, username: users.username, role: users.role, active: users.active });
    if (!row) return Response.json({ ok: false, error: "Pengguna tidak ditemukan." }, { status: 404 });
    return Response.json({
      ok: true,
      data: row,
      reloginRequired: revoke,
      currentSessionRevoked: id === current.id && revoke,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return Response.json({ ok: false, error: "Username sudah dipakai pengguna lain." }, { status: 409 });
    return Response.json({ ok: false, error: "Gagal mengubah pengguna." }, { status: 500 });
  }
}
