import { checkDatabase } from "@/lib/dbcheck";

export const dynamic = "force-dynamic";

export async function GET() {
  const check = await checkDatabase();

  return Response.json(
    {
      ok: check.ok,
      kode: check.code,
      judul: check.title,
      penjelasan: check.message,
      langkahPerbaikan: check.steps,
      pengaturan: {
        databaseUrlTerisi: check.env.ada,
        host: check.env.host,
        pooledConnection: check.env.pakaiPooler,
        ssl: check.env.pakaiSsl,
        local: check.env.local,
      },
      tabel: check.tables,
      jumlahData: check.counts ?? null,
      waktu: new Date().toISOString(),
      petunjuk: {
        buatTabel: "/api/setup",
        dataContoh: "/api/setup?seed=1",
        statusAplikasi: "/status",
        cekSehat: "/api/health",
      },
    },
    { status: check.ok ? 200 : 503 },
  );
}
