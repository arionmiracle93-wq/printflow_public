# Panduan: notifikasi native Android untuk APK "web to apk" (OneSignal)

APK hasil web to apk (freewebtoapk.com) berjalan di **WebView**. WebView tidak
mendukung Web Push, jadi notifikasi lama (VAPID) hanya muncul di browser Chrome.
Solusinya: kirim lewat **OneSignal**, yang menyampaikan notifikasi ke HP lewat
Firebase, sehingga muncul di panel notifikasi Android walau aplikasi tertutup.

Web Push yang lama **tidak dihapus**. Keduanya dikirim bersamaan, jadi Chrome dan
APK TWA tetap berfungsi seperti biasa.

## Yang perlu disiapkan (semuanya gratis)

Akun Google (untuk Firebase) dan akun OneSignal.

## Langkah 1 — Firebase: ambil kunci pengirim (sekali saja)

1. Buka <https://console.firebase.google.com> lalu buat proyek baru (atau pakai yang ada).
2. Klik ikon roda gigi → **Project settings** → tab **Cloud Messaging**.
3. Pastikan **Firebase Cloud Messaging API (V1)** berstatus aktif. Kalau nonaktif,
   klik menu titik tiga → **Open in Cloud Console** → **Enable**, tunggu beberapa menit.
4. Pindah ke tab **Service accounts** → **Generate new private key** → **Generate key**.
   File `.json` akan terunduh. **Simpan baik-baik**, jangan upload ke GitHub atau grup WhatsApp.
5. Di proyek Firebase **yang sama**, daftarkan aplikasi Android supaya dapat `google-services.json`
   (builder freewebtoapk memintanya, lihat Langkah 3): **Project settings → General → Your apps →
   Add app → Android**. Pada **Android package name**, isi **persis sama** dengan *Package Name*
   di builder freewebtoapk (huruf besar-kecil dan titiknya harus sama). Klik **Register app**, lalu
   **Download google-services.json**. Langkah-langkah SDK sesudahnya boleh dilewati.

Dua file `.json` ini berbeda fungsi: **Service Account** (langkah 4) untuk OneSignal, dan
**google-services.json** (langkah 5) untuk builder APK. Keduanya harus berasal dari **satu proyek
Firebase yang sama**, kalau beda proyek notifikasinya tidak akan sampai.

## Langkah 2 — OneSignal: buat aplikasi

1. Daftar/login di <https://onesignal.com>, lalu **New App**, beri nama (misalnya Print Flow).
2. Pilih platform **Google Android (FCM)**, lalu unggah file `.json` dari Langkah 1
   pada kolom **Service Account JSON**.
3. Lanjutkan wizard sampai muncul **App ID** (kode 36 karakter). Kalau terlewat, lihat di
   **Settings → Keys & IDs**.
4. Di halaman yang sama, salin juga **App API Key** (kunci REST). Kunci ini RAHASIA dan
   hanya untuk Vercel (Langkah 4). **Jangan dimasukkan ke APK.**

## Langkah 3 — Bangun ulang APK di freewebtoapk.com

1. Buka builder, ulangi proses seperti sebelumnya. Di kartu **Push Notifications** pilih
   **OneSignal** (bukan "My Firebase (FCM)"), isi **OneSignal App ID** dari Langkah 2, dan
   pilih file **google-services.json** dari Langkah 1 (nomor 5) pada kolom **Choose File**.
   Pastikan kolomnya benar-benar terisi, bukan masih "No file chosen".
2. Pakai **nama paket (package name) yang sama** dengan APK sebelumnya, supaya terpasang
   sebagai pembaruan dan bukan aplikasi baru. Menurut freewebtoapk, satu nama paket
   selalu ditandatangani dengan kunci yang sama.
3. Unduh APK baru lalu pasang di HP.

Pilihan "My Firebase (FCM)" di builder berarti notifikasi hanya dikirim dari konsol
Firebase, tanpa server PrintFlow. Itu bukan yang kita pakai.

## Langkah 4 — Vercel: pasang dua variabel

Vercel → proyek → **Settings → Environment Variables**:

| Nama | Isi |
| --- | --- |
| `ONESIGNAL_APP_ID` | App ID dari Langkah 2 |
| `ONESIGNAL_REST_API_KEY` | App API Key dari Langkah 2 |

Lalu **Redeploy**. Tidak ada perubahan database, jadi `/api/setup` tidak perlu dibuka.

## Langkah 5 — Uji

1. Buka APK baru. Saat Android menanyakan izin notifikasi, pilih **Izinkan**.
2. Login, lalu buka **Pengaturan → Push Notification**. Di bagian 4 harus tertulis
   "Server siap mengirim lewat OneSignal".
3. Tekan **Uji OneSignal**, minimize APK, dan lihat panel notifikasi Android.
4. Cadangan: di dashboard OneSignal → **Audience → Subscriptions**, HP kamu harus
   muncul berstatus **Subscribed**.

## Siapa yang menerima notifikasi? (`ONESIGNAL_TARGETING`)

- **`all` (bawaan):** semua perangkat yang berlangganan menerima semua notifikasi.
  Berfungsi langsung tanpa syarat. Kekurangannya, operator ikut menerima notifikasi
  pekerjaan operator lain.
- **`external_id`:** hanya owner dan pengguna yang dituju (aturan yang sama dengan
  Web Push). **Syaratnya:** APK harus menautkan akun lewat `OneSignal.login("<id pengguna>")`
  di perangkat. Kalau APK tidak bisa melakukannya, JANGAN pakai mode ini, karena
  notifikasi tidak akan sampai ke siapa pun. Di kartu Push Notifications builder freewebtoapk
  tidak terlihat pilihan untuk menautkan akun seperti ini, jadi **pakai `all`** (tidak perlu
  mengisi `ONESIGNAL_TARGETING` sama sekali).

## Kalau tidak muncul

| Gejala | Penyebab umum |
| --- | --- |
| Uji OneSignal: "OneSignal belum dikonfigurasi" | Dua variabel Vercel belum diisi atau belum Redeploy |
| Error 401/403 | `ONESIGNAL_REST_API_KEY` salah (pakai App API Key, bukan App ID) |
| Berhasil dikirim tapi HP tidak menerima | FCM belum terhubung di OneSignal (Langkah 1-2), APK lama belum diganti, atau `google-services.json` berasal dari proyek Firebase / package name yang berbeda |
| "not subscribed" | Belum ada HP berlangganan: pasang APK baru, izinkan notifikasi, buka sekali |
| Izin tidak pernah ditanya | Android 13+: Pengaturan HP → Aplikasi → Print Flow → Notifikasi → Izinkan |
| Telat atau tidak muncul saat HP lama didiamkan | Matikan penghematan baterai untuk aplikasi ini |
| Notifikasi muncul dobel | HP juga berlangganan Web Push lewat Chrome: tekan **Nonaktifkan** di Chrome |

## Catatan

- Mengetuk notifikasi membuka aplikasi. Alamat halaman tujuan ikut dikirim sebagai data,
  tetapi apakah APK langsung membuka halaman itu bergantung pada builder.
- Paket gratis OneSignal cukup untuk pemakaian internal percetakan.
