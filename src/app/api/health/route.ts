import { databaseHost, databaseUrl } from "@/db";
import { checkDatabase } from "@/lib/dbcheck";

export const dynamic = "force-dynamic";

export async function GET() {
  const check = await checkDatabase();

  return Response.json(
    {
      ok: check.ok,
      kode: check.code,
      pesan: check.title,
      databaseUrlTerisi: Boolean(databaseUrl()),
      host: databaseHost(),
      cekLengkap: "/api/diagnose",
      perbaiki: "/api/setup",
      statusPage: "/status",
    },
    { status: check.ok ? 200 : 503 },
  );
}

export async function HEAD() {
  const check = await checkDatabase();
  return new Response(null, { status: check.ok ? 200 : 503 });
}


