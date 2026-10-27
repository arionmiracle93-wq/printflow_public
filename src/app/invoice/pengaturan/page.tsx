import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * URL LAMA PENGATURAN INVOICE
 * ===================================================================
 * Dulu di sinilah pengaturan Invoice berada, dibungkus sidebar modul
 * invoice. Sekarang semuanya menyatu di /pengaturan dengan tab
 * "Print Flow" dan "Invoice".
 *
 * File ini sengaja TIDAK dihapus, hanya mengalihkan. Alasannya:
 *
 * 1. Ada tautan dari luar yang tidak bisa diperbarui - skrip,
 *    bookmark di HP orang, dan catatan yang sudah dibagikan.
 *    Kalau file ini dihapus, semuanya jadi 404.
 * 2. Menghapus rute tanpa pengalihan menyisakan halaman kosong yang
 *    gagal dimuat tanpa penjelasan.
 *
 * redirect() (bukan notFound) dipilih supaya yang membuka tautan
 * lama langsung sampai di tab yang benar, dan URL di bilah alamat
 * ikut benar - tidak ada dua alamat untuk satu halaman.
 */
export default function InvoiceSettingsRedirect() {
  redirect("/pengaturan/invoice");
}
