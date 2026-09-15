import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "@/db";
import { users, userSessions } from "@/db/schema";
import { USER_ROLES as ROLES, roleLabel, type UserRole } from "@/lib/auth-client";

export const SESSION_COOKIE = "print_flow_session";
export { ROLES, roleLabel };
export type { UserRole };

export type SessionPayload = JWTPayload & {
  userId: number;
  username: string;
  name: string;
  role: UserRole;
  tokenVersion: number;
  sessionId: number;
};

export type CurrentUser = {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  tokenVersion: number;
  sessionId: number;
};

function secretValue(): string {
  // AUTH_SECRET direkomendasikan. DATABASE_URL adalah fallback stabil agar
  // deployment lama tidak terkunci sebelum owner menambah env baru.
  return process.env.AUTH_SECRET?.trim() || process.env.DATABASE_URL?.trim() || "print-flow-local-development-only";
}

export function authSecretBytes() {
  return new TextEncoder().encode(secretValue());
}

/** Membuat baris sesi baru di database untuk satu kali login dari satu perangkat. */
export async function createUserSession(userId: number, ip: string | null, userAgent: string | null): Promise<number> {
  const [row] = await db.insert(userSessions).values({ userId, ip, userAgent }).returning({ id: userSessions.id });
  return row.id;
}

export async function createSessionToken(user: CurrentUser) {
  return new SignJWT({
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    tokenVersion: user.tokenVersion,
    sessionId: user.sessionId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer("print-flow")
    .setAudience("print-flow-internal")
    .setExpirationTime("12h")
    .sign(authSecretBytes());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, authSecretBytes(), {
      issuer: "print-flow",
      audience: "print-flow-internal",
    });
    if (
      typeof payload.userId !== "number" ||
      typeof payload.username !== "string" ||
      typeof payload.name !== "string" ||
      !ROLES.includes(payload.role as UserRole) ||
      typeof payload.tokenVersion !== "number" ||
      typeof payload.sessionId !== "number"
    ) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: CurrentUser) {
  const token = await createSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

/**
 * Security boundary server: JWT valid saja tidak cukup; akun juga harus masih aktif,
 * version cocok, DAN sesi perangkat ini belum di-logout paksa oleh owner.
 *
 * Dibungkus cache() dari React: layout.tsx dan halaman (mis. detail pesanan)
 * sama-sama memanggil ini di satu request yang sama. Tanpa cache(), itu jadi
 * 2x query users yang identik untuk satu kali buka halaman — dobel tanpa
 * guna. cache() membuat pemanggilan kedua memakai hasil yang sama, bukan
 * query baru.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  try {
    const rows = await db.select({
      id: users.id,
      username: users.username,
      name: users.name,
      role: users.role,
      active: users.active,
      tokenVersion: users.tokenVersion,
    }).from(users).where(eq(users.id, session.userId)).limit(1);
    const row = rows[0];
    if (!row || !row.active || row.tokenVersion !== session.tokenVersion || !ROLES.includes(row.role as UserRole)) return null;

    const sessionRows = await db.select({ revokedAt: userSessions.revokedAt })
      .from(userSessions)
      .where(eq(userSessions.id, session.sessionId))
      .limit(1);
    if (!sessionRows[0] || sessionRows[0].revokedAt) return null;
    // Tandai kapan sesi ini terakhir dipakai — tanpa menunggu, tidak memblokir respons.
    void db.update(userSessions).set({ lastSeenAt: new Date() }).where(eq(userSessions.id, session.sessionId));

    return { id: row.id, username: row.username, name: row.name, role: row.role as UserRole, tokenVersion: row.tokenVersion, sessionId: session.sessionId };
  } catch {
    return null;
  }
});

export function can(user: CurrentUser | null, roles: UserRole[]) {
  return Boolean(user && roles.includes(user.role));
}

export type ActiveSession = {
  id: number;
  userId: number;
  userName: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  isCurrent: boolean;
};

/** Daftar semua sesi aktif (belum revoked) di seluruh akun — untuk halaman owner. */
export async function listActiveSessions(currentSessionId: number): Promise<ActiveSession[]> {
  const rows = await db
    .select({
      id: userSessions.id,
      userId: userSessions.userId,
      userName: users.name,
      ip: userSessions.ip,
      userAgent: userSessions.userAgent,
      createdAt: userSessions.createdAt,
      lastSeenAt: userSessions.lastSeenAt,
    })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(isNull(userSessions.revokedAt))
    .orderBy(desc(userSessions.lastSeenAt));
  return rows.map((r) => ({ ...r, isCurrent: r.id === currentSessionId }));
}

/** Logout paksa satu perangkat tertentu. */
export async function revokeSession(sessionId: number): Promise<void> {
  await db.update(userSessions).set({ revokedAt: new Date() }).where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)));
}
