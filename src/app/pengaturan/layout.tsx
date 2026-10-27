import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import { SettingsShell } from "@/components/SettingsShell";

/**
 * KERANGKA PENGATURAN
 * ===================================================================
 * Dipakai oleh /pengaturan (Print Flow) dan /pengaturan/invoice.
 *
 * Yang ada di sini: judul, kalimat pengantar, dan cangkang dua kolom
 * yang memegang daftar di kiri. Isi tiap area tetap di halamannya
 * masing-masing - kerangka ini tidak mengambil data apa pun, jadi
 * membuka area Invoice tidak ikut menjalankan query logo, storage,
 * dan rekap sistem yang hanya dibutuhkan Print Flow.
 *
 * Daftar navigasi (Print Flow / Invoice di kiri, lalu Usaha / Bayar /
 * Dokumen / Tampilan) dulu digambar sebagai DUA deretan tab
 * mendatar: satu di kerangka ini, satu lagi di dalam form Invoice.
 * Sekarang keduanya jadi satu daftar di kiri.
 *
 * Kenapa satu daftar dan bukan tetap dua deretan: deretannya
 * bertumpuk di atas yang sama dan sama-sama memakan lebar layar
 * penuh, padahal isinya cuma daftar pendek. Di 360px tiap tab
 * hanya dapat sekitar 84px, sedangkan jumlah tabnya sudah enam.
 * Bentuk satu daftar di kiri juga memisahkan dua tingkatnya
 * dengan jelas - yang atas memilih AREA, yang bawah memilih
 * BAGIAN - dan dua-duanya bisa aktif bersamaan tanpa saling
 * menutupi.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="settings-page min-w-0 max-w-full space-y-4 overflow-x-clip">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Settings size={22} strokeWidth={2.3} /> Pengaturan
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Satu pintu untuk Print Flow dan Invoice. Pilih area di kiri.
        </p>
      </div>

      <SettingsShell>{children}</SettingsShell>
    </div>
  );
}
