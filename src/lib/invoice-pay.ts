import { uniqueCodeFor } from "@/lib/qris";

/**
 * NOMINAL YANG HARUS DIBAYAR PELANGGAN (diporting dari getPaymentInfo app lama)
 *  - dasar    = total dikurangi semua pembayaran yang sudah masuk
 *  - kode unik hanya untuk metode Transfer, dasar > 0, dan bila diaktifkan
 *  - ditransfer = dasar + kode unik
 */
export type PayInfo = {
  method: string;
  /** Sisa tagihan sebelum kode unik. */
  base: number;
  /** Kode unik (0 bila tidak dipakai). */
  code: number;
  /** Nominal yang ditransfer / dibayar (dasar + kode unik). */
  payable: number;
  /** true bila sudah ada pembayaran masuk (judul jadi "Sisa yang harus dibayar"). */
  isPartial: boolean;
};

export function computePayInfo(args: {
  total: number;
  paid: number;
  method: string;
  /** Nomor dokumen resmi; kosong untuk draft (kode unik baru ada setelah terbit). */
  number: string | null;
  uniqueCodeEnabled: boolean;
}): PayInfo {
  const paid = Math.max(0, Math.round(args.paid));
  const base = Math.max(0, Math.round(args.total) - paid);
  const useUnique = args.uniqueCodeEnabled && args.method === "Transfer" && base > 0 && Boolean(args.number);
  const code = useUnique ? uniqueCodeFor(args.number as string) : 0;
  return { method: args.method, base, code, payable: base + code, isPartial: paid > 0 };
}
