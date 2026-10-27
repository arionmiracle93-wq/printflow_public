import Link from "next/link";
import { Activity, AppWindow, Database, FileClock, Gauge, Microscope, Smartphone } from "lucide-react";
import { AdminActions } from "@/components/AdminActions";
import { BackupDownloads } from "@/components/BackupDownloads";
import { LogoSettings } from "@/components/LogoSettings";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { SEED_ORDER_TITLES } from "@/lib/seed";
import { listCustomers, listOrders, photoStorageUsage } from "@/lib/queries";
import { formatBytes } from "@/lib/photos";
import { blobConfigured } from "@/lib/photo-storage";
import { PhotoStorageCard } from "@/components/PhotoStorageCard";
import { databaseHost, db } from "@/db";
import { businessBranding } from "@/db/schema";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pengaturan - Print Flow" };

export default async function PengaturanPage() {
  const loaded = await safeDb(async () => {
    const [orders, customers, storage, logos] = await Promise.all([
      listOrders({ scope: "semua" }),
      listCustomers(),
      photoStorageUsage(),
      db.select({ id: businessBranding.id }).from(businessBranding).limit(1),
    ]);
    return { orders, customers, storage, hasLogo: logos.length > 0 };
  });

  if (!loaded.ok) {
    return <ProblemScreen problem={loaded.problem} hint="Halaman pengaturan perlu membaca data dari database." />;
  }

  const { orders, customers, storage, hasLogo } = loaded.data;
  const demoCount = orders.filter((o) => SEED_ORDER_TITLES.includes(o.title)).length;
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
  const aiName = process.env.OPENAI_API_KEY ? "OpenAI (GPT)" : process.env.ANTHROPIC_API_KEY ? "Anthropic (Claude)" : null;

  return (
    <div className="min-w-0 space-y-4">
      {/* Judul "Pengaturan" dan daftar navigasi di kiri sudah ada di
          layout /pengaturan (src/app/pengaturan/layout.tsx), supaya
          kedua area pengaturan punya kepala yang sama persis. Yang di
          sini hanya isi area Print Flow: identitas usaha, push, data,
          cadangan, dan kondisi sistem.

          Kartu "Pasang di HP & buat APK" DIHAPUS dari sini atas
          permintaan pemilik. Halaman /panduan tidak ikut hilang dan
          masih bisa dibuka dari lima tempat lain: footer di layout
          utama, menu tiga titik, halaman Mulai, Catatan Perubahan,
          dan ProblemScreen. Jadi tidak ada yang jadi tidak terjangkau
          setelah kartunya dihapus.

          Ikon BookOpen sudah tidak dipakai di file ini setelah
          penghapusan itu, jadi impornya ikut dibuang. Smartphone
          masih dipakai - tombol "Cek APK & Push" di kartu Kondisi
          sistem tidak ikut terhapus.

          Kartu "Unduh cadangan (CSV / Excel)" PINDAH ke kolom
          kanan, tepat di bawah PhotoStorageCard. Sempat jadi kartu
          terakhir di kolom kiri, di bagian paling bawah halaman,
          sementara kolom kanan sudah habis di tengah. Kartu
          cadangan justru yang paling sering dibuka, jadi tidak
          seharusnya yang paling jauh dari mata. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <LogoSettings hasLogo={hasLogo} />
          <PushNotificationSettings />
          <AdminActions hasDemoData={demoCount > 0} />
        </div>

        <div className="min-w-0 space-y-4">
          <div className="card min-w-0 overflow-hidden p-4">
            <div className="flex items-center gap-3">
              <span className="icon-tile"><Activity size={18} /></span>
              <div><h3 className="text-sm font-semibold text-[color:var(--pf-ink)]">Kondisi sistem</h3><p className="text-[11px] text-slate-400">Ringkasan kesehatan Print Flow</p></div>
            </div>
            <ul className="mt-4 divide-y divide-slate-100 text-sm text-slate-700">
              <Row label="Database" value="Terhubung" good />
              <Row label="Server database" value={databaseHost() ?? "-"} />
              <Row label="Tipe koneksi" value={(databaseHost() ?? "").includes("pooler") ? "Pooled" : "Lokal / Direct"} />
              <Row label="Jumlah pekerjaan" value={String(orders.length)} />
              <Row label="Jumlah pelanggan" value={String(customers.length)} />
              <Row label="Penyimpanan foto" value={`${storage.files} foto, ${formatBytes(storage.bytes)} (${blobConfigured() ? "Vercel Blob" : "database"})`} good={blobConfigured() && storage.dbFiles === 0} />
              <Row label="Logo usaha" value={hasLogo ? "Aktif" : "Ikon bawaan"} good={hasLogo} />
              <Row label="AI bahasa" value={aiConfigured ? `${aiName} aktif` : "Mesin internal (gratis)"} good={aiConfigured} />
            </ul>
            <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
              <Link href="/status" className="btn-ghost w-full sm:w-auto"><Database size={15} /> Diagnosis</Link>
              <a href="/api/performance" target="_blank" rel="noreferrer" className="btn-ghost w-full sm:w-auto"><Gauge size={15} /> Tes Kecepatan</a>
              <a href="/api/pwa/check" target="_blank" rel="noreferrer" className="btn-ghost w-full sm:w-auto"><AppWindow size={15} /> Cek Kesiapan PWA</a>
              <a href="/api/apk/check" target="_blank" rel="noreferrer" className="btn-ghost w-full sm:w-auto"><Smartphone size={15} /> Cek APK & Push</a>
              <Link href="/catatan-perubahan" className="btn-ghost w-full sm:w-auto"><FileClock size={15} /> Catatan</Link>
              <a href="/api/diagnose" target="_blank" rel="noreferrer" className="btn-ghost w-full sm:w-auto"><Microscope size={15} /> Data JSON</a>
            </div>
          </div>

          <PhotoStorageCard blob={blobConfigured()} initialUsage={storage} />
          <BackupDownloads />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, good = false }: { label: string; value: string; good?: boolean }) {
  return (
    <li className="flex min-w-0 flex-col gap-1 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <span className="shrink-0 text-xs text-slate-500 sm:text-sm">{label}</span>
      <span className={`min-w-0 break-all text-left text-sm font-bold sm:max-w-[65%] sm:text-right ${good ? "text-teal-700" : "text-slate-800"}`}>{value}</span>
    </li>
  );
}
