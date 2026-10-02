# Fitur: Status per Produk dan Lebih dari 1 Mitra

## ⚠️ WAJIB setelah deploy

Fitur ini menambah 2 kolom di database. Begitu Vercel selesai deploy, **langsung buka sekali**:

```
https://alamat-aplikasi-anda.vercel.app/api/setup
```

(tambahkan `?token=...` kalau Anda memakai SETUP_TOKEN)

Tunggu sampai muncul `"ok": true`. Selama langkah ini belum dijalankan, halaman yang
membaca produk akan menampilkan layar "database bermasalah". Langkah ini aman diulang
kapan saja dan **tidak mengubah atau menghapus data lama**.

---

## Prinsip desain: karyawan tidak perlu belajar hal baru

1. **Status pekerjaan tetap satu, tetapi dihitung otomatis** dari produk yang paling
   lambat. Dashboard, skor risiko AI, halaman lacak, pesan WhatsApp, notifikasi, dan
   serah terima shift tetap membaca satu status itu, jadi semuanya tetap jalan tanpa diubah.
2. **Bawaannya semua produk "ikut status pekerjaan".** Order lama dan order 1 produk
   bekerja persis seperti sebelumnya. Status baru terpisah hanya saat seseorang memang
   mengubah tahap salah satu produk.
3. **Pintu masuknya tetap sama:** ketuk badge status di kartu (dashboard / daftar / detail).
4. **Aksi yang paling sering dijadikan 1 ketukan:** tiap produk punya tombol besar
   "ke tahap berikutnya" (misalnya "Finishing →").

## Cara pakai

### Status per produk

Ketuk badge status sebuah pekerjaan yang berisi beberapa produk. Popup menampilkan:

```
Per produk                          Pekerjaan: Cetak
┌──────────────────────────────────────────────────┐
│ Spanduk / Banner      2 pcs              [Cetak] │
│ [   Finishing  →   ]              [ tahap lain ▾]│
├──────────────────────────────────────────────────┤
│ Kartu Nama            1 box · di Sansina [Cetak] │
│ [   Finishing  →   ]              [ tahap lain ▾]│
└──────────────────────────────────────────────────┘
Semua produk sekaligus
[Antrian] [Desain] [Cetak] [Finishing] [QC] [Siap] ...
```

- **Tombol besar**: produk itu maju satu tahap. Satu ketukan.
- **Pilihan kecil di samping**: lompat ke tahap mana saja (ditunda, batal, mundur).
- **Semua produk sekaligus**: sama seperti tombol status yang dulu. Produk yang sudah
  lebih maju **tidak dimundurkan**.
- Di halaman detail, tabel "Item Pekerjaan" juga punya kolom **Tahap** yang bisa diganti.

Aturan status pekerjaan otomatis:

| Keadaan produk | Status pekerjaan |
| --- | --- |
| Spanduk Siap, Kartu Nama Cetak | **Cetak** (ikut yang paling lambat) |
| Semua produk Siap | **Siap** |
| Semua produk Selesai | **Selesai** |
| Semua yang belum selesai sedang Ditunda | **Ditunda** |
| Produk Batal | diabaikan dalam hitungan |

### Beberapa mitra

Tab **Mitra** di halaman detail:

- Belum ada mitra: tombol **Alihkan ke Mitra** seperti dulu.
- Tiap mitra tampil sebagai **ringkasan** (nama, status, produk, target, biaya).
  Formulir lengkap baru terbuka saat menekan **Ubah**.
- Tombol **Tambah mitra lain** untuk mitra kedua dan seterusnya.
- Kalau pekerjaan berisi beberapa produk, formulir menampilkan **centang produk** yang
  dikerjakan mitra itu. Produk yang belum dipegang mitra lain sudah tercentang otomatis.
- **Satu produk hanya di satu mitra.** Mencentang produk yang sedang di mitra lain akan
  memindahkannya (ada keterangannya).
- Margin dihitung dari **total biaya semua mitra**.

### Mitra langsung dari form Order Baru (tanpa bolak-balik)

Di kolom kanan form **Order Baru**, centang **"Lempar pekerjaan ini ke mitra"**:

- **Mitra 1 otomatis memegang semua produk.** Kalau satu pekerjaan dilempar utuh ke satu
  mitra (kasus paling umum), cukup pilih mitranya lalu simpan.
- **Tambah mitra lain** untuk mitra kedua dan seterusnya. Mitra baru otomatis mendapat
  produk yang belum dipegang mitra lain.
- **Centang produk** yang dikerjakan tiap mitra. Mencentang produk yang sedang di mitra
  lain akan memindahkannya (ada keterangan "sekarang di ...").
- **Produk yang tidak dicentang di mitra mana pun dikerjakan sendiri.**
- Pilihan produk hanya muncul kalau pekerjaan berisi lebih dari satu produk.
- Menghapus baris produk di tengah tabel tidak membuat pilihan mitra bergeser ke produk
  yang salah.
- Target kembali tiap mitra otomatis 1 hari sebelum deadline pelanggan, dan ikut bergeser
  kalau deadline diubah, kecuali sudah diubah manual.
- Tombol simpan menjadi **"Simpan Pekerjaan + 2 Mitra"** supaya jelas apa yang disimpan.
- Kalau ada mitra yang belum lengkap, form menolak menyimpan dan menyebut mitra mana yang
  kurang, misalnya "Mitra 2 (Minang): centang minimal satu produk". Pekerjaan tidak
  terlanjur dibuat setengah jadi.
- Kalau pekerjaan sudah tersimpan tetapi salah satu mitra gagal (koneksi putus), form
  menyebut mitra mana yang gagal dan pekerjaannya tetap aman untuk dilengkapi dari tab Mitra.

Kartu di dashboard dan daftar otomatis menampilkan gabungan nama, misalnya
**"Mitra: Sansina & Minang"**, dengan status mitra yang paling tertinggal.

## Data lama

- Mitra lama tanpa produk terpilih artinya "seluruh pekerjaan", sama seperti dulu.
- Mitra yang dulu diketik gabungan (contoh "sansina & minang") bisa dirapikan: buka
  **Ubah**, ganti namanya jadi satu mitra, centang produknya, lalu **Tambah mitra lain**
  untuk mitra kedua.

## Perubahan teknis (Zona C disentuh dengan sengaja)

| Berkas | Perubahan |
| --- | --- |
| `src/db/schema.ts` | `order_items.status`, `order_items.outsource_job_id`; `outsource_jobs.order_id` tidak lagi unik |
| `src/app/api/setup/route.ts` | Migrasi aditif (ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS) |
| `src/lib/item-status.ts` | **Baru.** Aturan hitung status (fungsi murni, tanpa database) |
| `src/lib/order-items.ts` | Tipe produk membawa `status`, `outsourceJobId`, dan `id` saat diedit |
| `src/lib/queries.ts` | Simpan produk tanpa menghapus status; ubah status produk; teruskan status pekerjaan ke produk |
| `src/lib/outsource-queries.ts` | Banyak mitra per pekerjaan; fungsi lama tetap ada untuk kompatibilitas |
| `src/app/api/orders/[id]/items/route.ts` | Tambah `PATCH` untuk status satu produk |
| `src/app/api/orders/[id]/outsource/route.ts` | Tambah/ubah/hapus mitra per id, `itemIds` |
| `src/app/api/orders/[id]/route.ts` | Status pekerjaan diteruskan ke produk |
| `QuickStatusPopup`, `OrderItemsManager`, `OutsourceManager` | Tampilan baru |
| `NewOrderForm` | Bisa lebih dari satu mitra sejak order dibuat, dengan pilihan produk |
| `pesanan/[id]`, `mitra`, `lacak/[token]` | Menampilkan data baru |

`src/lib/domain.ts` dan `src/lib/ai.ts` **tidak diubah**. Aturan bisnis baru ditaruh di
berkas terpisah (`item-status.ts`).

Notifikasi push untuk perubahan produk hanya dikirim kalau status **pekerjaan** ikut
berubah, supaya HP karyawan tidak dibanjiri notifikasi per produk.

## Cara pengujian

Diuji dengan mensimulasikan upgrade database produksi:

1. Aplikasi **versi lama** (commit `1040095`) dijalankan, database diisi data contoh, dan
   satu order 3 produk diberi mitra bergaya lama "sansina & minang".
2. Aplikasi **versi baru** dijalankan di atas database yang sama, lalu `/api/setup`
   dibuka dua kali. Hasilnya: constraint 1-mitra terlepas, 2 kolom baru ada, dan
   **8 order, 10 produk, 1 mitra, 16 riwayat tetap utuh**.
3. Skenario status per produk (6 langkah) dan multi mitra (6 langkah) dijalankan lewat
   API. Semua sesuai aturan, termasuk: status tidak hilang saat daftar produk diedit,
   dan produk "Siap" tidak dimundurkan.
4. 11 halaman dibuka dengan login Owner: semua status 200, tanpa error di log server.

### Uji form Order Baru di browser sungguhan

Form diisi oleh Chromium (Playwright) seperti karyawan, di database bersih:

| Skenario | Hasil |
| --- | --- |
| 4 produk, 2 mitra, lalu hapus baris produk di tengah | Tersimpan: Sansina = Spanduk; Minang = Stiker + Brosur (pilihan tidak bergeser) |
| 1 produk, 1 mitra | Tersimpan sebagai "seluruh pekerjaan", pilihan produk tidak muncul |
| Mitra ke-2 tanpa produk | Ditolak dengan pesan jelas, tidak ada pekerjaan yang terlanjur dibuat |

13 dari 13 pengecekan lulus, 0 error di log server. Di lebar layar HP 390px halaman
tidak bergeser ke samping.
