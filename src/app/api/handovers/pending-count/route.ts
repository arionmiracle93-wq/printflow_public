import { problemResponse } from "@/lib/dbcheck";
import { pendingHandoverCount } from "@/lib/handover-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const count = await pendingHandoverCount();
    return Response.json(
      { ok: true, count },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return problemResponse(error);
  }
}
