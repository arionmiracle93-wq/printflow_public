import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export type EmployeeOption = {
  id: number;
  name: string;
  username: string;
};

/** Daftar akun Karyawan aktif untuk PIC dan tujuan serah-terima. */
export async function listActiveEmployees(excludeUserId?: number): Promise<EmployeeOption[]> {
  const conditions = [eq(users.role, "karyawan"), eq(users.active, true)];
  if (excludeUserId) conditions.push(ne(users.id, excludeUserId));
  return db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(and(...conditions))
    .orderBy(asc(users.name), asc(users.username));
}

/** Resolve ID menjadi akun Karyawan aktif; menjadi batas keamanan API. */
export async function getActiveEmployee(userId: number): Promise<EmployeeOption | null> {
  const rows = await db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.role, "karyawan"), eq(users.active, true)))
    .limit(1);
  return rows[0] ?? null;
}
