import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { QrisImage } from "@/components/QrisImage";
import { formatRupiah } from "@/lib/domain";
import type { PayInfo } from "@/lib/invoice-pay";
import type { InvoiceSettings } from "@/lib/invoice-settings";
import { qrisValidate } from "@/lib/qris";

/**
 * PANEL PEMBAYARAN DI KERTAS (dipakai editor dan halaman detail)
 * Metode (pilihan di editor / teks di detail), rekening dengan tombol salin, QRIS dinamis,
 * catatan pembayaran, dan kotak nominal: sisa tagihan + kode unik transfer.
 */
export function InvoicePayPanel({
  methodSlot,
  info,
  settings,
  isOwner,
  showAmountBox = true,
}: {
  methodSlot: ReactNode;
  info: PayInfo;
  settings: InvoiceSettings;
  isOwner: boolean;
  showAmountBox?: boolean;
}) {
  const isTransfer = info.method === "Transfer";
  const isQris = info.method === "QRIS";
  const banks = settings.banks.filter((b) => b.no);
  const qrisOk = Boolean(settings.qris) && qrisValidate(settings.qris).ok;
  const boxVisible = showAmountBox && (isTransfer || isQris) && info.payable > 0;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 p-3">
      {methodSlot}

      {isTransfer && banks.length ? (
        <ul className="space-y-1.5">
          {banks.map((b, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs">
              <span className="min-w-0">
                <b className="text-slate-900">{b.bank}</b> <span className="font-mono">{b.no}</span>
                {b.name ? <span className="block text-[10.5px] text-slate-500">a.n. {b.name}</span> : null}
              </span>
              <CopyButton text={b.no.replace(/[^0-9]/g, "")} label="Salin nomor rekening" />
            </li>
          ))}
        </ul>
      ) : null}

      {isTransfer && !banks.length ? (
        <p className="ppi-screen-only rounded-xl border border-dashed border-teal-300 bg-teal-50/60 px-2.5 py-2 text-[11px] font-bold text-teal-800">
          Nomor rekening belum diisi
          {isOwner ? <> — <Link href="/invoice/pengaturan" className="underline">klik untuk mengatur</Link></> : "."}
        </p>
      ) : null}

      {isQris && qrisOk && info.payable > 0 ? <QrisImage qris={settings.qris} amount={info.payable} /> : null}
      {isQris && !qrisOk ? (
        <p className="ppi-screen-only rounded-xl border border-dashed border-teal-300 bg-teal-50/60 px-2.5 py-2 text-[11px] font-bold text-teal-800">
          Kode QRIS belum diisi
          {isOwner ? <> — <Link href="/invoice/pengaturan" className="underline">klik untuk mengatur</Link></> : "."}
        </p>
      ) : null}

      {settings.paymentNote && (isTransfer || isQris) ? <p className="text-[11px] text-slate-500">{settings.paymentNote}</p> : null}

      {boxVisible ? (
        <div className="rounded-xl bg-teal-50 px-3 py-2">
          <p className="text-[9.5px] font-extrabold uppercase tracking-wider text-teal-700">
            {info.isPartial ? "Sisa yang harus dibayar" : "Nominal pembayaran"}
          </p>
          {info.code > 0 ? (
            <>
              <div className="mt-0.5 flex justify-between text-xs text-slate-600"><span>Tagihan</span><span>{formatRupiah(info.base)}</span></div>
              <div className="flex justify-between text-xs text-slate-600"><span>Kode unik</span><span>+ {info.code}</span></div>
              <div className="mt-0.5 flex items-baseline justify-between border-t border-teal-200 pt-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700">Total transfer</span>
                <span className="text-lg font-extrabold text-teal-900">{formatRupiah(info.payable)}</span>
              </div>
              <p className="mt-1 flex items-start gap-1 text-[10.5px] font-semibold text-amber-800">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" /> Transfer TEPAT sampai 3 angka terakhir agar cepat kami verifikasi.
              </p>
            </>
          ) : (
            <p className="text-lg font-extrabold text-teal-900">{formatRupiah(info.payable)}</p>
          )}
          {isQris ? <p className="text-[10.5px] text-slate-500">Nominal sudah tertera pada QRIS di atas.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
