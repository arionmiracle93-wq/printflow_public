import { ClipboardList, Download, History, Package, Users, Wallet } from "lucide-react";

/**
 * KARTU UNDUH CADANGAN (CSV / EXCEL)
 * ===================================================================
 * Sempat bagian paling bawah di dalam AdminActions, jadi ikut
 * berada di kolom kiri halaman Pengaturan.
 *
 * Dipindah ke bawah kartu "Penyimpanan foto" di kolom kanan atas
 * permintaan pemilik. Alasannya bukan hiasan: di kolom kiri, kartu
 * ini menduduki posisi paling bawah sementara kolom kanan sudah
 * habis di tengah halaman. Kartu cadangan yang paling sering dibuka
 * justru yang paling jauh dari mata, dan ruang kosong sepanjang
 * itu terlihat seperti ada yang gagal dimuat.
 *
 * DIHAPUS DARI AdminActions, BUKAN DIGANDUNG.
 *
 * Yang tersisa di AdminActions punya state sendiri: sedang,
 * pesan, isi data contoh, hapus data contoh, dan salin alamat
 * aplikasi. Kartu ini tidak punya satu pun dari itu - isinya
 * cuma lima tautan ke /api/export yang selalu sama.
 *
 * Kalau kartu ini tetap digantung, memindahkannya berarti
 * menyeret semua state itu ke kolom yang salah, atau memotong
 * kartu dari komponennya lalu menyisakan state yang tidak
 * lagi ada yang memakainya.
 *
 * Nol prop. Bukan sekadar tidak sekarang, memang tidak perlu:
 * tidak ada isian, tidak ada status, tidak ada data dari server.
 * Yang berubah di dunia nyata (jumlah foto, kapasitas terpakai)
 * tidak muncul di sini.
 */
export function BackupDownloads() {
  return (
    <div className="card min-w-0 max-w-full overflow-hidden p-4">
      <h3 className="flex items-center gap-1.5 break-words text-sm font-bold text-slate-900">
        <Download size={16} /> Unduh cadangan (CSV / Excel)
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        File terbuka rapi di Excel/Google Sheets. Saran: unduh sebulan sekali dan simpan di Google Drive.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <a href="/api/export?type=orders" className="btn-ghost inline-flex items-center gap-1.5">
          <ClipboardList size={14} /> Pekerjaan (CSV)
        </a>
        <a href="/api/export?type=pelanggan" className="btn-ghost inline-flex items-center gap-1.5">
          <Users size={14} /> Pelanggan (CSV)
        </a>
        <a href="/api/export?type=keuangan" className="btn-ghost inline-flex items-center gap-1.5">
          <Wallet size={14} /> Keuangan &amp; Piutang (CSV)
        </a>
        <a href="/api/export?type=riwayat" className="btn-ghost inline-flex items-center gap-1.5">
          <History size={14} /> Riwayat Produksi (CSV)
        </a>
        <a href="/api/export?type=item" className="btn-ghost inline-flex items-center gap-1.5 sm:col-span-2">
          <Package size={14} /> Rincian Item per Produk (CSV)
        </a>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        File &ldquo;Pekerjaan&rdquo; berisi satu baris per pekerjaan (isi produknya digabung dalam satu kolom),
        sedangkan &ldquo;Rincian Item&rdquo; memecah tiap produk jadi barisnya sendiri - cocok untuk menghitung
        total per jenis produk.
      </p>
    </div>
  );
}
