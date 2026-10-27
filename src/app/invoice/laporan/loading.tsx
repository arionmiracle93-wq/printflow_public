import { PageLoading } from "@/components/PageLoading";

/**
 * LOADER LAPORAN INVOICE
 * ===================================================================
 * Tanpa ini, mengetuk tab cara hitung (Bulanan / Harian / Rentang)
 * atau pintasan periode membuat layar diam tanpa tanda apa pun
 * beberapa ratus milidetik - pengguna mengira ketukannya tidak
 * registering.
 *
 * Bentuknya sama dengan loader modul invoice lain: cincin berlogo.
 * Yang ditunggu hanya pembaruan angka dan grafik, jadi labelnya
 * menyebut Laporan supaya pengguna tahu sedang menuju ke mana.
 */
export default function Loading() {
  return <PageLoading label="Memuat Laporan" />;
}