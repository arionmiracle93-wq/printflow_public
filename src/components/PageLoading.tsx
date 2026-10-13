import { LoadingIndicator, type LoadingIndicatorSize } from "@/components/LoadingIndicator";

/**
 * HALAMAN YANG SEDANG MEMUAT (loader berlogo)
 * ---------------------------------------------------------
 * Dipakai berkas loading.tsx untuk halaman yang TIDAK punya kerangka
 * khusus. Halaman yang punya bentuknya sendiri (daftar pekerjaan,
 * pengaturan, kartu pelanggan) tetap pakai PageSkeleton - kerangka itu
 * memberi tahu pengguna sedang memuat tabel atau form, sedangkan
 * kerangka generik tidak cocok dengan halaman mana pun.
 *
 * Bentuk cincinnya dot-circle dan labelnya menyebut nama halaman, jadi
 * pengguna tahu sedang menuju ke mana. Logo usaha berputar di dalam
 * cincin, persis di titik pusatnya.
 */
export function PageLoading({
  label,
  size = "lg",
  className = "",
}: {
  /** Contoh: "Memuat Invoice". */
  label: string;
  size?: LoadingIndicatorSize;
  className?: string;
}) {
  return (
    <div className={`grid min-h-[58vh] place-items-center py-10 ${className}`}>
      <LoadingIndicator type="dot-circle" size={size} label={label} />
    </div>
  );
}