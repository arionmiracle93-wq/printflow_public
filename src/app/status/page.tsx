import Link from "next/link";
import { checkDatabase } from "@/lib/dbcheck";
import { ProblemScreen } from "@/components/ProblemScreen";

export const dynamic = "force-dynamic";

export const metadata = { title: "Status Sistem — Print Flow" };

export default async function StatusPage() {
  const check = await checkDatabase();

  if (check.ok) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-4">
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-4 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">Status Sistem</p>
            <h1 className="mt-1 text-2xl font-extrabold">✅ Semua normal</h1>
            <p className="mt-1 text-sm text-emerald-50">{check.message}</p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <Row label="Database" value="Terhubung" tone="text-emerald-600" />
            <Row label="Server database" value={check.env.host ?? "-"} />
            <Row label="Tipe koneksi" value={check.env.pakaiPooler ? "Pooled (benar)" : check.env.local ? "Lokal" : "Direct"} />
            <Row label="Jumlah pekerjaan" value={String(check.counts?.orders ?? 0)} />
            <Row label="Jumlah pelanggan" value={String(check.counts?.customers ?? 0)} />
            <Row label="Tabel" value={`${check.tables.filter((t) => t.ada).length}/${check.tables.length} siap`} />
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-bold text-slate-900">Buka aplikasi</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/" className="btn-primary">
              🏠 Dashboard
            </Link>
            <Link href="/pesanan" className="btn-ghost">
              📋 Pekerjaan
            </Link>
            <Link href="/pesanan/baru" className="btn-ghost">
              ➕ Pekerjaan Baru
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <ProblemScreen problem={check} hint="Halaman ini memeriksa aplikasi Anda secara otomatis." />;
}

function Row({ label, value, tone = "text-slate-800" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-sm font-semibold break-words ${tone}`}>{value}</p>
    </div>
  );
}
