import { clearSessionCookie, getCurrentUser, revokeSession } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (user) await revokeSession(user.sessionId);
  await clearSessionCookie();
  return Response.json({ ok: true });
}
