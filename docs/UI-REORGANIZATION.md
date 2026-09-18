# PrintFlow — UI Reorganization Specification

## Modul
**Rincian Pekerjaan**

## Kondisi saat ini
Single-page vertical scrolling dengan 9 card:
1. Rincian
2. Update Status Pekerjaan
3. Produksi Mitra
4. Ubah Data Pekerjaan
5. Foto Pekerjaan
6. Kabari Pelanggan
7. Serah Terima Shift
8. Analisa AI
9. Riwayat / Jejak Produksi

## Tujuan
Memecah halaman panjang menjadi area yang lebih fokus tanpa mengubah workflow dan business logic.

## Struktur target

```text
Header Pekerjaan
        ↓
[Ringkasan] [Produksi] [Komunikasi] [Foto] [•••]
        ↓
Active Tab Content
```

Jangan membuat 9 tab.

## Mapping final

| Area | Fungsi |
|---|---|
| Ringkasan | Rincian |
| Ringkasan | Update Status Pekerjaan |
| Ringkasan | Analisa AI / Insight AI |
| Produksi | Produksi Mitra |
| Komunikasi | Kabari Pelanggan |
| Komunikasi | Serah Terima Shift |
| Foto | Foto Pekerjaan |
| Lainnya | Ubah Data Pekerjaan |
| Lainnya | Riwayat / Jejak Produksi |

## Ringkasan
Menjawab: **apa pekerjaan ini, kondisinya bagaimana, dan apa yang perlu dilakukan?**

Pertahankan data Rincian yang sudah ada: jenis/jumlah, mesin/operator, deadline, sisa waktu, harga, pembayaran, tagihan, status/tag.

Update Status tetap mempertahankan workflow/status existing seperti Antrean, Desain, Cetak, Finishing, QC, Siap, Selesai, Ditunda, Batal — sesuai yang benar-benar ada di aplikasi.

Analisa AI ditempatkan sebagai **Insight AI** di Ringkasan. Jangan membuat tab AI tersendiri dan jangan membuat logic AI baru.

## Produksi
Berisi Card Produksi Mitra. Pertahankan seluruh field/action existing: mitra, status, biaya vendor, target kembali, catatan, save/delete/reset bila tersedia.

## Komunikasi
Berisi:
- Kabari Pelanggan: WhatsApp, salin pesan, dan fungsi existing lain.
- Serah Terima Shift: informasi untuk karyawan/operator berikutnya dan action existing.

## Foto
Berisi Card Foto Pekerjaan. Pertahankan Ambil Foto, Galeri, Clipboard bila ada, kategori foto, keterangan, preview, dan foto existing.

## Lainnya / Overflow
Gunakan `•••` atau mekanisme overflow setara untuk:
- Ubah Data Pekerjaan
- Riwayat / Jejak Produksi

Jangan hilangkan field atau action existing.

## Header
Header pekerjaan tetap di atas tab dan mempertahankan informasi penting yang sudah tersedia, misalnya nama pekerjaan, nomor pekerjaan, status, prioritas, kondisi, deadline/sisa waktu.

## UX
- Ringkasan adalah tab default.
- Tab adalah pengelompokan berdasarkan tujuan, bukan sekadar folder.
- Mobile: jika tab tidak muat, gunakan horizontal scrolling pada area tab saja.
- Jangan membuat tab menjadi dua baris.
- Jangan menyebabkan horizontal overflow pada seluruh halaman.

## Optional indicators
Boleh memakai indikator seperti `Produksi ●`, `Komunikasi !`, `Foto 3/8` hanya jika data tersebut sudah tersedia. Jangan membuat business logic baru hanya untuk indikator.

## Scope guard
### Jangan
- hapus fungsi/field;
- ubah database schema;
- ubah API;
- ubah business rules/workflow;
- redesign seluruh aplikasi;
- ganti global navigation;
- tambah library tanpa alasan;
- membuat 9 tab;
- membuat AI sebagai tab utama;
- rewrite component tanpa kebutuhan.

### Boleh
- membuat tab navigation;
- memindahkan card;
- membuat overflow menu;
- menyesuaikan spacing/hierarchy;
- refactor kecil yang diperlukan.

## Prinsip implementasi
1. Reuse component existing.
2. Reuse state existing.
3. Reuse handler existing.
4. Reuse API/data existing.
5. Reuse styles/design tokens.
6. Minimalkan perubahan business logic.

## Acceptance criteria
- [ ] Single-page 9-card bukan lagi struktur utama.
- [ ] Ringkasan menjadi default.
- [ ] 5 area tersedia: Ringkasan, Produksi, Komunikasi, Foto, Lainnya.
- [ ] Semua 9 fungsi tetap tersedia.
- [ ] Semua action existing tetap bekerja.
- [ ] Data/state tetap bekerja.
- [ ] Tidak ada perubahan DB/API yang tidak diperlukan.
- [ ] Mobile tidak horizontal overflow.
- [ ] Tidak ada card duplikat atau fungsi hilang.
