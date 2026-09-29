# Redesign Print Flow, satu bahasa visual

> **Cara pasang tercepat (disarankan), untuk 60+ berkas sekaligus:**
> 1. Unduh `printflow-redesign-v2.zip`, lalu ekstrak di komputer.
> 2. Buka repo di GitHub, klik **Add file > Upload files**.
> 3. Seret folder **`src`** dan **`public`**, **plus berkas `package.json` dan
>    `package-lock.json`**, hasil ekstrak ke halaman itu. GitHub otomatis menimpa
>    berkas dengan nama dan lokasi yang sama. (`package.json` wajib ikut: ada pustaka
>    baru `@vercel/blob`; tanpa itu build di Vercel gagal.)
> 4. Tulis pesan commit, misalnya "Satu bahasa visual", lalu **Commit changes**.
> 5. Hapus 4 berkas lama yang tercantum di `HAPUS-BERKAS-INI.txt`.
> 6. Tunggu Vercel selesai build.
> 7. **Buka `/api/setup` sekali**, lalu pasang Vercel Blob untuk foto (langkahnya di
>    `CATATAN-PRINTFLOW.txt`, entri [3]).
> 8. Detail fitur multi mitra: (wajib untuk fitur status per produk dan multi mitra,
>    lihat `FITUR-STATUS-PRODUK-DAN-MULTI-MITRA.md`).
>
> Berkas `.md`, `.txt`, dan `HAPUS-BERKAS-INI.txt` **tidak perlu** diunggah.


Paket ini mengganti tata letak halaman Dashboard (`/`) dan memasang sistem token desain
yang bisa dipakai ulang oleh halaman lain nanti.

Struktur foldernya sama persis dengan repo `printflow_public`, jadi tinggal disalin.

---

## Design read

Membaca ini sebagai: **layar operasional harian untuk pemilik dan karyawan percetakan,
dipakai paling sering di ponsel sambil berdiri di dekat mesin, dengan bahasa visual
produk yang tenang dan padat, condong ke pola design system produk seperti Carbon atau
Fluent, bukan bahasa halaman promosi.**

Mode redesign: **preserve**. Warna merek (navy `#07384f`, teal, amber), rute, label
navigasi, dan nama field form tidak diubah.

Dial:

| Dial | Nilai | Alasan |
| --- | --- | --- |
| `DESIGN_VARIANCE` | 4 | Layar yang dibuka puluhan kali sehari harus bisa ditebak. Komposisi eksperimental justru memperlambat. |
| `MOTION_INTENSITY` | 3 | Hanya transisi keadaan dan satu reveal masuk. Dimatikan penuh saat pengguna memilih kurangi gerak. |
| `VISUAL_DENSITY` | 7 | Ini kokpit. Delapan pekerjaan harus terbaca sekali lihat. |

Catatan jujur soal panduannya: seksi 13 SKILL.md menyatakan skill itu bukan untuk
dashboard dan menyarankan memakai design system produk. Jadi bagian landing page
(hero besar, bento, scroll telling, marquee) memang **tidak** dipakai di sini. Yang
dipakai adalah bagian yang berlaku universal: tipografi, kalibrasi warna, kunci radius,
disiplin bayangan, keadaan interaktif, protokol mode gelap, pagar performa, dan seluruh
daftar larangan AI tells termasuk larangan em dash.

---

## Daftar berkas

| Berkas | Tindakan |
| --- | --- |
| `src/app/design-tokens.css` | Baru |
| `src/app/dashboard.css` | Baru |
| `src/app/globals.css` | Ganti. Isinya sama persis dengan milik Anda, hanya ada dua baris import: `design-tokens.css` dan `dashboard.css` |
| `src/app/layout.tsx` | Ganti. Sama persis dengan milik Anda, hanya ditambah font Geist lewat `next/font` |
| `src/app/page.tsx` | Ganti |
| `src/components/dashboard/DashboardHero.tsx` | Ganti (hero foto desain original + carousel Insight AI) |
| `src/components/dashboard/JobQueue.tsx` | Baru |
| `src/components/dashboard/Panels.tsx` | Baru |
| `src/components/dashboard/DashboardSkeleton.tsx` | Baru |
| `src/components/dashboard/SwipeTrack.tsx` | Baru (geser kartu antrean di HP + titik posisi) |
| `src/components/CopyMessageQuick.tsx` | Ganti. Hanya menambah properti opsional `label`, logika salin tidak berubah |
| `src/components/LocalDateTime.tsx` | Ganti. Jam berhenti berdetak saat tidak terlihat, tampilan sama |
| `src/components/HeroHighlightsCarousel.tsx` | Ganti. Tinggi stabil dan berhenti saat tidak terlihat, tampilan sama |
| `public/dokumentasi-update/2026-10-14-redesign-dashboard.txt` | Baru |

Berkas lama yang **tidak** disentuh: seluruh `src/lib`, seluruh `src/app/api`, `src/db`,
`src/proxy.ts`, service worker, manifest, assetlinks, serta komponen
`QuickStatusPopup`, `ShareWhatsAppQuick`, `PhotoQuickPeek`,
`AiAssistant`, `Greeting`, `LocalDateTime`, `ui.tsx`. Zona B dan zona C aman.

**Hapus berkas ini dari repo:** `src/components/dashboard/StatusBand.tsx` (sudah tidak dipakai).

Jika Anda pernah memasang paket revisi sebelumnya, berkas lama di
`src/components/dashboard/` (DashboardStats, JobCard, JobCarousel, DashboardPanels) boleh
dihapus karena sudah tidak dipanggil. `DashboardHero.tsx` JANGAN dihapus, cukup timpa
dengan versi di paket ini.

---

## Cara pasang lewat GitHub web

1. Buka repo `arionmiracle93-wq/printflow_public`.
2. **Add file, Create new file**, ketik `src/app/design-tokens.css`, tempel isinya, Commit.
3. Ulangi untuk `src/app/dashboard.css`.
4. Ulangi untuk lima berkas di `src/components/dashboard/`.
5. Buka `src/app/globals.css`, klik pensil, tempel isi dari paket ini, Commit.
   Kalau ragu, pastikan dua baris ini ada tepat di bawah `@import "tailwindcss";`
   ```css
   @import "./design-tokens.css";
   @import "./dashboard.css";
   ```
6. Buka `src/app/layout.tsx`, tempel isi dari paket ini, Commit.
7. Buka `src/app/page.tsx`, tempel isi dari paket ini, Commit.
8. Tambahkan catatan perubahan di `public/dokumentasi-update/`.
9. Tunggu Vercel selesai build, lalu buka aplikasi.
10. Di ponsel atau APK, tutup aplikasi lalu buka lagi. Kalau tampilan lama masih
    tersangkut, hapus cache aplikasi di setelan Android.

Kalau memakai komputer:

```bash
# salin folder src/ dan public/ dari paket ini menimpa milik Anda
npm run build
git add .
git commit -m "Redesign layout dashboard"
git push
```

---

## Apa yang berubah dan kenapa

**1. Hero foto tetap desain original.**
Markup hero disalin apa adanya dari versi asli (commit `bacb913`): ukuran, gradasi
masking `.hero-photo-bg`, cahaya amber dan teal, tekstur halftone, sapaan dengan ikon
tangan, judul "Produksi cetak, terpantau tepat waktu", tombol putih, badge Insight AI,
dan carousel sorotan `HeroHighlightsCarousel`. Hanya dipindah ke komponen
`DashboardHero.tsx` supaya `page.tsx` lebih ringkas.

**2. Kartu KPI tetap desain original.**
Komponen `KpiCard` dari `src/components/ui.tsx` dipakai apa adanya, termasuk susunan
grid `grid-cols-2 md:grid-cols-3 xl:grid-cols-6` seperti versi asli. Tidak ada berkas
KPI baru.

**3. Kartu pekerjaan tebal diganti baris data di layar lebar.**
Dengan kartu, hanya empat pekerjaan terlihat sekaligus. Dengan baris data, delapan
pekerjaan bisa dipindai sekali lihat. Di ponsel tetap kartu geser, karena baris data
tidak masuk di layar sempit.

**4. Posisi pekerjaan per tahap, grid ubin.**
Sembilan ubin (3 kolom di layar lebar, 1 kolom di HP), masing-masing berisi ikon tahap
berwarna, nama tahap, jumlah, dan bar proporsi. Ubin yang berisi sedikit terangkat
dengan garis tepi, ubin kosong dibuat redup. Ketuk ubin untuk membuka daftar pekerjaan
di tahap itu. Warna ikon diambil dari `status.dot` di `src/lib/domain.ts`, jadi tetap
sama dengan badge status di halaman lain.

**5. Sebaran risiko, diagram donat.**
Empat irisan mengikuti skala skor risiko AI yang sudah ada: Aman 0-34, Waspada 35-64,
Berisiko 65-89, Terlambat 90-100. Jumlah dihitung dari `riskLevel` tiap pekerjaan aktif,
jadi selalu cocok dengan badge risiko di kartu pekerjaan. Total di tengah donat, skor
rata-rata di subjudul. Irisan digambar bertahap saat halaman dibuka, dan saat kursor di
atas irisan atau baris legenda, level lain meredup. SVG polos tanpa pustaka grafik.

**6. Sistem token.**
Warna, radius, bayangan, dan durasi gerak dipusatkan di satu berkas. Radius dikunci tiga
nilai saja: kartu 14px, kontrol 10px, pil penuh. Aksen dikunci satu warna yaitu teal.
Amber turun pangkat menjadi warna semantik peringatan, bukan aksen bebas. Bayangan diberi
rona biru kehijauan mengikuti latar, tidak pernah hitam murni di mode terang.

**7. Tipografi.**
Geist dan Geist Mono lewat `next/font`, jadi berkas font ikut dihosting sendiri, tidak ada
permintaan ke server pihak ketiga, dan tidak ada kedipan teks. Semua angka dikunci
tabular sehingga kolom angka tidak bergoyang. Tebal huruf diturunkan dari `font-black`
di mana mana menjadi tangga 560 sampai 650, karena kalau semua tebal maka tidak ada yang
menonjol.

**8. Keadaan lengkap.**
Kerangka muat yang bentuknya mengikuti layout akhir, keadaan kosong yang menunjukkan
langkah berikutnya, dan layar bermasalah lama tetap dipakai.

**9. Kepatuhan pre-flight.**
Nol em dash di seluruh berkas baru. Nol label kecil huruf kapital di atas judul seksi.
Nol titik berwarna hiasan. Tidak ada track bar berlatar penuh sebagai visual
perbandingan. Satu keluarga ikon, ketebalan garis dikunci 1.75. Fokus keyboard terlihat.
Mode gelap diuji. `min-h-[100dvh]`, bukan `h-screen`.

---

## Kalau ingin kembali

Kembalikan `src/app/page.tsx`, `src/app/globals.css`, dan `src/app/layout.tsx` lewat
menu History di GitHub. Berkas baru boleh ditinggal, tidak mengganggu apa pun.

---

## Perbaikan 15 Oktober 2026

**Masalah:** di layar lebar, kartu antrean versi ponsel ikut tampil bertumpuk di atas
tabel, dan border tombol "Semua pekerjaan" hilang.

**Penyebab:** kelas `pf-*` ditulis di luar `@layer`. Di Tailwind v4, utility seperti
`lg:hidden` berada di `@layer utilities`, dan CSS di luar layer selalu menang atas CSS di
dalam layer. Jadi `.pf-swipe { display: flex }` mengalahkan `lg:hidden`.

**Perbaikan:** semua kelas di `design-tokens.css` dan `dashboard.css` dipindah ke dalam
`@layer components`, dan `dashboard.css` sekarang diimpor dari `globals.css` (bukan dari
`page.tsx`) supaya diproses Tailwind dan masuk urutan layer yang benar. Sudah dicek di CSS
hasil build: urutan layer `base, components, utilities`, dan tidak ada satu pun kelas
`pf-*` di luar layer.

Perbaikan lain: tombol di kartu ponsel kini benar-benar selebar kolom, tablet menampilkan
dua kartu sekaligus, dan pita alur produksi melebar penuh kalau tidak ada tenggat hari ini.

---

## Perubahan 16 Oktober 2026

- "Alur produksi" (pita horizontal) diganti **Posisi pekerjaan per tahap**, grid ubin.
- "Sebaran risiko" (pita bertumpuk) diganti **diagram donat** empat level.
- Token warna baru `--pf-alert` (oranye) untuk level Berisiko, terang dan gelap.
- Berkas yang berubah: `design-tokens.css`, `dashboard.css`, `page.tsx`,
  `components/dashboard/Panels.tsx`. Berkas lain tidak berubah.

---

## Perubahan 17 Oktober 2026

**Antrean prioritas di HP: satu kartu penuh per layar.**
Sebelumnya tiap kartu selebar 88% layar, jadi kartu berikutnya selalu terlihat separuh.
Sekarang kartu selebar area konten halaman, dan jarak antar kartu disamakan dengan
padding halaman, sehingga saat berhenti tidak ada kartu yang terpotong. Geseran selalu
berhenti tepat satu kartu (`scroll-snap-stop: always`). Di tablet (768px ke atas) tampil
dua kartu penuh sekaligus, dan di 1024px ke atas tetap baris data.

Karena kartu berikutnya tidak lagi mengintip, ditambahkan titik penunjuk posisi di bawah
kartu (bisa diketuk untuk melompat). Posisi dibaca dengan IntersectionObserver, bukan
event scroll, supaya ringan di APK.

Berkas: `dashboard.css`, `components/dashboard/JobQueue.tsx`, dan berkas baru
`components/dashboard/SwipeTrack.tsx`.

---

## Perubahan 18 Oktober 2026

**Tombol "Lihat detail" di kartu antrean (HP dan tablet).**
Tombol di bagian bawah kartu sekarang tersusun 2 x 2:

| Ubah status | Kirim WA |
| --- | --- |
| Salin pesan | **Lihat detail** |

"Lihat detail" menjadi tombol utama (teal penuh) dan membuka `/pesanan/[id]`.
"Salin teks pesan" disingkat menjadi **"Salin pesan"** supaya muat satu baris.
Semua label tombol dikunci satu baris. Di layar sangat sempit (di bawah 340px) teks
mengecil sedikit; kalau tetap tidak muat, dipotong dengan elipsis, tidak turun baris.

Supaya label bisa disingkat tanpa mengubah halaman lain, `CopyMessageQuick` diberi
properti opsional `label`. Nilai bawaannya tetap "Salin teks pesan", jadi pemakaian lain
(misalnya di `ui.tsx`) tampil persis seperti sebelumnya. Logika salin, tautan lacak, dan
fallback clipboard untuk WebView APK tidak diubah.

Berkas: `dashboard.css`, `components/dashboard/JobQueue.tsx`,
`components/CopyMessageQuick.tsx`.

---

## Perubahan 19 Oktober 2026

**Halaman Daftar Pekerjaan (`/pesanan`): chip "N produk" tidak lagi pecah dua baris.**

Penyebab: chip berada di baris flex yang sama dengan teks ringkasan produk, tetapi tidak
diberi `shrink-0` dan `whitespace-nowrap`. Saat ringkasannya panjang, chip ikut terjepit
dan "3 produk" turun jadi dua baris.

Perbaikan (kartu HP dan tabel desktop):
- Chip diberi `shrink-0 whitespace-nowrap`, jadi selalu satu baris.
- Teks ringkasan produk dibungkus `span` dengan `min-w-0 flex-1`, jadi hanya teks ini
  yang boleh turun baris.
- Ikon dan chip rata atas dengan baris pertama teks (`items-start`).
- Kolom kiri kartu HP diberi `min-w-0 flex-1` supaya teks panjang tidak mendorong badge
  status di kanan.

Berkas: `src/app/pesanan/page.tsx` saja. Berkas ini dibuat dari versi terbaru di repo
Anda (commit `1040095`), hanya dua blok chip itu yang berubah.

---

## Perbaikan 20 Oktober 2026: scroll dashboard di HP tidak mulus

**Kenapa hanya dashboard?** Hanya dashboard yang punya hero foto, dan di hero itu
berkumpul beberapa efek yang berat untuk GPU HP. Halaman lain hanya berisi kartu biasa.

Penyebab yang ditemukan, dari yang paling berpengaruh:

1. **Dua bulatan cahaya `blur-3xl` (filter blur 64px) di hero.** Filter blur sebesar ini
   termasuk efek paling mahal di HP. Ditambah lagi, header aplikasi memakai
   `backdrop-blur-xl`: saat hero lewat di bawah header, GPU harus memburamkan area yang
   isinya sudah diburamkan. Beban berlipat, dan ini hanya terjadi di dashboard.
2. **Tombol "Semua Pekerjaan" memakai `backdrop-blur-sm`.** Efek kaca ketiga di layar
   yang sama.
3. **Jam live berdetak setiap detik di dalam hero.** Setiap detik, area hero digambar
   ulang lengkap dengan efek-efek di atas. Saat menggulir, terasa tersendat sekali tiap
   detik. Jam juga tetap berdetak walau hero sudah tergulir jauh keluar layar.
4. **Carousel sorotan AI mengubah tinggi hero.** Kalau satu sorotan satu baris dan
   berikutnya dua baris, tinggi hero berubah setiap 4,5 detik, dan seluruh isi halaman di
   bawahnya ikut bergeser, termasuk saat sedang digulir.
5. **Efek hover ikut bekerja di layar sentuh.** Saat jari menyentuh layar untuk mulai
   menggulir, browser menganggap elemen di bawah jari sedang di-hover. Aturan `:has()`
   pada diagram donat membuat browser memeriksa ulang seluruh diagram tepat saat gulir
   dimulai.

Perbaikannya (**tampilan tidak berubah**):

| Masalah | Perbaikan |
| --- | --- |
| Filter `blur-3xl` | Diganti gradasi radial, posisi dan warna sama, tanpa filter |
| `backdrop-blur` tombol | Hanya aktif di layar md ke atas; di HP latar tombol sudah gelap |
| Hero digambar ulang saat digulir | Hero jadi lapisan GPU tersendiri (`.pf-hero`), cukup digeser |
| Jam berdetak terus | Berhenti saat keluar layar atau tab tidak aktif, langsung jalan lagi saat terlihat. Formatter dibuat sekali, angka `tabular-nums` agar tidak bergetar |
| Tinggi hero berubah | Semua sorotan ditumpuk di satu sel grid, tinggi selalu mengikuti yang terpanjang. Pergantian cukup lewat opacity. Carousel juga berhenti saat tidak terlihat |
| Hover di layar sentuh | Semua efek hover dashboard dibungkus `@media (hover: hover) and (pointer: fine)` |

Berkas: `dashboard.css`, `components/dashboard/DashboardHero.tsx`,
`components/LocalDateTime.tsx`, `components/HeroHighlightsCarousel.tsx`.

Yang sengaja **tidak** diubah: `backdrop-blur-xl` pada header dan navigasi bawah, karena
dipakai di semua halaman dan halaman lain sudah terasa mulus.

---

## Perubahan 21 Oktober 2026: satu bahasa visual untuk seluruh aplikasi

### Kondisi sebelum (hasil audit)

| Temuan | Jumlah |
| --- | --- |
| `font-extrabold` / `font-black` tersebar di komponen | 114 / 25 |
| Warna navy ditulis langsung (`text-[#07384f]`), tidak ikut sistem | 51 |
| Kelas `indigo` sisa tema lama (sebagian lolos dari override, tampil ungu) | 43 |
| Nilai radius berbeda | 13 macam |
| Bayangan buatan sendiri yang unik | 25 |
| Pola judul halaman | 2 pola berbeda |
| Em dash di teks | 134 |
| Dashboard memakai token `--pf-*`, halaman lain memakai kelas lama | 2 sistem |

### Yang dikerjakan

**1. Komponen dasar dipindah ke token.** `.card`, `.panel-glass`, `.btn-primary`,
`.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.input`, `.label`, `.chip`,
`.progress-track`, `.section-title`, `.icon-tile` sekarang membaca token yang sama
dengan panel dashboard. Nama kelas tidak berubah, jadi struktur HTML halaman tidak perlu
dibongkar. Karena kelas-kelas ini dipakai 100+ kali, satu perubahan berlaku di semua halaman.

**2. Peran warna dikunci.** Teal untuk interaksi (tautan, menu aktif, fokus, tombol
sekunder). Amber untuk satu aksi utama per layar dan tanda merek (logo, tombol Baru).
Hijau, kuning tua, oranye, merah hanya untuk status. Tombol utama tetap amber seperti
sebelumnya. Kalau ingin jadi teal, cukup ganti satu baris `--pf-cta` di `design-tokens.css`.

**3. Radius mengikuti yang sudah paling banyak dipakai:** kartu 16px, kontrol 12px,
badge pil. Pengecualian tunggal: hero foto dashboard (desain original).

**4. Permukaan gelap disamakan.** Panel dashboard dan kartu halaman lain sekarang sama-sama
kaca tembus tipis tanpa blur, gaya gelap yang memang sudah dipakai aplikasi sejak awal.

**5. Tipografi.** `font-extrabold` menjadi `font-semibold`, `font-black` menjadi `font-bold`,
di 55 berkas. Warna navy langsung diganti token `--pf-ink`, yang otomatis benar di mode gelap.
Label form menjadi huruf biasa, bukan kapital kecil berjarak lebar.

**6. Judul halaman satu pola** (`.page-title`) di 12 halaman. Label kapital kecil di atas
judul (Mitra, Shift, Pengaturan, Notifikasi) dihapus, karena judulnya sudah menjelaskan.

**7. Sisa indigo diganti teal langsung**, termasuk yang tadinya lolos dari override dan
tampil ungu. Semua em dash diganti tanda hubung biasa.

**8. Panel Tanya AI** diselaraskan dengan panel dashboard lain. Logika tanya-jawab tidak diubah.

### Yang sengaja TIDAK diubah

- **Tata letak 3 kolom halaman detail** (`OrderDetailTabs.tsx`: sidebar 232px, isi, foto 380px).
  Tidak disentuh, sudah dicek tetap ada di hasil render.
- **Hero foto dashboard dan kartu KPI**, sesuai permintaan Anda sebelumnya.
- **Halaman login**. Latar, video, dan kartu kacanya hasil banyak iterasi Anda, jadi hanya em
  dash di judul tab yang diganti.
- **Judul di atas spanduk berwarna** (Catatan Perubahan, Mulai, Status), **halaman lacak
  publik** untuk pelanggan, dan **tampilan cetak**.
- **Zona B dan C**: `src/lib`, `src/app/api`, `src/db`, `src/proxy.ts`, service worker,
  manifest, assetlinks. Warna badge status tetap dari `domain.ts`.

### Pengujian

- `tsc --noEmit` dan `next build` pada repo Anda (commit `1040095`) dengan semua berkas baru.
- Aplikasi asli dijalankan lokal dengan database berisi data contoh, login sebagai Owner,
  lalu 14 halaman dibuka satu per satu: `/`, `/pesanan`, `/pesanan/1`, `/pesanan/baru`,
  `/pelanggan`, `/mitra`, `/serah-terima`, `/pengaturan`, `/pengguna`, `/notifikasi`,
  `/mulai`, `/status`, `/audit`, `/sesi`. Semua status 200 dan tidak ada error render.
