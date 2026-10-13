import { PageLoading } from "@/components/PageLoading";

/**
 * Formulir pekerjaan baru tidak punya bentuk tata letak yang stabil
 * untuk digambar kerangka (jumlah baris produk dan mitra berubah-ubah),
 * jadi pakai loader berlogo, bukan kerangka generik.
 */
export default function Loading() {
  return <PageLoading label="Memuat form pekerjaan" />;
}