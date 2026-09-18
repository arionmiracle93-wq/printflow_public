import Link from "next/link";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  Check,
  ClipboardList,
  Download,
  FolderTree,
  LayoutDashboard,
  LogIn,
  MousePointerClick,
  Navigation,
  Paintbrush,
  Smartphone,
  Sparkles,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Berkas Revisi UI — Print Flow" };

const ZIP_URL = "/revisi-ui/printflow-revisi-ui.zip";
const MIRROR_DIR = "public/revisi-ui/printflow";

/** Semua berkas yang sentuh pada revisi UI ini. */
const CHANGED: { file: string; area: string; note: string }[] = [
  { file: "src/app/globals.css", area: "Sistem desain", note: "Variabel warna/ukuran terpusat, kartu & tombol lebih konsisten, cincin fokus untuk aksesibilitas, tulang animasi hemat (tanpa blur berat di APK), pertolongan khusus layar kecil & mode gelap." },
  { file: "src/app/layout.tsx", area: "Header & kaki halaman", note: "Header berpilin warna (navy→teal) dengan garis tepi bercahaya, logo + nama usaha kini tampil di HP juga, tombol 'Pekerjaan Baru' di layar lebar, kaki halaman dirapikan." },
  { file: "src/components/MainNav.tsx", area: "Navigasi", note: "Menu desktop berada di dalam wadah pil dengan penanda aktif; tablet memakai ikon saja (anti berdesakan); menu bawah HP diberi garis penanda + tombol 'Baru' menonjol." },
  { file: "src/components/UserMenu.tsx", area: "Menu akun", note: "Kartu identitas di bagian atas dropdown, penanda status aktif, bisa ditutup dengan Esc/klik luar, tautan pintas sesuai hak akses." },
  { file: "src/components/MoreMenu.tsx", area: "Menu titik tiga", note: "Isi dikelompokkan (Harian / Sistem & pemilik) dengan ikon berbingkai, ditambah entri halaman ini." },
  { file: "src/components/ui.tsx", area: "Komponen kartu", note: "Badge status/prioritas/risiko lebih tegas, KPI memakai rel warna, kartu pekerjaan ditata ulang: rel status, StageRail tahap, chip deadline, alasan & saran, deret tombol berwarna." },
  { file: "src/app/page.tsx", area: "Dashboard", note: "Sapaan mengikuti jam WIB, cincin jam hidup, blok 'Saran tindakan' berdampingan dengan ringkasan, KPI 6 kotak dengan tautan, daftar prioritas diberi nomor urut, sebaran tahap jadi dua kolom, kartu deadline hari ini." },
  { file: "src/app/pesanan/page.tsx", area: "Daftar pekerjaan", note: "Bilah filter menempel di atas (tab + cari + filter), chip 'filter aktif' yang bisa dilepas satu-satu, kartu HP diringkas, tabel desktop dengan kepala tabel menempel dan angka rata kanan." },
  { file: "src/components/QuickStatusPopup.tsx", area: "Popup ganti status", note: "Judul popup menampilkan status berjalan, tombol status diperbesar (area sentuh 46px) lengkap dengan bar progres tahap, panel menyesuaikan layar HP." },
  { file: "src/components/BrandMark.tsx", area: "Marka aplikasi", note: "Menggantikan ikon robot generik dengan mark cetak kustom (kertas keluar dari mesin + lampu siap), tetap terbaca pada ukuran kecil." },
  { file: "src/components/AppLogo.tsx", area: "Logo usaha", note: "Bingkai logo lebih halus, ukuran proporsional, logo usaha di basis data tetap jadi prioritas utama." },
  { file: "src/app/loading.tsx", area: "Muat halaman", note: "Kerangka muat (skeleton) mengikuti bentuk halaman, tidak lagi layar kosong berkedip." },
  { file: "src/app/login/page.tsx", area: "Halaman login", note: "Dua panel: brand + penjelasan singkat di kiri, form masuk di kanan. Rapi di tablet dan HP." },
  { file: "src/app/revisi-ui/page.tsx", area: "Halaman ini", note: "Daftar changes, langkah pasang, dan tombol unduh berkas revisi." },
  { file: "tsconfig.json", area: "Konfigurasi", note: "Menambahkan folder public ke daftar 'exclude' supaya salinan berkas di public tidak ikut diperiksa ganda." },
];

const UNTOUCHED =
  "Seluruh aturan bisnis TIDAK diubah: logika login & hak akses, API (/api/*), skema basis data, rumus risiko, web push, PWA/service worker, halaman detail, form order baru, serah terima shift, produksi mitra, audit, ekspor CSV, dan panduan.";

function bytesLabel(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export default function RevisiUiPage() {
  const zipPath = join(process.cwd(), "public", "revisi-ui", "printflow-revisi-ui.zip");
  const present = existsSync(zipPath);
  const info = present ? statSync(zipPath) : null;

  return (
    <div className="space-y-5">
      <section className="relative isolate overflow-hidden rounded-[1.4rem] border border-teal-400/25 bg-[#07384f] p-5 text-white shadow-[0_22px_60px_-28px_rgba(2,26,36,.9)] md:p-7">
        <span aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(125deg,rgba(20,184,166,.4),transparent_46%,rgba(251,191,36,.18))]" />
        <span aria-hidden="true" className="absolute -bottom-20 -right-12 -z-10 h-36 w-36 rotate-12 rounded-[2rem] bg-amber-300/85" />

        <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/12 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-amber-200">
          <Sparkles size={12} /> Revisi UI — tampilan saja, data tetap aman
        </p>
        <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight md:text-4xl">Berkas Revisi Print Flow</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cyan-50/80">
          Semua berkas di bawah sudah disusun ulang rapi dan siap dipakai: salin ke repository Anda, <em>push</em> ke
          GitHub, dan Vercel akan men-deploy ulang sendiri. Struktur folder & nama berkas disamakan persis dengan repo
          aslinya, jadi tidak ada yang perlu dipindah-pindahkan.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {present ? (
            <a href={ZIP_URL} download className="btn-primary !bg-amber-400 !text-[#07384f] hover:!bg-amber-300">
              <Download size={16} strokeWidth={2.8} /> Unduh proyek lengkap (.zip)
            </a>
          ) : (
            <span className="chip border-amber-300/40 bg-amber-300/15 text-amber-100">
              Berkas .zip belum ada — gunakan salinan di {MIRROR_DIR}
            </span>
          )}
          <span className="money inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-cyan-50/85">
            <FolderTree size={12} />
            {info ? `${CHANGED.length} berkas revisi · ${bytesLabel(info.size)}` : `${CHANGED.length} berkas revisi`}
          </span>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="card !p-0 overflow-hidden">
            <h2 className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-sm font-extrabold text-[#07384f] dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-slate-100">
              <Paintbrush size={16} className="text-teal-600 dark:text-teal-300" /> Yang berubah per area
            </h2>
            <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {CHANGED.map((c) => (
                <li key={c.file} className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-teal-50/40 dark:hover:bg-white/[0.04] sm:flex-row sm:gap-4">
                  <span className="money w-[240px] shrink-0 break-all text-[11px] font-black text-teal-700 dark:text-teal-300">
                    {c.file}
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-[.08em] text-slate-400">{c.area}</span>
                  </span>
                  <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{c.note}</p>
                </li>
              ))}
            </ul>
            <p className="border-t border-slate-100 bg-emerald-50/60 px-4 py-3 text-[11px] leading-relaxed font-semibold text-emerald-900 dark:border-white/[0.07] dark:bg-emerald-500/10 dark:text-emerald-100">
              <Check size={12} className="mr-1 inline text-emerald-600 dark:text-emerald-300" />
              {UNTOUCHED}
            </p>
          </div>

          <div className="card">
            <h2 className="section-title flex items-center gap-2">
              <MousePointerClick size={18} className="text-amber-500" /> Yang bisa langsung Anda rasakan
            </h2>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {[
                { icon: LayoutDashboard, title: "Dashboard 30 detik", text: "Sapaan sesuai jam, angka penting besar, urutan kerja bernomor, dan tenggat berwarna." },
                { icon: ClipboardList, title: "Filter menempel", text: "Tab, pencarian, dan penyaring tetap terlihat saat daftar panjang digulir." },
                { icon: Smartphone, title: "Nyaman di HP & APK", text: "Area sentuh minimal 44px, penanda menu bawah, tanpa efek blur yang bikin scroll patah." },
                { icon: Navigation, title: "Kontras dijaga", text: "Teks abu-terang di mode gelap dinaikkan agar terbaca, cincin fokus untuk keyboard." },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 transition hover:-translate-y-0.5 hover:border-teal-200 dark:border-white/[0.07] dark:bg-white/[0.03]">
                    <span className="icon-tile"><Icon size={17} /></span>
                    <p className="mt-2 text-[13px] font-extrabold text-[#07384f] dark:text-slate-100">{f.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{f.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="card">
            <h2 className="section-title flex items-center gap-2">
              <LogIn size={18} className="text-teal-600 dark:text-teal-300" /> Cara memasang (5 langkah)
            </h2>
            <ol className="mt-3 space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {[
                ["Unduh & buka", "Unduh berkas .zip di atas, lalu ekstrak di folder kosong. Isinya satu proyek utuh dengan struktur sama seperti repo Anda."],
                ["Timpa berkas lama", "Salin folder src, public, dan berkas konfigurasi (tsconfig.json, next.config.ts, dsb.) ke repository printflow_public Anda, pilih 'replace/timpa'."],
                ["Cek lokal (opsional)", "Jalankan npm install lalu npm run dev. Kalau muncul error, jalankan node ./api/setup sekali lewat browser untuk menyamakan tabel."],
                ["Push ke GitHub", "git add . → git commit -m 'revisi UI' → git push. Jangan ubah variabel lingkungan di Vercel, tidak ada env baru yang dibutuhkan."],
                ["Deploy & bersihkan", "Vercel deploy otomatis. Setelah berhasil, buka aplikasi dari HP → tutup tab lama agar tampilan baru dipakai. Ikon APK tidak berubah, jadi tidak perlu bikin ulang APK."],
              ].map(([title, text], i) => (
                <li key={title} className="flex gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(150deg,#0d9488,#0f766e)] text-[11px] font-black text-white">
                    {i + 1}
                  </span>
                  <span>
                    <strong className="font-extrabold text-slate-800 dark:text-slate-100">{title}.</strong> {text}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
              Tidak ada perubahan basis data maupun penambahan paket baru pada revisi ini — jadi tidak perlu menyentuh
              Neon maupun package.json.
            </p>
          </div>

          <div className="card !p-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-white/[0.07]">
              <h3 className="text-sm font-extrabold text-[#07384f] dark:text-slate-100">Berkas cadangan di lingkungan ini</h3>
              <span className={`chip ${present ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                {present ? "zip tersedia" : "zip belum dibuat"}
              </span>
            </div>
            <div className="space-y-2 p-4 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              <p>
                Selain .zip, seluruh berkas hasil revisi juga tersedia satu per satu di folder
                <code className="money mx-1 rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">{MIRROR_DIR}</code>
                pada project ini — cocok kalau Anda hanya mau menimpa sebagian berkas.
              </p>
              <p>Tautan langsung: <code className="money rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">{ZIP_URL}</code></p>
            </div>
          </div>

          <div className="card">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Lanjut ke</p>
            <div className="mt-2.5 grid gap-2">
              <Link href="/" className="btn-ghost justify-start">Kembali ke dashboard</Link>
              <Link href="/catatan-perubahan" className="btn-ghost justify-start">Catatan perubahan versi</Link>
              <Link href="/panduan" className="btn-ghost justify-start">Panduan Neon, GitHub & Vercel</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
