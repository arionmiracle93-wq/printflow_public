import { ModuleHome } from "@/components/ModuleHome";
import { getCurrentUser } from "@/lib/auth";
import { getInvoiceAccess } from "@/lib/invoice-access";

export const dynamic = "force-dynamic";

export const metadata = { title: "Beranda - Print Flow" };

/**
 * HOME SCREEN (rute "/")
 * =========================================================================
 * DULUNYA halaman ini berisi dashboard Produksi. Sekarang "/" adalah
 * pemilih modul, dan dashboard Produksi pindah ke /produksi (lihat
 * src/app/produksi/page.tsx).
 *
 * Dua modul setara: Produksi dan Invoice. Yang membedakan hanya izin.
 *
 * BIAYA QUERY: TIDAK ADA YANG TAMBAH.
 * - getCurrentUser dan getInvoiceAccess sama-sama dibungkus cache()
 *   dari React (lihat auth.ts dan invoice-access.ts). Layout sudah
 *   memanggil keduanya pada request yang sama, jadi panggilan di sini
 *   memakai hasil yang sama - bukan query kedua.
 * - Tidak ada data dashboard, tidak ada hitungan, tidak ada daftar.
 *   Home sengaja ringan supaya cepat muncul dan tetap tampil saat
 *   jaringan buruk.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  const canInvoice = user ? Boolean(await getInvoiceAccess()) : false;
  return <ModuleHome nama={user?.name ?? ""} bisaInvoice={canInvoice} />;
}
