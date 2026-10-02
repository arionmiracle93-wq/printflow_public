import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { databaseHost, db, isLocalDatabase } from "@/db";
import { users } from "@/db/schema";
import { createUserSession, setSessionCookie, type UserRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Login otomatis untuk pratinjau lokal saja.
 * Mati total kalau PRINTFLOW_PREVIEW_OPEN bukan "1", atau database bukan localhost.
 * Tidak membuat pintu belakang di Vercel/Neon.
 */
export async function GET(request: Request) {
  if (process.env.PRINTFLOW_PREVIEW_OPEN !== "1" || !isLocalDatabase(databaseHost())) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const nextRaw = url.searchParams.get("next") || "/";
  const nextPath = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  const existing = await db.select().from(users).where(eq(users.username, "owner")).limit(1);
  let user = existing[0];
  if (!user) {
    const passwordHash = await hash(randomBytes(24).toString("hex"), 10);
    const inserted = await db
      .insert(users)
      .values({
        name: "Owner Percetakan",
        username: "owner",
        passwordHash,
        role: "owner",
        active: true,
      })
      .returning();
    user = inserted[0];
  }

  if (!user?.active) {
    return new Response("Akun pratinjau tidak aktif.", { status: 403 });
  }

  const sessionId = await createUserSession(user.id, "127.0.0.1", "printflow-local-preview");
  await setSessionCookie({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role as UserRole,
    tokenVersion: user.tokenVersion,
    sessionId,
  });
  redirect(nextPath);
}
