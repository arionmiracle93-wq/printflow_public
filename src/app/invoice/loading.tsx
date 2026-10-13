import { PageLoading } from "@/components/PageLoading";

/**
 * Loader halaman untuk SELURUH modul Invoice (daftar, detail, editor,
 * katalog, laporan, pengaturan). Modul ini belum punya kerangka khusus,
 * jadi yang tampil adalah loader berlogo - jauh lebih jujur daripada
 * kerangka generik yang tidak cocok dengan halaman mana pun.
 */
export default function Loading() {
  return <PageLoading label="Memuat Invoice" />;
}