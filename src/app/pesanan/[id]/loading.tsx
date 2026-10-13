import { PageLoading } from "@/components/PageLoading";

/**
 * Rincian pekerjaan adalah halaman yang paling lama selesai dimuat
 * (gambar, riwayat status, data pembayaran, catatan produksi), jadi
 * memakai loader berputar dengan label - bukan kerangka. Kerangka
 * 3 kolom untuk halaman ini terlalu banyak sebenarnya yang bergeser
 * saat data datang, sehingga yang terlihat bukan "memuat" tapi
 * "tata letak berserakan".
 */
export default function Loading() {
  return <PageLoading label="Memuat detail pekerjaan" />;
}