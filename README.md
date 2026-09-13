# Print Flow — Monitoring Produksi Percetakan

Aplikasi web (desktop + mobile/PWA) untuk memantau setiap pekerjaan percetakan: status produksi,
deadline, risiko telat, dan rekomendasi tindakan dari AI.

**Dibangun dengan:** Next.js (App Router) · PostgreSQL (Neon) · Drizzle ORM · Tailwind CSS · Vercel.

---

## Fitur utama

- 🏠 **Dashboard harian** — kondisi percetakan dalam 30 detik + ringkasan AI + saran tindakan.
- ➕ **Input pekerjaan** — pelanggan, jenis cetak, jumlah, deadline, harga, DP. Estimasi jam kerja otomatis.
- 🔄 **9 status produksi** — Antrian → Desain → Cetak → Finishing → QC → Siap → Selesai (+ Ditunda / Batal).
- 🕘 **Riwayat produksi** — siapa mengubah status apa dan kapan.
- 🤖 **Analisa risiko AI** — skor 0–100, alasan, dan saran tindakan per pekerjaan.
- 💬 **Tanya AI** — tanya kondisi produksi dengan bahasa sehari-hari.
- 🖼️ **Lampiran foto** — desain, hasil jadi, dan nota; kamera HP + kompresi otomatis.
- 🏭 **Produksi Mitra / Lempar Order** — status vendor, target barang kembali, biaya, margin, QC, dan riwayat.
- 🤝 **Serah Terima Shift** — tujuan dropdown akun aktif, target user ID, penerimaan aman, PIC otomatis, dan badge mutasi.
- 📋 **Paste screenshot** — unggah attachment langsung dari Windows clipboard dengan Ctrl+V.
- 👥 **Buku pelanggan** — total order & nilai transaksi per pelanggan.
- 🔐 **Login & Role** — hanya Owner dan Karyawan; edit username, reset password, audit dan revokasi session.
- ⋮ **Header ringkas** — menu utilitas Owner dalam dropdown titik tiga, navigasi operasional tetap lega.
- 📱 **Mobile navigation** — header user/titik tiga fixed atas; menu utama dirender via Portal dan dikunci fixed bawah.
- 🕒 **Jam lokal live** — tanggal/jam Dashboard mengikuti perangkat pengguna, bukan zona waktu server.
- 📐 **Mobile UI aman viewport** — dropdown user tidak terpotong; Pengaturan tanpa geser horizontal; tombol hero sejajar.
- 🔔 **Web Push Android/PWA** — wizard VAPID, Uji Lokal vs Push Server, repair subscription, trigger operasional.
- 👤 **PIC di card pekerjaan** — penanggung jawab terlihat di Dashboard dan daftar desktop/mobile.
- ⚡ **Navigasi responsif** — prefetch proaktif, delayed progress 180 ms, skeleton, dashboard tanpa menunggu API AI eksternal.
- 📱 **PWA siap install** — icon printer 192/512/maskable, manifest dinamis, service worker, siap APK TWA.
- 🩺 **Diagnosis PWA/APK** — `/api/pwa/check` memeriksa PWA; `/api/apk/check` memeriksa TWA address bar dan push.

## Halaman

| Rute | Isi |
|---|---|
| `/login` | Login akun internal |
| `/setup-akun` | Buat Owner pertama (hanya saat user kosong) |
| `/pengguna` | Manajemen user dan role (Owner-only) |
| `/` | Dashboard + ringkasan AI + prioritas kerja |
| `/pesanan` | Daftar pekerjaan + filter (status, mesin, pencarian) |
| `/pesanan/baru` | Form pekerjaan baru |
| `/pesanan/[id]` | Detail, analisa AI, update status, riwayat, edit |
| `/pelanggan` | Daftar & tambah pelanggan |
| `/panduan` | Panduan lengkap (Neon, GitHub, Vercel, APK) |
| `/catatan-perubahan` | 📄 Dokumentasi tiap update (berkas `.txt` di `public/dokumentasi-update/`) |
| `/mulai` | **🚀 Checklist pascapemasangan** — 8 langkah berikutnya, progres terdeteksi otomatis |
| `/pengaturan` | ⚙️ Hapus/isi data contoh, unduh cadangan CSV, kondisi sistem |
| `/status` | **🩺 Diagnosis otomatis** — buka ini kalau halaman blank/hitam |
| `/api/diagnose` | JSON diagnosis lengkap (env, host, tabel, jumlah data) |
| `/api/health` | Cek koneksi database (singkat) |
| `/api/performance` | Tes latensi database (first query vs warm query) |
| `/api/setup` | **Membuat semua tabel** (idempotent) — buka sekali setelah deploy |
| `/api/orders` | REST: daftar & buat pekerjaan |
| `/api/orders/[id]` | REST: detail, ubah status/data, hapus |
| `/api/orders/[id]/photos` | REST: daftar & unggah foto pekerjaan |
| `/api/photos/[id]` | Menampilkan isi foto (dipakai oleh galeri) |
| `/api/customers` | REST: daftar & buat pelanggan |
| `/api/partners` | REST: daftar & tambah mitra produksi |
| `/api/orders/[id]/outsource` | REST: pengaturan produksi luar per pekerjaan |
| `/api/orders/[id]/handovers` | REST: buat/terima mutasi operator shift |
| `/api/handovers/pending-count` | Jumlah mutasi menunggu untuk badge menu Shift |
| `/notifikasi` | Wizard aktivasi & uji push untuk Owner/Karyawan |
| `/api/push` | Konfigurasi, subscribe/unsubscribe, dan tes Web Push |
| `/api/push/vapid-helper` | Generator VAPID satu-kali untuk Owner |
| `/.well-known/assetlinks.json` | Digital Asset Links agar APK TWA terverifikasi tanpa address bar |
| `/api/apk/check` | Diagnosis package/fingerprint, TWA, PWA, dan push notification |
| `/api/ai` | REST: ringkasan (GET) / tanya AI (POST) |
| `/api/export` | Unduh cadangan CSV (`?type=orders\|pelanggan\|keuangan\|riwayat`) |
| `/api/admin/reset` | Hapus data contoh / kosongkan semua data (POST) |
| `/api/settings` | Simpan preferensi ringan (centang checklist) |

## Menjalankan di komputer

```bash
npm install
cp .env.example .env      # lalu isi DATABASE_URL
npm run dev               # http://localhost:3000
```

Buat tabel database dengan salah satu cara:

- Buka `http://localhost:3000/api/setup` di browser (paling mudah), **atau**
- `npx drizzle-kit push`

Ingin data contoh? Buka `http://localhost:3000/api/setup?seed=1`.

## Deploy ke Vercel + Neon (ringkas)

1. Push semua file project ke **GitHub** (lihat daftar file di `/panduan`).
2. Buat project di **Neon** (region Singapore) → copy **connection string pooled**.
3. Import repo di **Vercel** → tambah Environment Variable `DATABASE_URL` → Deploy.
4. Buka `https://app-anda.vercel.app/api/setup` untuk membuat tabel.
5. Buka aplikasi dari HP → "Tambahkan ke layar utama", atau buat APK lewat **PWABuilder**.

## ⚠️ Halaman blank / hitam setelah deploy?

Itu **halaman error bawaan Next.js** (warnanya hitam bila perangkat Anda memakai mode gelap), bukan
bug tampilan. Dua penyebab paling umum:

1. **`DATABASE_URL` belum diisi di Vercel** → Settings → Environment Variables → tambah → **Redeploy**
   (mengganti variable **wajib** diikuti Redeploy agar berlaku).
2. **Tabel belum dibuat** → buka `https://app-anda.vercel.app/api/setup` sekali.

Alat bantu diagnosa yang tersedia di aplikasi:

- `/status` → halaman diagnosis berbahasa Indonesia + langkah perbaikan.
- `/api/diagnose` → data mentah diagnosis (env, host, tabel, jumlah data).
- `/api/health` → cek singkat, `{"ok":true}` berarti sehat.

Panduan super detail (bahasa awam, lengkap dengan troubleshooting) tersedia di:
**`public/panduan-deploy-neon-vercel.md`** → juga bisa dibuka di `/panduan`.

## Variabel lingkungan

| Nama | Wajib? | Isi |
|---|---|---|
| `AUTH_SECRET` | ✅ | Secret session acak minimal 32 karakter |
| `DATABASE_URL` | ✅ | Connection string **pooled** dari Neon (`...?sslmode=require`) |
| `OPENAI_API_KEY` | ⬜ | Aktifkan jawaban AI berbasis GPT (opsional) |
| `ANTHROPIC_API_KEY` | ⬜ | Alternatif GPT (opsional, cukup satu) |
| `SETUP_TOKEN` | ⬜ | Kunci halaman `/api/setup` (panggil dengan `?token=...`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ⬜ | Public key Web Push (`npx web-push generate-vapid-keys --json`) |
| `VAPID_PRIVATE_KEY` | ⬜ | Private key Web Push — rahasia |
| `VAPID_SUBJECT` | ⬜ | Kontak VAPID, contoh `mailto:owner@example.com` |

## Skor risiko AI

| Skor | Level | Tindakan |
|---|---|---|
| 0–34 | 🟢 Aman | Pantau rutin |
| 35–64 | 🟡 Waspada | Kunci approval desain |
| 65–89 | 🟠 Berisiko | Tambah shift / pindah mesin / kabari pelanggan |
| 90–100 | 🔴 Terlambat | Hubungi pelanggan hari ini |

Rumus: bandingkan **sisa pekerjaan** (estimasi jam × sisa progres) dengan **kapasitas waktu efektif**
(sisa waktu × 35%), lalu tambah bobot prioritas (Urgent +15, Tinggi +8, Rendah −6).
