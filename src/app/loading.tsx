import { PageLoading } from "@/components/PageLoading";

/**
 * Loader fallback untuk halaman yang tidak punya loading.tsx sendiri.
 * Halaman dengan bentuknya sendiri (daftar pekerjaan, pengaturan,
 * pelanggan, mitra, serah terima) memakai kerangka khususnya masing-masing.
 */
export default function Loading() {
  return <PageLoading label="Memuat halaman" />;
}