# 📘 Panduan Lengkap (Bahasa Awam): Menjalankan Aplikasi Monitoring Percetakan AI

> Aplikasi: **Print Flow** — monitoring pekerjaan percetakan bertenaga AI.
> Target pembaca: **pemilik percetakan yang bukan programmer**.
> Semua langkah ditulis seperti ditemani teman: klik apa, copy apa, tempel di mana.

---

## Daftar Isi

1. [Apa saja yang sudah jadi di aplikasi ini](#1-apa-saja-yang-sudah-jadi)
2. [PRD / Konsep Produk (dokumen rencana)](#2-prd--konsep-produk)
3. [Cara kerja AI-nya (dibahas sederhana)](#3-cara-kerja-ai-nya)
4. [Peta besar sistem (siapa nyimpen apa)](#4-peta-besar-sistem)
5. [Persiapan: 3 akun yang Anda butuhkan](#5-persiapan-3-akun)
6. [LANGKAH A — Upload project ke GitHub (file apa saja?)](#6-langkah-a--upload-project-ke-github)
7. [LANGKAH B — Setup database di Neon](#7-langkah-b--setup-database-di-neon)
8. [LANGKAH C — Membuat tabel di database (tanpa coding)](#8-langkah-c--membuat-tabel-di-database)
9. [LANGKAH D — Deploy ke Vercel](#9-langkah-d--deploy-ke-vercel)
10. [LANGKAH E — Update aplikasi di kemudian hari](#10-langkah-e--update-aplikasi-di-kemudian-hari)
11. [LANGKAH F — Pasang di HP Android jadi aplikasi (APK)](#11-langkah-f--pasang-di-hp-android-jadi-aplikasi)
12. [LANGKAH G — Mengaktifkan AI Bahasa (opsional, tapi keren)](#12-langkah-g--mengaktifkan-ai-bahasa)
13. [Daftar file: yang DIUPLOAD dan yang JANGAN](#13-daftar-file-yang-diupload-dan-yang-jangan)
14. [Cara pakai harian (SOP percetakan)](#14-cara-pakai-harian-sop-percetakan)
15. [Troubleshooting: error & solusinya](#15-troubleshooting-error--solusinya)
16. [Biaya & batas gratis](#16-biaya--batas-gratis)
17. [Kamus istilah teknis](#17-kamus-istilah-teknis)
18. [Roadmap pengembangan berikutnya](#18-roadmap-pengembangan-berikutnya)

---

## 1. Apa saja yang sudah jadi

Aplikasi web yang **sudah berjalan penuh** (bukan mockup). Fitur yang bisa langsung dipakai:

| Fitur | Penjelasan awam |
|---|---|
| **Dashboard** | Satu layar menampilkan kondisi percetakan hari ini: berapa pekerjaan jalan, berapa terlambat, berapa siap diambil, nilai order, dan pembayaran masuk. |
| **Input pekerjaan** | Form 3 langkah: pelanggan → detail cetakan → deadline & harga. AI otomatis memperkirakan jam kerja. |
| **Alur status 9 tahap** | Antrian → Desain/Proof → Cetak → Finishing → QC → Siap Diambil → Selesai. Plus status khusus: *Ditunda* dan *Dibatalkan*. |
| **Riwayat (audit trail)** | Setiap perubahan status dicatat: siapa, kapan, catatan apa. Berguna saat pelanggan menagih/berkelahi soal progress. |
| **Analisa risiko AI** | Setiap pekerjaan diberi **skor risiko 0–100** + penjelasan "kenapa" + **saran tindakan** dalam bahasa Indonesia. |
| **Tanya AI (chat)** | Anda bisa menulis: *"kerjaan siapa yang paling mepet?"* atau *"siapa saja yang sudah siap diambil?"* AI menjawab dari data Anda sendiri. |
| **Data pelanggan** | Buku pelanggan + total transaksi + jumlah pekerjaan aktif per pelanggan. |
| **PWA (bisa dipasang di HP)** | Tampil seperti aplikasi, bisa dibuat **APK Android** lewat PWABuilder (ada langkahnya di bawah). |
| **Siap deploy** | Siap dipasang di **Vercel** dengan database **Neon PostgreSQL**, dan siap di-push ke **GitHub**. |

> ✅ Aplikasi ini **responsif**: nyaman dipakai di laptop (desktop) dan di HP (mobile).

---

## 2. PRD / Konsep Produk

*(Bagian ini adalah dokumen rencana — boleh dibaca sekali lalu disimpan.)*

### 2.1 Ringkasan Produk

- **Nama:** Print Flow
- **Kalimat satu kalimat:** Aplikasi monitoring produksi percetakan yang memberi tahu pemilik pekerjaan mana yang berisiko telat, kenapa, dan apa yang harus dilakukan hari ini.
- **Masalah yang diselesaikan:**
  - Status pekerjaan tersebar di WhatsApp, catatan buku, dan ingatan karyawan.
  - Pemilik baru tahu pekerjaan telat **setelah** pelanggan komplain.
  - Tidak ada data: berapa order masuk per hari, siapa pelanggan paling untung, berapa piutang.
- **Solusi:** satu tempat untuk memasukkan order, mengubah status produksi, dan membiarkan AI menghitung risiko + memberi rekomendasi.

### 2.2 Siapa penggunanya (Persona)

| Persona | Kebutuhan | Yang dipakai di aplikasi |
|---|---|---|
| **Pemilik / Owner (Anda)** | Tahu kondisi semua pekerjaan dalam 30 detik, dari HP | Dashboard, prioritas AI, Tanya AI |
| **Operator mesin** | Tahu pekerjaan apa yang harus dikerjakan sekarang | Halaman Pekerjaan (urut deadline), tombol update status |
| **Kasir / CS** | Menjawab "pesanan saya sudah sampai mana?" | Detail pekerjaan → riwayat status |
| **Pelanggan** (tidak login) | Tahu status pesanan | (Tahap 2) halaman lacak publik |

### 2.3 Ruang lingkup MVP (yang sudah dibangun)

1. CRUD pekerjaan (buat, ubah, ubah status, hapus).
2. Pipeline status produksi + progress otomatis.
3. Risiko & rekomendasi AI per pekerjaan.
4. Ringkasan harian AI + chat tanya jawab.
5. Data pelanggan & nilai transaksi.
6. PWA + siap APK.

### 2.4 Tahap 2 (setelah aplikasi stabil dipakai 2–4 minggu)

- Login multi-user (Owner / Operator / Kasir) dengan peran berbeda.
- Notifikasi WhatsApp / Telegram otomatis saat status berubah atau pekerjaan hampir telat.
- Halaman lacak publik untuk pelanggan (`/lacak/PJ-2026-0001`).
- Upload berkas desain (revisi v1, v2) ke storage.
- Manajemen stok bahan (kertas, tinta, meteran bahan spanduk).
- Laporan bulanan: omzet per produk, pelanggan teratas, laba kotor, SLA ketepatan waktu.
- Barcode/QR di rak penyelesaian: scan → status jadi "siap diambil".

### 2.5 Alur kerja (User Flow utama)

```
Pelanggan datang / WA masuk
        │
        ▼
[Owner] Buka aplikasi → ➕ Pekerjaan Baru
   isi: pelanggan, jenis cetak, jumlah, deadline, harga, DP
        │
        ▼
Sistem membuat kode pekerjaan (contoh: PJ-2026-0001)
Status awal: 📥 Antrian
        │
        ▼
[Operator] klik "▶️ Lanjut ke: Desain" → lalu Cetak → Finishing → QC
   (tiap klik + catatan otomatis tersimpan di riwayat)
        │
        ▼
Status 📦 Siap Diambil → kasir memberi tahu pelanggan
        │
        ▼
Status ✅ Selesai (pelanggan sudah bayar sisa)
        │
        ▼
Dashboard AI terus menghitung: siapa yang mepet, siapa telat,
apa yang harus dikerjakan duluan.
```

### 2.6 Model data (struktur tabel)

| Tabel | Isi | Kegunaan |
|---|---|---|
| `customers` | nama, WhatsApp, email, alamat, catatan | Buku pelanggan |
| `orders` | kode, judul, jenis produk, jumlah, satuan, mesin, operator, status, prioritas, harga, DP, tanggal & jam deadline, estimasi jam kerja, catatan | Satu baris = satu pekerjaan cetak |
| `order_events` | pekerjaan, status lama, status baru, catatan, aktor, waktu | Riwayat/jejak produksi |
| `ai_notes` | pekerjaan, skor risiko, level risiko, pesan, sumber | Arsip saran AI, bisa dibaca ulang |
| `settings` | key–value | Simpan preferensi ringan |

### 2.7 Status produksi & bobot progres

| Status | Emoji | Progres | Artinya |
|---|---|---|---|
| `antrian` | 📥 | 5% | Order sudah dicatat, belum dikerjakan |
| `desain` | 🎨 | 18% | Desain/proof sedang dibuat atau menunggu OK pelanggan |
| `cetak` | 🖨️ | 45% | Sedang dicetak |
| `finishing` | ✂️ | 70% | Potong, laminasi, jilid, sablon lanjutan |
| `qc` | 🔍 | 85% | Pengecekan kualitas & jumlah |
| `siap` | 📦 | 95% | Sudah bisa diambil/dikirim |
| `selesai` | ✅ | 100% | Sudah diserahkan (tidak dihitung beban) |
| `ditunda` | ⏸️ | 10% | Menunggu approval/bahan/pelunasan |
| `batal` | ⛔ | 0% | Dibatalkan (tidak dihitung) |

### 2.8 Metrik sukses (cara tahu aplikasi ini berguna)

- **% pekerjaan selesai tepat waktu** naik dari baseline Anda (target: ≥ 90% dalam 2 bulan).
- **Waktu menjawab pelanggan** "pesanan saya mana?" turun dari menit-menit → 5 detik.
- **Jumlah pekerjaan telat yang "diselamatkan"** karena diperingatkan AI ≥ 1 minggu sebelumnya.
- **Piutang tertagih** lebih cepat karena sisa tagihan terlihat jelas.

---

## 3. Cara kerja AI-nya

Ada **dua lapis**, supaya aplikasi tetap pintar walau tanpa API berbayar:

### Lapis 1 — Mesin Analisa (selalu aktif, gratis, tanpa internet ke luar)
Dihitung di server dari data Anda sendiri:

1. **Sisa pekerjaan** = estimasi jam kerja × (100% − progres sekarang).
2. **Sisa waktu** = selisih deadline dengan waktu sekarang (dalam jam).
3. **Kapasitas efektif** = sisa waktu × 35% *(asumsi realistis: tidak semua jam adalah jam kerja produktif — ada malam, istirahat, pekerjaan lain)*.
4. **Skor risiko** = bandingkan sisa pekerjaan vs kapasitas efektif, lalu tambah bobot prioritas (Urgent +15, Tinggi +8, Rendah −6).
5. **Interpretasi otomatis** menjadi kalimat awam + saran tindakan.

| Skor | Level | Artinya bagi Anda |
|---|---|---|
| 0–34 | 🟢 Aman | Ritme normal, cek besok lagi |
| 35–64 | 🟡 Waspada | Margin tipis, kunci approval desain sekarang |
| 65–89 | 🟠 Berisiko telat | Tambah shift / pindah mesin / kabari pelanggan |
| 90–100 | 🔴 Terlambat | Sudah lewat deadline → hubungi pelanggan hari ini |

### Lapis 2 — AI Bahasa (opsional)
Jika Anda menaruh kunci API (`OPENAI_API_KEY` atau `ANTHROPIC_API_KEY`) di Vercel, pertanyaan & ringkasan harian dibuat oleh model bahasa (GPT / Claude) yang membaca **ringkasan data Anda** (kode, status, deadline, skor risiko) — bukan data pribadi lain. Jika API gagal/tidak ada, aplikasi otomatis memakai Lapis 1. **Jadi tidak akan pernah error.**

---

## 4. Peta besar sistem

```
┌─────────────────────────┐        ┌──────────────────────────┐
│  HP Android / Laptop    │        │  Vercel (server aplikasi) │
│  Browser / PWA / APK    │ ─────▶ │  Next.js + API Routes     │
└─────────────────────────┘        │  • halaman dashboard      │
                                   │  • logika AI & risiko     │
                                   └───────────┬──────────────┘
                                               │ koneksi terenkripsi (sslmode=require)
                                               ▼
                                   ┌──────────────────────────┐
                                   │  Neon PostgreSQL          │
                                   │  (penyimpanan data)       │
                                   └──────────────────────────┘

  GitHub  = tempat menyimpan "resep/kode" aplikasi
  Vercel  = mengambil kode dari GitHub lalu menjalankannya di internet
  Neon    = tempat menyimpan data (pelanggan, pekerjaan, riwayat)
```

Analogi restoran:
- **GitHub** = buku resep.
- **Vercel** = dapur + pelayan yang melayani pelanggan.
- **Neon** = lemari penyimpanan bahan & catatan pesanan.

---

## 5. Persiapan: 3 akun

Semua punya paket gratis yang cukup untuk percetakan kecil–menengah.

| Akun | Untuk apa | Daftar dengan |
|---|---|---|
| **GitHub** (github.com) | Menyimpan kode aplikasi | Email (gratis) |
| **Neon** (neon.com) | Database PostgreSQL | Email atau login dengan GitHub |
| **Vercel** (vercel.com) | Menjalankan aplikasi di internet | **Login dengan GitHub (paling mudah)** |

> 💡 Saran: pakai **satu email yang sama** untuk ketiganya supaya tidak bingung.

---

## 6. LANGKAH A — Upload project ke GitHub

### A1. Download project dari platform ini
Di platform AI tempat aplikasi ini dibuat, **download semua file project** (biasanya ada tombol *Download ZIP* / *Export*). Ekstrak di komputer, nanti muncul folder berisi file aplikasi.

### A2. Buat repository baru
1. Buka **github.com** → login.
2. Klik tombol **`+`** di kanan atas → **New repository**.
3. Isi:
   - **Repository name:** `print-flow`
   - **Description:** `Aplikasi monitoring produksi percetakan bertenaga AI`
   - Visibilitas: **Private** (disarankan, karena ini aplikasi usaha Anda)
4. Jangan centang "Add a README file" (karena project sudah punya file sendiri).
5. Klik **Create repository**. Biarkan halaman itu terbuka.

### A3. Upload file (cara paling mudah, tanpa install apa pun)
1. Di halaman repository kosong tadi, klik link **"uploading an existing file"**.
2. **Buka folder project** di komputer, lalu **seret (drag) SEMUA isi folder** ke area upload browser.
   - ⚠️ **PENTING:** Jangan ikut meng-upload folder `node_modules`, `.next`, dan `.git`. File `.gitignore` yang sudah ada di project akan otomatis mengabaikannya — tetapi drag-drop manual tidak membaca `.gitignore`, jadi **buang dulu** folder tersebut sebelum drag:
     - `node_modules` → boleh **dihapus** dari komputer (nanti dibuat ulang otomatis).
     - `.next` → boleh dihapus.
     - `.git` → boleh dihapus (kalau ada).
   - File tersembunyi seperti `.env.example`, `.gitignore`, `eslint.config.mjs` **tetap di-upload** (kecuali `.env`, lihat peringatan di bawah).
3. Tunggu sampai semua file terunggah.
4. Di bawah, tulis: **Commit message** = `Initial commit: aplikasi monitoring percetakan AI`.
5. Pastikan terpilih **Commit directly to the main branch** → klik **Commit changes**.

> 🚨 **JANGAN PERNAH upload file `.env`** (file berisi password database).
> Jika sudah terlanjur, hapus file itu di GitHub, lalu **ganti password database** di Neon.

### A4. Cek hasilnya
Setelah selesai, di halaman repository Anda harus terlihat folder & file seperti ini:

```
print-flow/
├─ public/
│  ├─ panduan-deploy-neon-vercel.md   ← file panduan yang sedang Anda baca
│  ├─ manifest.webmanifest            ← supaya bisa dipasang di HP
│  └─ icon-512.png                    ← logo aplikasi
├─ src/
│  ├─ app/
│  │  ├─ api/
│  │  │  ├─ ai/route.ts
│  │  │  ├─ customers/route.ts
│  │  │  ├─ health/route.ts
│  │  │  ├─ orders/route.ts
│  │  │  ├─ orders/[id]/route.ts
│  │  │  └─ setup/route.ts
│  │  ├─ pesanan/
│  │  │  ├─ page.tsx
│  │  │  ├─ baru/page.tsx
│  │  │  └─ [id]/page.tsx
│  │  ├─ pelanggan/page.tsx
│  │  ├─ panduan/page.tsx
│  │  ├─ globals.css
│  │  ├─ layout.tsx
│  │  └─ page.tsx
│  ├─ components/
│  │  ├─ AiAssistant.tsx
│  │  ├─ CustomerForm.tsx
│  │  ├─ MainNav.tsx
│  │  ├─ NewOrderForm.tsx
│  │  ├─ OrderControls.tsx
│  │  └─ ui.tsx
│  ├─ db/
│  │  ├─ index.ts
│  │  └─ schema.ts
│  └─ lib/
│     ├─ ai.ts
│     ├─ domain.ts
│     └─ queries.ts
├─ .env.example
├─ .gitignore
├─ drizzle.config.json
├─ eslint.config.mjs
├─ next.config.ts
├─ package.json
├─ postcss.config.mjs
├─ README.md
└─ tsconfig.json
```

### A5. Alternatif cara profesional (opsional, jika mau rapi)
Kalau Anda mau cara yang dipakai programmer (lebih cepat untuk update berikutnya), install **GitHub Desktop** (desktop.github.com):
1. File → **Add local repository** → pilih folder project.
2. Klik **Create a repository** bila diminta.
3. Klik **Commit to main**, lalu **Publish repository**.
4. Untuk update berikutnya: ubah file → buka GitHub Desktop → tulis keterangan → **Commit** → **Push origin**. Selesai.

---

## 7. LANGKAH B — Setup database di Neon

### B1. Buat akun & project
1. Buka **https://neon.com** → **Sign Up** → pilih **Continue with GitHub** (paling cepat).
2. Setelah masuk dashboard, klik **Create project** (atau **New Project**).
3. Isi:
   - **Project name:** `print-flow`
   - **PostgreSQL version:** biarkan default (16 atau 17)
   - **Cloud region:** pilih **Singapore** (`aws-ap-southeast-1`) → paling dekat & tercepat untuk Indonesia
4. Klik **Create project**.
5. Akan muncul popup **"Connect to your database"** → **biarkan terbuka**, kita butuh isinya di B2.

### B2. Copy Connection String (ini "alamat + kunci" database Anda)
Di popup koneksi:

1. Pastikan **pooled connection** aktif (ada tulisan *Pooled* / atau URL mengandung `-pooler`). Ini yang paling cocok untuk Vercel.
2. Klik tombol **Copy** pada connection string. Bentuknya seperti ini:

```
postgresql://neondb_owner:AbCdEfGh1234@ep-cool-name-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

Bagian-bagian artinya:
| Potongan | Arti |
|---|---|
| `postgresql://` | jenis database |
| `neondb_owner:AbCdEfGh1234` | nama user : password |
| `ep-cool-name-123456-pooler.ap-southeast-1.aws.neon.tech` | alamat server (pooler = koneksi hemat, pas untuk Vercel) |
| `/neondb` | nama database |
| `?sslmode=require` | wajib koneksi terenkripsi (jangan dihapus!) |

3. Tempel di **Notepad** dulu, beri nama `DATABASE_URL`. Simpan baik-baik, ini rahasia.

> ℹ️ Ada dua URL di Neon: **Pooled** (untuk aplikasi/Vercel — pakai yang ini) dan **Direct** (untuk migrasi skema/klien GUI). Keduanya mengarah ke data yang sama.

### B3. Simpan password dengan aman
- Simpan di **password manager** atau catatan pribadi.
- Jangan kirim lewat grup WhatsApp.
- Jika bocor: Neon → **Dashboard → Roles &/System → Reset password**.

---

## 8. LANGKAH C — Membuat tabel di database

Aplikasi ini punya **tombol ajaib** supaya Anda tidak perlu mengetik perintah teknis: halaman `/api/setup`.

### C1. Sebelum deploy (opsional, kalau ingin mencoba dulu di komputer)
Lewati bagian ini jika Anda tidak familiar dengan terminal — langsung ke C2 setelah deploy. (Inilah untungnya aplikasi web.)

### C2. Setelah deploy ke Vercel (cara utama)
1. Selesaikan dulu **LANGKAH D** (deploy ke Vercel).
2. Buka browser, ketik alamat Anda lalu tambahkan `/api/setup`:

```
https://nama-aplikasi-anda.vercel.app/api/setup
```

3. Akan muncul tulisan JSON seperti ini:

```json
{ "ok": true, "message": "Database siap. Semua tabel sudah dibuat.", "tables": ["customers","orders","order_events","ai_notes","settings"] }
```

4. Selesai! Tabel sudah jadi di Neon. Selanjutnya buka halaman utama aplikasi Anda.

> 🧩 Perintah ini **aman dijalankan berulang kali** (tidak akan menghapus data). Kalau Anda ingin sekaligus mengisi contoh data untuk belajar, buka:
> `https://nama-aplikasi-anda.vercel.app/api/setup?seed=1`
> Nanti ada 5 pelanggan & 8 pekerjaan contoh (termasuk yang telat) supaya dashboard langsung terlihat hidup. Data contoh bisa dihapus dengan menghapus pekerjaannya satu per satu.

### C3. Cara alternatif dengan komputer (jika Anda mau belajar)
Kalau Anda nyaman membuka *Command Prompt* / *Terminal*, dan sudah install **Node.js LTS** (nodejs.org):

```bash
# 1. masuk ke folder project
cd path/ke/folder/project

# 2. install dependensi
npm install

# 3. buat file .env (copy dari contoh), lalu isi DATABASE_URL dari Neon
#    Windows (PowerShell):  copy .env.example .env
#    Mac/Linux:             cp .env.example .env

# 4. buat tabel langsung di Neon
npx drizzle-kit push --dialect=postgresql --schema=./src/db/schema.ts --url="TEMPEL_CONNECTION_STRING_NEON_DISINI"

# 5. coba jalankan di komputer
npm run dev
# lalu buka http://localhost:3000
```

Jika muncul `✔ Changes applied`, berarti tabel sudah dibuat.

---

## 9. LANGKAH D — Deploy ke Vercel

### D1. Import project
1. Buka **https://vercel.com** → **Continue with GitHub** → izinkan akses.
2. Di dashboard, klik **Add New… → Project**.
3. Di daftar repository, cari `print-flow` → klik **Import**.
   - Jika tidak muncul, klik **Adjust GitHub App Permissions** → pilih repository Anda → Save.

### D2. Isi Environment Variables (INI PALING PENTING)
Di halaman **Configure Project**, buka bagian **Environment Variables**, lalu tambahkan:

| Name | Value | Keterangan |
|---|---|---|
| `DATABASE_URL` | `postgresql://neondb_owner:xxxx@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | Connection string **Pooled** dari Neon (langkah B2). Tempel persis, tanpa spasi di awal/akhir. |

*(Opsional)* Tambahkan juga:

| Name | Value | Keterangan |
|---|---|---|
| `OPENAI_API_KEY` | `sk-…` | Agar chat AI memakai bahasa GPT. Kosongkan jika tidak ingin (aplikasi tetap jalan). |
| `ANTHROPIC_API_KEY` | `sk-ant-…` | Alternatif selain OpenAI. Cukup salah satu. |
| `SETUP_TOKEN` | `rahasia-anda-123` | Opsional: mengunci halaman `/api/setup` supaya hanya Anda yang bisa menjalankannya (panggil dengan `?token=rahasia-anda-123`). |

> ⚠️ Jangan centang/mengisi sesuatu yang tidak dipahami. Cukup variabel di atas.

### D3. Deploy
1. Klik **Deploy**.
2. Tunggu 1–3 menit. Status akan berubah menjadi **Building → Finishing → Ready** dengan animasi konfeti 🎉.
3. Klik **Continue to Dashboard**, lalu klik alamat yang muncul, contoh: `https://print-flow.vercel.app`.

### D4. Cek 4 hal ini (5 menit terakhir yang menentukan)
| Cek | Cara | Hasil benar |
|---|---|---|
| 1. Database terhubung | Buka `https://app-anda.vercel.app/api/health` | `{"ok":true}` |
| 2. Tabel sudah dibuat | Buka `https://app-anda.vercel.app/api/setup` | `{"ok":true,...}` |
| 3. Halaman utama | Buka alamat utama | Dashboard tampil, tanpa tulisan error |
| 4. Coba buat pekerjaan | Klik **➕ Pekerjaan Baru**, isi, simpan | Muncul kode `PJ-2026-0001` |

> Kalau langkah 3 gagal tapi langkah 1 & 2 sukses, biasanya tinggal menunggu 1 menit lalu **Refresh**. Jika masih error, lihat [Troubleshooting](#15-troubleshooting-error--solusinya).

### D5. (Opsional) Pasang domain sendiri, misal `monitor.percetakananda.com`
1. Di Vercel: **Project → Settings → Domains → Add** → ketik domain Anda → **Add**.
2. Vercel akan menampilkan beberapa catatan DNS (misal `cname.vercel-dns.com`).
3. Buka pengaturan DNS tempat Anda membeli domain (Cloudflare/Namecheap/Niagahoster/dll) → **DNS Management → Add Record** → tempel catatan dari Vercel.
4. Tunggu 5–30 menit. Vercel otomatis memasang sertifikat HTTPS gratis.

---

## 10. LANGKAH E — Update aplikasi di kemudian hari

Cara kerjanya otomatis: **setiap kali kode baru masuk ke branch `main` di GitHub, Vercel langsung membangun ulang aplikasi** (waktu ±2 menit). Anda tidak perlu menyentuh Vercel lagi.

1. Ubah file di GitHub (klik file → ikon pensil ✏️ → ubah → **Commit changes**), atau push dari GitHub Desktop.
2. Buka tab **Deployments** di Vercel → lihat proses berjalan.
3. Selesai: alamat aplikasi Anda sudah versi baru.

> 💡 Tips aman: sebelum mengubah kode, catat apa yang diubah. Kalau hasilnya error, di tab **Deployments** Anda bisa klik deploy sebelumnya → **⋯ → Promote to Production** untuk mengembalikan versi baik.

---

## 11. LANGKAH F — Pasang di HP Android jadi aplikasi (APK)

Aplikasi ini sudah dibuat sebagai **PWA** (Progressive Web App), jadi ada **dua cara**:

### Cara 1 — Pasang langsung (tanpa APK, 10 detik) ✅ paling disarankan
1. Buka alamat aplikasi Anda di **Chrome** HP Android.
2. Ketuk menu **⋮** (tiga titik) → **Tambahkan ke layar utama / Install app**.
3. Konfirmasi. Ikon aplikasi muncul di home screen, buka **layar penuh seperti aplikasi asli**, dan tetap bisa dipakai saat sinyal lemot (halaman yang sudah dibuka).
4. Untuk iPhone: buka di **Safari** → tombol **Bagikan** → **Add to Home Screen**.

### Cara 2 — Bikin file APK beneran (bisa dibagikan ke karyawan)
Gunakan layanan gratis **PWABuilder** (milik Microsoft):

1. Buka **https://www.pwabuilder.com**.
2. Tempel alamat aplikasi Anda (misal `https://print-flow.vercel.app`) → klik **Start**.
3. Tunggu analisa selesai. Pastikan skor **Manifest** & **Service worker** terlihat (manifest sudah disiapkan aplikasi ini).
4. Klik **Package for stores** → pilih **Android**.
5. Isi data paket:
   - **Package ID:** `com.namaanda.printflow` (huruf kecil, tanpa spasi)
   - **App name:** `Print Flow`
   - **Version:** `1.0.0`
   - **Short name:** `Print Flow`
   - **Icon:** upload gambar 512×512 (file `public/icon-512.png` bisa dipakai)
6. Klik **Generate** → unduh file `.zip`.
7. Di dalam ZIP ada folder `android-app` berisi file **`app-release-signed.apk`**.
8. Kirim APK itu ke HP (WhatsApp/Drive) → buka → izinkan "Install unknown apps" → **Install**.
9. Ingin masuk **Google Play Store**? Di ZIP yang sama ada folder `signing`/`assetlinks` + instruksi. Anda perlu akun Google Play Console (biaya sekali bayar ± US$25). Ini opsional — Cara 1 dan APK sudah cukup untuk internal toko.

> ℹ️ Aplikasi APK hasil PWABuilder "membungkus" website Anda. Artinya: **kapan pun Anda update di Vercel, aplikasi di HP ikut ter-update tanpa install ulang.**

### Bonus: pintasan cepat di desktop (Windows)
Buka aplikasi di Chrome/Edge di laptop → ikon **⊕ / Install** di address bar → **Install**. Muncul jendela aplikasi sendiri di desktop.

---

## 12. LANGKAH G — Mengaktifkan AI Bahasa

Secara bawaan, Tanya AI memakai **mesin analisa internal** (gratis, tanpa kunci API). Hasilnya sudah cukup untuk kebutuhan monitoring. Jika ingin jawaban lebih bebas berbahasa:

### Pilihan 1: OpenAI (GPT)
1. Buat akun di **platform.openai.com** → menu **API keys** → **Create new secret key**.
2. Copy kunci (`sk-...`).
3. Vercel → **Project → Settings → Environment Variables** → tambah `OPENAI_API_KEY` = kunci tadi → **Save**.
4. **Deployments** → deploy terbaru → **⋯ → Redeploy**.

### Pilihan 2: Anthropic (Claude)
1. Buat akun di **console.anthropic.com** → **API Keys** → **Create Key**.
2. Copy kunci (`sk-ant-...`).
3. Vercel → tambah `ANTHROPIC_API_KEY` → Save → **Redeploy**.

> 🔒 Kunci API **hanya** disimpan di Vercel (server), tidak pernah dikirim ke browser pengguna. Aplikasi memanggil AI melalui route `/api/ai` milik sendiri, bukan langsung dari HP.
> 💡 Jika kuota/kunci bermasalah, aplikasi **otomatis kembali** ke mesin analisa internal — tidak error.

---

## 13. Daftar file yang diupload dan yang jangan

### ✅ WAJIB diupload ke GitHub

| File / Folder | Fungsi | Wajib? |
|---|---|---|
| `package.json` | Daftar "bahan" aplikasi + perintah jalan | ✅ wajib |
| `next.config.ts` | Pengaturan Next.js | ✅ wajib |
| `tsconfig.json` | Pengaturan TypeScript | ✅ wajib |
| `postcss.config.mjs` | Pengaturan Tailwind CSS | ✅ wajib |
| `eslint.config.mjs` | Pemeriksa kualitas kode | ✅ wajib |
| `drizzle.config.json` | Pengaturan koneksi untuk membuat tabel | ✅ wajib |
| `.gitignore` | Daftar file yang **tidak** boleh ikut GitHub | ✅ wajib |
| `.env.example` | Contoh variabel lingkungan (tanpa password asli) | ✅ wajib |
| `README.md` | Penjelasan singkat project | ✅ wajib |
| `src/db/schema.ts` | Bentuk tabel database | ✅ wajib |
| `src/db/index.ts` | Penghubung aplikasi ↔ database | ✅ wajib |
| `src/lib/*` (`ai.ts`, `domain.ts`, `queries.ts`) | Otak AI, aturan status, akses data | ✅ wajib |
| `src/app/**` (semua halaman & API) | Tampilan & API aplikasi | ✅ wajib |
| `src/components/**` | Komponen UI (form, tombol status, chat AI) | ✅ wajib |
| `public/**` (panduan `.md`, `manifest.webmanifest`, `icon-512.png`) | Aset statis & panduan | ✅ wajib |

### ❌ JANGAN diupload ke GitHub

| File / Folder | Kenapa |
|---|---|
| `.env` | **Berisi password database & kunci API.** Inilah kunci rumah Anda. Diisi manual di Vercel. |
| `node_modules/` | Ribuan file hasil install, ukuran ratusan MB. Vercel membuatnya sendiri dari `package.json`. |
| `.next/` | Hasil build sementara. Dibuat ulang otomatis. |
| `.vercel/` | Info proyek lokal Vercel. |
| `.git/` | Riwayat versi internal (kalau Anda meng-clone, bukan download ZIP). |
| `*.log`, `npm-debug.log*` | Berkas catatan error yang tidak berguna. |
| `tsconfig.tsbuildinfo`, `next-env.d.ts` | Dibuat otomatis saat build (kalau ada, diabaikan oleh `.gitignore`). |

### 📄 Isi `.env.example` (boleh diupload) vs `.env` (rahasia)

```bash
# ====== .env.example (AMAN diupload) ======
# Salin file ini menjadi .env lalu isi nilainya.
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
# Opsional (untuk AI bahasa):
# OPENAI_API_KEY=sk-xxxx
# ANTHROPIC_API_KEY=sk-ant-xxxx
# Opsional (mengunci halaman /api/setup):
# SETUP_TOKEN=kata-rahasia-anda
```

```bash
# ====== .env (RAHASIA - hanya di komputer Anda & di Vercel) ======
DATABASE_URL=postgresql://neondb_owner:Passw0rdAsli@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

---

## 14. Cara pakai harian (SOP percetakan)

### Pagi (3 menit)
1. Buka aplikasi (HP/laptop) → lihat **Ringkasan AI**.
2. Baca bagian **"Tindakan yang disarankan hari ini"** → kerjakan dari atas.
3. Cek **🔴 Terlambat** & **🟠 Berisiko** → kirim pesan ke pelanggan *sebelum* mereka menanyakan.

### Datang order baru (1 menit)
1. **➕ Pekerjaan Baru** → pilih/ketik pelanggan → isi detail & deadline → simpan.
2. Catat DP di kolom *sudah dibayar*.
3. (Nanti bisa ditambah: kirim kode pekerjaan ke pelanggan.)

### Selama produksi (5 detik per tahap)
1. Buka pekerjaan → klik **▶️ Lanjut ke: …** setiap selesai tahap.
2. Tulis catatan bila ada hal penting (misal *"tinta habis, pindah mesin"*).
3. Kalau pelanggan belum OK desain → status **⏸️ Ditunda** supaya tidak ikut menghitung beban.

### Sore / saat serah terima (1 menit)
1. Status **✅ Selesai** setelah barang diterima.
2. Update *sudah dibayar* sampai lunas → **sisa tagihan** jadi Rp 0.
3. Lihat dashboard: berapa nilai order aktif hari ini & berapa piutang.

### 14.Z 🖼️ Fitur lampiran foto per pekerjaan

Karena nama pekerjaan sering mirip (misal "Spanduk 3x1" untuk tiga pelanggan berbeda), setiap pekerjaan
bisa dilampiri **foto**. Berguna untuk: desain/referensi, hasil jadi (sebelum diserahkan), dan nota.

**Cara pakai:**
1. Buka pekerjaan → cari card **🖼️ Foto Pekerjaan** (di bawah riwayat produksi).
2. Pilih **Jenis foto** (Desain/Referensi, Hasil Jadi, Nota/Bukti) dan tulis keterangan bila perlu.
3. Ketuk **📷 Ambil / Pilih Foto**. Bisa langsung dari kamera HP, bisa pilih beberapa foto sekaligus.
4. Foto tampil sebagai galeri. Ketuk fotonya untuk melihat besar, ada tombol **⬇️ Unduh**.

**Hal teknis yang sudah diurus otomatis (tidak perlu Anda pikirkan):**

| Hal | Penjelasan |
|---|---|
| **Kompresi otomatis** | Foto diperkecil di HP (sisi terpanjang 1.400 px, JPEG kualitas 72%) sebelum dikirim → hemat kuota internet & database. Foto 4 MB biasanya jadi ± 150–250 KB. |
| **Batas 8 foto/pekerjaan** | Mencegah kuota database cepat penuh. Bisa ditambah bila nanti diperlukan. |
| **Tersimpan di Neon** | Foto disimpan di kolom `bytea` tabel `order_photos`. Tidak perlu mendaftar layanan storage lain. |
| **Ikut terhapus** | Kalau pekerjaan dihapus, fotonya ikut terhapus otomatis (tidak meninggalkan sampah). |
| **Pemakaian terpantau** | Halaman **Pengaturan** menampilkan "Penyimpanan foto: N foto · X KB". |

**PENTING untuk yang sudah deploy sebelumnya:**
Fitur ini menambah 1 tabel baru. Buka **`https://app-anda.vercel.app/api/setup`** sekali di browser.
Aman dijalankan berulang, tidak menghapus data. Setelah itu card foto muncul di semua pekerjaan.

**Perkiraan kuota:** paket gratis Neon ± 0,5 GB. Satu foto terkompresi ± 200 KB, jadi ± 2.500 foto.
Untuk percetakan kecil–menengah (8 foto/order), itu setara ± 300 order. Sudah jauh lebih dari cukup
untuk 1–2 tahun pertama. Kalau suatu saat hampir penuh, aplikasi akan tetap jalan — Anda hanya perlu
menghapus foto lama atau upgrade paket Neon.

### 14.A ✅ Checklist pascapemasangan (± 30 menit, cukup sekali)

Setelah deploy sukses, buka halaman **`/mulai`** di aplikasi Anda. Halaman itu **mendeteksi sendiri**
kondisi aplikasi (berapa pekerjaan nyata, masih ada data contoh atau tidak, langkah mana yang sudah
Anda centang) lalu menampilkan progres persentase. Isinya 8 langkah:

| # | Langkah | Kenapa penting |
|---|---|---|
| 1 | **Hapus data contoh** | Data latihan membuat laporan & peringatan AI jadi keliru. Cukup satu klik di `/pengaturan` → 🧹 Hapus Data Contoh |
| 2 | **Masukkan pekerjaan nyata pertama** | Supaya dashboard mulai hidup dan AI mulai menghitung |
| 3 | **Daftarkan pelanggan tetap** | Supaya halaman Pelanggan menunjukkan siapa juru uang Anda |
| 4 | **Pasang di HP** (Android/iPhone) | Inti gunanya aplikasi: cek status dari kantong |
| 5 | **Biasakan klik status per tahap** | Akurasi peringatan "berisiko telat" bergantung pada ini |
| 6 | **Unduh cadangan pertama (CSV)** | Ketenangan + bahan laporan bulanan di Excel |
| 7 | *(opsional)* **Ajak operator/kasir** | Status diubah langsung oleh pelakunya |
| 8 | *(opsional)* **Aktifkan AI bahasa GPT/Claude** | Kalimat AI lebih luwes (tanpa ini pun aplikasi tetap pintar) |

Pekerjaan rumah teknis yang **tidak perlu** Anda lakukan: backup database manual, update server,
instal SSL — semuanya sudah diurus Neon dan Vercel.

### Mingguan (10 menit)
1. Halaman **Pelanggan** → lihat siapa yang paling banyak order (juru uang Anda, jaga hubungan!).
2. Tanya AI: *"beban tiap mesin"* → jika satu mesin selalu penuh, pertimbangkan mesin baru.
3. Tanya AI: *"pekerjaan yang terlambat"* → evaluasi penyebabnya.

---

## 15. Troubleshooting

### 15.A 🔴 PALING SERING: "Halaman blank / hitam kosong setelah deploy"

**Tenang — ini bukan berarti gagal deploy, dan data Anda tidak hilang.** Halaman hitam itu adalah
*halaman error bawaan Next.js* yang memang berwarna hitam bila HP/laptop Anda memakai **mode gelap**.
Artinya ada **error 500** di server, dan 99% penyebabnya salah satu dari dua hal di bawah ini.

> Aplikasi ini sekarang sudah dilengkapi **layar peringatan berbahasa Indonesia**, jadi setelah Anda
> memperbarui kode ke versi terbaru, halaman hitam tidak akan muncul lagi — yang muncul adalah
> penjelasan penyebab + langkah perbaikannya.

#### Cek 30 detik (selalu lakukan ini dulu)
Buka dua alamat ini di browser (ganti dengan domain Anda):

| Alamat | Kalau hasilnya… | Artinya |
|---|---|---|
| `https://app-anda.vercel.app/api/health` | `{"ok":false,"kode":"env_kosong",...}` | `DATABASE_URL` **belum diisi** di Vercel → kerjakan **Perbaikan 1** |
| `https://app-anda.vercel.app/api/health` | `{"ok":false,"kode":"tabel_belum_ada",...}` | Koneksi **berhasil**, tapi tabel **belum dibuat** → kerjakan **Perbaikan 2** |
| `https://app-anda.vercel.app/api/health` | `{"ok":true,...}` | Aplikasi sehat. Buka halaman utama lagi (Refresh keras: tahan lalu *Reload*) |
| Halaman tidak bisa dibuka sama sekali | — | Lihat **Perbaikan 3** |

Ada juga halaman Diagnosis yang tampilannya enak dibaca: **`https://app-anda.vercel.app/status`**
dan data mentahnya di **`/api/diagnose`**.

#### ✅ Perbaikan 1 — DATABASE_URL belum diisi di Vercel (penyebab #1)
1. Buka **Vercel → project Anda**.
2. Menu **Settings → Environment Variables**.
3. Klik **Add New** → isi:
   - **Name:** `DATABASE_URL` (persis, huruf besar semua, pakai garis bawah)
   - **Value:** connection string **Pooled** dari Neon (yang mengandung `-pooler` dan diakhiri `?sslmode=require`)
   - **Environments:** centang *Production*, *Preview*, *Development*
4. **Save**.
5. **WAJIB:** menu **Deployments → cari deployment paling atas → klik ⋯ → Redeploy**.
   > ⚠️ Mengganti Environment Variables **tidak langsung berlaku**. Wajib Redeploy. Ini yang paling sering bikin orang bingung.

#### ✅ Perbaikan 2 — Tabel belum dibuat (penyebab #2)
Koneksi database sudah benar, hanya tabelnya belum ada.
1. Buka `https://app-anda.vercel.app/api/setup`
2. Tunggu sampai muncul: `{"ok":true,"message":"Database siap dipakai...", ...}`
3. Kembali ke halaman utama aplikasi → **Refresh**.
4. Ingin ada contoh data untuk belajar? Buka `https://app-anda.vercel.app/api/setup?seed=1`

#### ✅ Perbaikan 3 — Halaman benar-benar tidak bisa dibuka
| Cek | Cara |
|---|---|
| Apakah deployment sukses? | Vercel → **Deployments** → status harus **Ready** (hijau). Kalau *Error/Cancelled*, klik untuk baca **Build Logs** |
| Apakah file lengkap? | Pastikan di GitHub ada folder `src/`, `public/`, dan file `package.json`. Kalau `src/` kosong, build sukses tapi halaman kosong |
| Apakah ada kode galat? | Vercel → **Deployments** → deployment terakhir → **Runtime Logs** → cari baris merah paling atas |
| Apakah domain benar? | Vercel → **Settings → Domains** → pastikan alamat yang Anda buka terdaftar di sana |

#### Setelah diperbaiki, cara memastikan sembuh total
Buka `/status`. Kalau tampil **✅ Semua normal**, aplikasi sudah sehat dan siap dipakai.

---

### 15.B Daftar gejala lain

| Gejala | Penyebab paling umum | Solusi |
|---|---|---|
| `/api/health` → `{"ok":false}` | `DATABASE_URL` salah/kosong di Vercel | Cek ulang Environment Variables → Save → **Redeploy**. Pastikan pakai URL **Pooled** & diakhiri `?sslmode=require` |
| Error `password authentication failed` | Password salah / ada spasi atau enter ikut ter-tempel | Copy ulang connection string dari Neon, tempel bersih |
| Error `relation "orders" does not exist` | Tabel belum dibuat | Buka `/api/setup` di browser |
| Error `ssl is not allowed` / `no pg_hba.conf entry` | Koneksi tidak terenkripsi atau pakai host yang salah | Tambah `?sslmode=require`; gunakan host `...-pooler...` dari Neon |
| Halaman utama error `500` | Kode terbaru belum sesuai / variabel hilang | Buka **Vercel → Deployments → Runtime Logs**, baca baris merah pertama |
| Semua halaman lambat sekali | Region Neon terlalu jauh | Buat project baru di region **Singapore** lalu pindahkan `DATABASE_URL` (data lama perlu dimigrasi) |
| Build gagal: `Module not found` | Ada file yang belum ter-upload | Bandingkan daftar file di GitHub dengan [daftar wajib](#13-daftar-file-yang-diupload-dan-yang-jangan) |
| Build gagal: error TypeScript | Perubahan kode menyebabkan type mismatch | Lihat nomor file & baris di log, perbaiki, commit ulang |
| Waktu deadline terasa "geser beberapa jam" | Browser/server beda zona waktu | Isi tanggal & jam deadline sesuai jam lokal Anda; aplikasi menghitungnya secara lokal |
| Data contoh tidak mau terhapus | Normal (harus dihapus satu per satu) | Buka pekerjaan → **🗑️ Hapus** |
| APK gagal dibuat PWABuilder | Manifest/icon belum terbaca | Pastikan `https://app-anda.vercel.app/manifest.webmanifest` terbuka di browser, lalu ulangi |
| Lupa password database | — | Neon → **Roles** → **Reset password** → perbarui `DATABASE_URL` di Vercel → Redeploy |

**Tempat melihat log error:** Vercel → Project → tab **Deployments** → klik deployment terakhir → **Build Logs** (untuk gagal build) atau **Runtime Logs** (untuk error saat dipakai).

---

## 16. Biaya & batas gratis

| Layanan | Paket gratis mencakup | Kapan perlu bayar |
|---|---|---|
| **GitHub** | Repository private tanpa batas praktis | Tidak perlu |
| **Neon** | ± 0,5 GB penyimpanan & jumlah jam komputasi bulanan yang lega untuk 1 toko | Jika data > 0,5 GB (ribuan order) → ± US$19/bln |
| **Vercel** | Hosting + HTTPS + deploy otomatis (Hobby, untuk non-komersial) | Jika dipakai komersial intensif → Pro US$20/bln |
| **OpenAI/Claude** | Berbayar per pemakaian (umumnya < US$1–3/bln untuk 1 toko) | Opsional — bisa tidak dipakai sama sekali |
| **PWABuilder** | Gratis membuat APK | Gratis |

> 💰 **Perkiraan realistis untuk memulai: Rp 0** (tanpa AI bahasa). Dengan AI bahasa: ± Rp 15.000–50.000/bulan.

---

## 17. Kamus istilah teknis

| Istilah | Artinya dalam bahasa manusia |
|---|---|
| **Repository (repo)** | Folder project di GitHub beserta riwayat perubahannya |
| **Commit** | Menyimpan "snapshot" perubahan dengan keterangan |
| **Push** | Mengirim perubahan dari komputer ke GitHub |
| **Deploy** | Menerbitkan aplikasi agar bisa dibuka lewat internet |
| **Environment Variable** | Tempat menyimpan rahasia/konfigurasi (password, kunci API) di luar kode |
| **Database** | Lemari penyimpanan data yang rapi dan bisa dicari cepat |
| **PostgreSQL / Postgres** | Jenis database yang dipakai (sangat populer & andal) |
| **Tabel** | Seperti lembar Excel di dalam database (kolom & baris) |
| **Connection string** | Alamat + kunci untuk masuk ke database |
| **Pooled connection** | Mode koneksi hemat yang cocok untuk serverless (Vercel) |
| **SSL / sslmode=require** | Wajib memakai jalur terenkripsi agar data tidak bisa disadap |
| **API** | "Pintu" yang memungkinkan dua aplikasi saling bertukar data |
| **API Key** | Kode rahasia pembuktian diri untuk memakai suatu API |
| **PWA** | Website yang bisa dipasang seperti aplikasi |
| **APK** | File installer aplikasi Android |
| **Build** | Proses merakit kode menjadi aplikasi siap jalan |
| **Runtime error** | Error yang muncul saat aplikasi sudah berjalan |
| **Migration / push schema** | Membuat/menyesuaikan bentuk tabel di database |
| **SLA** | Janji ketepatan waktu penyelesaian ke pelanggan |

---

## 18. Roadmap pengembangan berikutnya

Urutan yang saya sarankan (satu per satu, jangan sekaligus):

1. **Minggu 1–2:** Pakai aplikasi apa adanya untuk semua order baru. Tujuan: data terkumpul, kebiasaan terbentuk.
2. **Minggu 3:** Tambah **notifikasi WhatsApp** (misal lewat layanan seperti Fonnte/WABLAS + route baru) saat status berubah & saat pekerjaan masuk zona 🟠.
3. **Minggu 4:** Tambah **login karyawan** (Owner/Operator/Kasir) supaya operator hanya bisa mengubah status, tidak bisa menghapus data.
4. **Bulan 2:** Halaman **lacak untuk pelanggan** (`/lacak/PJ-2026-0001`) + QR code di nota.
5. **Bulan 2–3:** **Manajemen stok bahan** (kertas, tinta, bahan spanduk) + peringatan stok minimum.
6. **Bulan 3:** **Laporan bulanan** (omzet per produk, pelanggan teratas, ketepatan waktu) + ekspor Excel/PDF.
7. **Bulan 4:** **Google Play Store** (kalau Anda ingin brand lebih kuat) & domain sendiri.

---

### Terakhir 💜

- Halaman `/api/health` = untuk memastikan database terhubung.
- Halaman `/api/setup` = tombol ajaib pembuat tabel.
- Halaman `/panduan` = panduan ini dalam tampilan yang rapi di dalam aplikasi.
- File `panduan-deploy-neon-vercel.md` (di folder `public`) = file yang sedang Anda baca; bisa dibuka langsung di `https://app-anda.vercel.app/panduan-deploy-neon-vercel.md`.

Selamat memantau produksi — semoga tidak ada lagi pekerjaan telat tanpa Anda sadari. 🚀
