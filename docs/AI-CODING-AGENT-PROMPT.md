# Prompt — PrintFlow UI Reorganization

Saya ingin kamu mengerjakan reorganisasi UI pada aplikasi PrintFlow, khususnya modul **Rincian Pekerjaan**.

Baca terlebih dahulu:
- `docs/ui-reorganization/UI-REORGANIZATION.md`
- `docs/ui-reorganization/IMPLEMENTATION-CHECKLIST.md`
- `docs/ui-reorganization/VISUAL-REFERENCE.md`
- `docs/ui-reorganization/printflow-ui-reorganization-mockup.png` jika tersedia.

## ATURAN UTAMA

**JANGAN langsung coding.**

Ini adalah **UI REORGANIZATION**, bukan rewrite.

Pertahankan business logic, data, API, workflow, dan fungsi existing.

# PHASE 1 — AUDIT

Cari implementasi modul Rincian Pekerjaan dan audit:
1. page/component utama;
2. seluruh 9 card;
3. component yang digunakan;
4. state/props;
5. handler/action;
6. API/data source;
7. dependency antar-card;
8. CSS/style;
9. tab/navigation component yang sudah tersedia;
10. logic yang bergantung pada urutan rendering.

Pada fase ini **jangan ubah kode**.

Output:
```text
AUDIT REPORT
Main component:
Card components:
State:
Handlers:
API/data:
Dependencies:
Styles:
Reusable components:
Potential risks:
```

# PHASE 2 — VALIDATE MAPPING

Target wajib:
- Ringkasan: Rincian, Update Status, Analisa AI
- Produksi: Produksi Mitra
- Komunikasi: Kabari Pelanggan, Serah Terima Shift
- Foto: Foto Pekerjaan
- Lainnya: Ubah Data, Riwayat

Pastikan semua 9 fungsi terpetakan.

Jika specification berbeda dengan kode existing, jangan menebak. Laporkan:
```text
SPECIFICATION vs EXISTING IMPLEMENTATION
...
```

# PHASE 3 — IMPLEMENTATION PLAN

Sebelum coding, buat plan berisi:
- file yang diubah;
- component yang dibuat;
- component yang direuse;
- component yang dipindahkan;
- state yang diperlukan;
- state yang tetap;
- handler yang tetap;
- risiko;
- strategi regression prevention.

**Jangan implementasi sebelum plan selesai.**

# PHASE 4 — IMPLEMENT

Target:
```text
Header Pekerjaan
        ↓
[Ringkasan] [Produksi] [Komunikasi] [Foto] [•••]
        ↓
Active Tab Content
```

Ringkasan adalah default.

Gunakan component existing sebisa mungkin.

Jangan membuat 9 tab.
Jangan membuat Analisa AI sebagai tab utama.

# PHASE 5 — REGRESSION CHECK

Pastikan:
1. semua 9 fungsi tetap tersedia;
2. semua button/action tetap bekerja;
3. data tetap tampil;
4. status update tetap bekerja;
5. Produksi Mitra tetap bekerja;
6. WhatsApp/copy message tetap bekerja;
7. Foto tetap bekerja;
8. Edit pekerjaan tetap bekerja;
9. Riwayat tetap tampil;
10. AI tetap tampil;
11. tab navigation bekerja;
12. mobile tidak horizontal overflow;
13. tidak ada duplikasi;
14. tidak ada fungsi hilang.

Jika tersedia, jalankan build/lint/test.

# SCOPE GUARD

Jangan:
- ubah database schema;
- ubah API;
- ubah business logic;
- ubah workflow status;
- hapus field/fungsi;
- ganti design system;
- ganti global navigation;
- tambah library tanpa alasan;
- buat architecture baru tanpa alasan;
- redesign besar di luar scope.

Improvement di luar scope masuk ke:
`OPTIONAL IMPROVEMENTS`
dan jangan diimplementasikan.

# REUSE-FIRST

Sebelum membuat component baru:
1. cari component existing;
2. cari utility existing;
3. cari state existing;
4. cari handler existing;
5. cari style/token existing.

Jangan rewrite card hanya karena berpindah tab.

# STOP CONDITIONS

Berhenti dan minta klarifikasi jika:
- specification bertentangan dengan business logic;
- fungsi tidak dapat dipindahkan tanpa perubahan behavior;
- dependency tidak jelas;
- DB/API tampak harus diubah;
- ada risiko kehilangan data;
- ada beberapa solusi yang mengubah behavior secara berbeda.

Jangan menyelesaikan ambiguity dengan menebak.

# OUTPUT SETELAH IMPLEMENTASI

```text
IMPLEMENTATION SUMMARY

Changed:
- ...

Reused:
- ...

Added:
- ...

Business logic changed:
- NONE / jelaskan

Database/API changed:
- NONE / jelaskan

Verification:
- Build:
- Lint:
- Tests:
- Manual checks:

Known limitations:
- ...

Optional improvements:
- ...
```

Mulai dari **PHASE 1 — AUDIT**. Jangan mengubah kode sebelum audit dan implementation plan selesai.
