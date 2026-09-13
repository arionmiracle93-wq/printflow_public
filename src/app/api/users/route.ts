import { hash } from "bcryptjs";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { loginAudit, users } from "@/db/schema";
import { getCurrentUser, ROLES } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const current = await getCurrentUser();
  if (current?.role !== "owner") return Response.json({ ok: false, error: "Hanya Owner." }, { status: 403 });
  const [rows, audits] = await Promise.all([
    db.select({ id: users.id, name: users.name, username: users.username, role: users.role, active: users.active, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt }).from(users).orderBy(users.name),
    db.select({ id: loginAudit.id, username: loginAudit.username, success: loginAudit.success, ip: loginAudit.ip, createdAt: loginAudit.createdAt }).from(loginAudit).orderBy(desc(loginAudit.createdAt)).limit(30),
  ]);
  return Response.json({ ok: true, data: rows, audits });
}

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (current?.role !== "owner") return Response.json({ ok: false, error: "Hanya Owner." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = typeof body.role === "string" && ROLES.includes(body.role as typeof ROLES[number]) ? body.role : "karyawan";
  if (name.length < 2 || !/^[a-z0-9._-]{3,30}$/.test(username) || password.length < 8) return Response.json({ ok: false, error: "Nama minimal 2 karakter, username 3–30 karakter, password minimal 8 karakter." }, { status: 400 });
  try {
    const [row] = await db.insert(users).values({ name, username, passwordHash: await hash(password, 12), role }).returning({ id: users.id, name: users.name, username: users.username, role: users.role, active: users.active });
    return Response.json({ ok: true, data: row }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return Response.json({ ok: false, error: "Username sudah dipakai." }, { status: 409 });
    return Response.json({ ok: false, error: "Gagal membuat pengguna." }, { status: 500 });
  }
}
