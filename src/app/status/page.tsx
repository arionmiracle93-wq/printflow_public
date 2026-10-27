import Link from "next/link";
import { CheckCircle2, ClipboardList, Gauge, Plus } from "lucide-react";
import { checkDatabase } from "@/lib/dbcheck";
import { ProblemScreen } from "@/components/ProblemScreen";

export const dynamic = "force-dynamic";

export const metadata = { title: "Status Sistem - Print Flow" };

export default async function StatusPage() {
  const check = await checkDatabase();
  // Hanya SEPADATNYA nilai ini yang ditampilkan, tidak pernah nilainya
  // sendiri. Nilainya harus tetap rahasia di sisi server.
  const adaAuthSecret = Boolean(process.env.AUTH_SECRET?.trim());

  if (check.ok) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-4">
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-4 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">Status Sistem</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
              <CheckCircle2 size={24} strokeWidth={2.3} /> Semua normal
            </h1>
            <p className="mt-1 text-sm text-emerald-50">{check.message}</p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <Row label="Database" value="Terhubung" tone="text-emerald-600" />
            <Row label="Server database" value={check.env.host ?? "-"} />
            <Row label="Tipe koneksi" value={check.env.pakaiPooler ? "Pooled (benar)" : check.env.local ? "Lokal" : "Direct"} />
            <Row label="Jumlah pekerjaan" value={String(check.counts?.orders ?? 0)} />
            <Row label="Jumlah pelanggan" value={String(check.counts?.customers ?? 0)} />
            <Row label="Tabel" value={`${check.tables.filter((t) => t.ada).length}/${check.tables.length} siap`} />
            <Row
              label="Kunci login (AUTH_SECRET)"
              value={adaAuthSecret ? "Sudah dipasang" : "BELUM - kunci ikut DATABASE_URL"}
              tone={adaAuthSecret ? "text-emerald-600" : "text-amber-600"}
            />
          </div>
        </div>

        {!adaAuthSecret ? (
          <div className="card border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
            <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200">Kunci login masih ikut alamat database</h2>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">
              Selama <code className="font-bold">AUTH_SECRET</code> belum diisi, kunci penandatangan sesi login diambil dari
              alamat database. Kalau alamat itu berubah - password dirotasi atau host pooler diganti - semua orang ikut
              ter-logout sekaligus, termasuk yang memakai APK.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">
              Menambahkannya akan membuat semua orang ter-logout <b>sekali</b> (web dan APK), lalu tidak lagi terjadi
              karena perubahan database. Lakukan saat sepi. Setelah dipasang, jangan diubah-ubah.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-amber-900/70 dark:text-amber-200/70">
              Cara persisnya ada di <b>CATATAN-PRINTFLOW.txt</b> bagian <b>[ ] 4b</b>. Buat nilainya sendiri lewat
              halaman preview - jangan kirim ke siapa pun, termasuk ke chat.
            </p>
          </div>
        ) : null}

        <div className="card p-5">
          <h2 className="text-sm font-bold text-slate-900">Buka aplikasi</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/" className="btn-primary inline-flex items-center gap-1.5">
              <Gauge size={15} /> Beranda
            </Link>
            <Link href="/pesanan" className="btn-ghost inline-flex items-center gap-1.5">
              <ClipboardList size={15} /> Pekerjaan
            </Link>
            <Link href="/pesanan/baru" className="btn-ghost inline-flex items-center gap-1.5">
              <Plus size={15} /> Pekerjaan Baru
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
