"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { Building2, FileText, Palette, Printer, ReceiptText, Wallet, type LucideIcon } from "lucide-react";

/**
 * NAVIGASI PENGATURAN: KONTEKS, DAFTAR, DAN DUA JENIS BUTIR
 * ===================================================================
 * Pengaturan punya DUA tingkat: pilih AREA (Print Flow / Invoice),
 * lalu pilih BAGIAN di dalam area itu (Usaha / Bayar / Dokumen /
 * Tampilan). Dua tingkat itu dulu digambar sebagai dua deretan tab
 * mendatar yang bertumpuk.
 *
 * Sekarang keduanya jadi satu daftar di kiri. Perbedaan jenisnya
 * penting dan tidak boleh dicampur:
 *
 * - Butir AREA pindah HALAMAN. Dia <Link>, bukan tombol. Mengklik
 *   "Print Flow" benar-benar mengubah URL ke /pengaturan.
 *
 * - Butir BAGIAN hanya pindah ISI, tidak pindah halaman. Dia tombol
 *   yang mengubah state React.
 *
 * Kenapa bagian harus tombol dan bukan URL (/pengaturan/invoice/dokumen
 * dan seterusnya)? Karena keempatnya menulis ke row yang SAMA di
 * database dan dipaketkan jadi satu tombol Simpan. Kalau bagian
 * pindah URL, tiap klik membuat instance form yang baru, dan semua
 * isian yang belum disimpan ikut hilang. Menu pengaturan bukan tempat
 * pengguna tidak pantas kehilangan kerjaannya karena salah klik navigasi.
 *
 * AREA aktif dibaca dari pathname, BAGIAN aktif dari state.
 * Bedanya bukan sekadar cara: area benar-benar berubah isi URL-nya,
 * sedangkan bagian tidak boleh punya URL sama sekali.
 */

export type AreaPengaturan = "printflow" | "invoice";
export type BagianInvoice = "usaha" | "bayar" | "dokumen" | "tampilan";

type Butir = { nilai: string; label: string; Ikon: LucideIcon; href?: string };

/* Kelompok SISTEM: berpindah halaman.

   Label area pertama diganti dari "Print Flow" menjadi "Produksi" supaya
   sama dengan kartu di home dan dengan segmen switcher di header. Kalau
   sini tetap menuliskan nama merek sementara semua tempat lain menulis
   nama modul, orang akan mengira "Print Flow" itu modul ketiga.

   NILAI "printflow" SENGAJA TIDAK BERUBAH. Ia bukan hanya label, tapi
   juga kunci URL (/pengaturan?area=printflow) yang sudah pernah dipakai
   orang dan tersimpan di bookmark. Mengganti label aman; mengganti kunci
   mematikan bookmark itu. */
export const AREA_ITEMS: (Butir & { nilai: AreaPengaturan; href: string })[] = [
  { nilai: "printflow", label: "Produksi", Ikon: Printer, href: "/pengaturan" },
  { nilai: "invoice", label: "Invoice", Ikon: ReceiptText, href: "/pengaturan/invoice" },
];

/** Kelompok INVOICE: berpindah isi, satu instance form. */
export const BAGIAN_ITEMS: (Butir & { nilai: BagianInvoice })[] = [
  { nilai: "usaha", label: "Usaha", Ikon: Building2 },
  { nilai: "bayar", label: "Bayar", Ikon: Wallet },
  { nilai: "dokumen", label: "Dokumen", Ikon: FileText },
  { nilai: "tampilan", label: "Tampilan", Ikon: Palette },
];

type NilaiNav = {
  area: AreaPengaturan;
  bagian: BagianInvoice;
  setBagian: (b: BagianInvoice) => void;
};

export const NavPengaturanContext = createContext<NilaiNav | null>(null);

/**
 * Dipakai InvoiceSettingsForm untuk tahu bagian mana yang harus
 * digambar. Sengaja melempar error kalau dipakai di luar SettingsShell:
 * tanpa provider, bagian selalu "usaha" dan isi empat bagian
 * sisanya ikut hilang tanpa ada yang memberi tahu.
 */
export function useNavPengaturan(): NilaiNav {
  const v = useContext(NavPengaturanContext);
  if (!v) throw new Error("useNavPengaturan harus dipakai di dalam <SettingsShell>.");
  return v;
}

/**
 * KOLOM NAVIGASI PENGATURAN
 * ===================================================================
 * Diletakkan di kiri pada layar lebar. Di bawah 1024px jadi kisi
 * DUA KOLOM di atas isi - bukan baris yang digulir mendatar, supaya
 * tidak ada butir yang keluar layar tanpa petunjuk apa pun.
 *
 * Dua butir bisa aktif bersamaan ("Invoice" dan "Dokumen"), karena
 * keduanya memang sama-sama benar di tingkatnya masing-masing -
 * TAPI hanya ketika area yang sedang dibuka memang Invoice.
 *
 * KELOMPOK INVOICE MATI SAAT AREA-NYA PRINT FLOW
 * Keempat butir bagian mengatur isi halaman Invoice. Ketika yang
 * terbuka Print Flow, halaman itu tidak menampilkan form Invoice
 * sama sekali, jadi menggeser "Dokumen" tidak akan mengubah
 * apa pun yang terlihat. Tombolnya karena itu dimatikan.
 *
 * Dua hal yang harus jalan bareng, kalau hanya satu salah:
 * 1. disabled, supaya klik benar-benar tidak mengubah bagian.
 * 2. aria-current TIDAK dipasang, supaya garis penanda aktifnya
 *    ikut hilang.
 *
 * Yang kedua ini yang mudah terlewat. Tombol yang disabled tapi
 * masih memakai aria-current akan tampil sama aktifnya dengan
 * tombol yang bisa diklik - dari jauh tidak bisa dibedakan, dan
 * "isi yang tampil = Usaha" sementara yang di layar sebenarnya
 * adalah Print Flow. Persis kasus yang dikeluhkan pemilik.
 */
export function SettingsNav() {
  const { area, bagian, setBagian } = useNavPengaturan();
  // Keempat butir bagian hanya hidup di area Invoice.
  const mati = area !== "invoice";

  return (
    <nav className="pf-setnav p-2" aria-label="Area dan bagian pengaturan">
      {/* Kepala kelompok SISTEM. col-span-2 hanya berlaku di mode
          kisi (mobile); di layar lebar butirnya menumpuk sendiri. */}
      <p className="pf-setnav-group col-span-2">Sistem</p>
      <ul className="grid grid-cols-2 gap-0.5 lg:block">
        {AREA_ITEMS.map((b) => (
          <li key={b.nilai} className="min-w-0">
            <Link
              href={b.href}
              aria-current={area === b.nilai ? "page" : undefined}
              className="pf-setnav-item"
            >
              <b.Ikon size={17} strokeWidth={2.1} />
              <span className="min-w-0 truncate">{b.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="pf-setnav-sep" role="presentation" />

      <p className="pf-setnav-group col-span-2" data-mati={mati ? "" : undefined}>
        Invoice
      </p>
      <ul className="grid grid-cols-2 gap-0.5 lg:block">
        {BAGIAN_ITEMS.map((b) => (
          <li key={b.nilai} className="min-w-0">
            <button
              type="button"
              disabled={mati}
              aria-current={!mati && bagian === b.nilai ? "true" : undefined}
              className="pf-setnav-item"
              onClick={() => setBagian(b.nilai)}
            >
              <b.Ikon size={17} strokeWidth={2.1} />
              <span className="min-w-0 truncate">{b.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
