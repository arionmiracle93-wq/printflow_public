import { PageLoading } from "@/components/PageLoading";

/**
 * LOADER MODUL INVOICE
 * ===================================================================
 * Loader berlogo (cincin dot-circle) untuk daftar, detail, editor,
 * katalog, laporan, dan pengaturan. Modul ini belum punya kerangka
 * khusus, jadi yang tampil adalah loader berlogo - jauh lebih jujur
 * daripada kerangka generik yang tidak cocok dengan halaman mana pun.
 *
 * Percobaan sebelumnya menggantinya dengan kerangka + bilah tipis.
 * Loader cincin dikembalikan karena lebih enak dilihat dan tidak
 * menyisakan separuh layar kosong di tengah.
 */
export default function Loading() {
  return <PageLoading label="Memuat Invoice" />;
}