import { getCurrentUser } from "@/lib/auth";
import { problemResponse } from "@/lib/dbcheck";
import { quickSearch } from "@/lib/search-queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=...  -> pencarian cepat untuk tombol cari di header.
 * Hanya untuk pengguna yang login (Owner dan Karyawan). proxy.ts sudah
 * menolak permintaan tanpa login; di sini diperiksa sekali lagi.
 */
export async function GET(request: Request) {
  if (!(await getCurrentUser())) {
    return Response.json({ ok: false, error: "Sesi login diperlukan." }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const result = await quickSearch(q);
    return Response.json({ ok: true, q, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return problemResponse(error);
  }
}
