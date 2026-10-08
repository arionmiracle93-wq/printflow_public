"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";
import { formatRupiah } from "@/lib/domain";
import { qrisWithAmount } from "@/lib/qris";

/**
 * Gambar QRIS dinamis: payload statis merchant + nominal tertanam (diporting dari app lama).
 * Dibuat sebagai GIF base64 (seperti app lama) supaya aman ikut ke PDF.
 */
export function QrisImage({ qris, amount, size = 138 }: { qris: string; amount: number; size?: number }) {
  const src = useMemo(() => {
    const payload = qrisWithAmount(qris, amount);
    if (!payload) return null;
    try {
      const qr = qrcode(0, "M");
      qr.addData(payload);
      qr.make();
      // Bingkai putih 4 modul (4px x 4) wajib menurut standar QR; tanpa itu sebagian pemindai gagal membaca.
      return qr.createDataURL(4, 16);
    } catch {
      return null;
    }
  }, [qris, amount]);

  if (!src) return null;
  return (
    <div className="text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="QRIS" width={size} height={size} style={{ width: size, height: size, imageRendering: "pixelated" }} className="mx-auto rounded-lg border border-slate-200 bg-white" />
      <p className="mt-1 text-[10.5px] font-semibold text-slate-500">
        {amount > 0 ? `Nominal ${formatRupiah(amount)} sudah tertanam` : "Scan untuk membayar"}
      </p>
    </div>
  );
}
