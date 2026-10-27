"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { NavPengaturanContext, SettingsNav, type AreaPengaturan, type BagianInvoice } from "@/components/SettingsNav";

/**
 * CANGKANG PENGATURAN DUA KOLOM
 * ===================================================================
 * Memasang daftar di kiri dan isi di kanan, seperti Application
 * Settings di sistem operasi.
 *
 * Kenapa daftar dan isi harus hidup di SATU pohon React: butir
 * bagian (Usaha / Bayar / Dokumen / Tampilan) tidak mengubah URL,
 * hanya mengganti isi form. Kalau daftar hidup di layout dan isinya
 * hidup di halaman, keduanya terpisah dan tidak bisa saling
 * memberi tahu bagian mana yang aktif - hasilnya butir di kiri
 * selalu menyala atau tidak pernah sama sekali.
 *
 * Jadi daftar dipindah ke sini, dipanggil sebagai children dari
 * layout. Layout tetap server component: children-nya dirender di
 * server dan diteruskan apa adanya, jadi tidak ada query yang
 * berubah. Yang jadi client hanya lapisan yang memang memegang
 * state tab, bukan isi halamannya.
 *
 * AREA dibaca dari pathname, bukan dari state. Alasannya, pindah
 * area memang pindah halaman: kalau area ikut state, klik "Print
 * Flow" hanya mengubah isi tanpa mengubah URL, dan tombol
 * "kembali" di browser tidak tahu harus ke mana.
 *
 * BAGIAN disimpan di state dan sengaja TIDAK disimpan ke URL.
 * Empat bagian menulis ke satu row yang sama dan jadi satu tombol
 * Simpan. Kalau bagian ikut URL, tiap klik membuat instance form
 * baru dan isian yang belum disimpan ikut hilang.
 */
export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [bagian, setBagian] = useState<BagianInvoice>("usaha");

  // Default ke Print Flow: /pengaturan tanpa segmen apa pun.
  const area: AreaPengaturan = pathname.startsWith("/pengaturan/invoice") ? "invoice" : "printflow";

  return (
    <NavPengaturanContext.Provider value={{ area, bagian, setBagian }}>
      {/* Lebar kolom 244px + isi. Di bawah 1024px daftar menjadi
          kisi dua kolom di atas isi, jadi tidak ada gulir mendatar
          dan tidak ada butir yang keluar layar. */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[244px_minmax(0,1fr)] lg:items-start">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </NavPengaturanContext.Provider>
  );
}