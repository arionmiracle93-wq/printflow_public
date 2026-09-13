import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [row] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(users);
    return Response.json({ ok: true, needsBootstrap: Number(row?.count ?? 0) === 0 });
  } catch {
    return Response.json({ ok: false, needsBootstrap: true, needsSetup: true }, { status: 503 });
  }
}
