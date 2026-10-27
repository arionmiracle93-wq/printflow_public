import { redirect } from "next/navigation";
import { InvoiceSettingsForm } from "@/components/InvoiceSettingsForm";
import { ProblemScreen } from "@/components/ProblemScreen";
import { safeDb } from "@/lib/dbcheck";
import { getInvoiceAccess } from "@/lib/invoice-access";
import { getInvoiceSettings } from "@/lib/invoice-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pengaturan Invoice - Print Flow" };

/**
 * AREA INVOICE DI DALAM PENGATURAN
 * ===================================================================
 * Sempat berada di /invoice/pengaturan, dibungkus InvoiceFrame +
 * InvoiceSidebar supaya terlihat seperti halaman invoice yang lain.
 *
 * Bungkusnya sekarang dihapus. Alasannya bukan tampilan: halaman ini
 * bukan lagi bagian modul Invoice, dan sidebar invoice di halaman
 * pengaturan hanya menambah satu navigasi yang menyesatkan - dari
 * "Pengaturan" orang bisa melompat ke Riwayat, lalu kembali lewat
 * sidebar, lalu ke Pengaturan lagi. Jalur berputar yang tidak
 * mengarah ke mana pun.
 *
 * Navigasi Invoice (Usaha / Bayar / Dokumen / Tampilan) tidak lagi
 * digambar di halaman ini. Sempat berupa deretan tab internal milik
 * InvoiceSettingsForm, sekarang jadi butir-butir di daftar kiri
 * milik SettingsShell - satu daftar untuk selectable AREA
 * (Print Flow / Invoice) dan BAGIAN di dalamnya, supaya dua tingkat
 * navigasi tidak lagi jadi dua deretan yang bertumpuk.
 *
 * Karena itu halaman ini tidak lagi menggambar judul sendiri.
 * Judul yang tampil di kolom isi adalah nama bagian yang sedang
 * aktif, dan itu sudah digambar InvoiceSettingsForm.
 *
 * Query yang dijalankan hanya milik area ini. Membuka area Invoice
 * tidak menjalankan query logo, storage foto, dan rekap sistem yang
 * hanya dibutuhkan Print Flow - keduanya halaman terpisah, bukan
 * satu halaman besar yang menyembunyikan isi lewat kondisi.
 */
export default async function PengaturanInvoicePage() {
  const loaded = await safeDb(async () => {
    const access = await getInvoiceAccess();
    if (!access || !access.isOwner) return null;
    return getInvoiceSettings();
  });
  if (!loaded.ok) return <ProblemScreen problem={loaded.problem} hint="Pengaturan disimpan di database." />;
  if (!loaded.data) redirect("/tidak-diizinkan?dari=invoice");

  return <InvoiceSettingsForm initial={loaded.data} />;
}
