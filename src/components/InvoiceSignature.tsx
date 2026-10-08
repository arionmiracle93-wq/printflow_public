import type { InvoiceSettings } from "@/lib/invoice-settings";

/** Blok "Hormat kami," + tanda tangan + stempel (hanya tampil bila salah satu gambarnya sudah diunggah). */
export function InvoiceSignature({ settings }: { settings: InvoiceSettings }) {
  const hasSig = settings.signatureV > 0;
  const hasStamp = settings.stampV > 0;
  if (!hasSig && !hasStamp) return null;
  return (
    <section className="mt-6 flex flex-wrap items-end justify-between gap-6">
      {hasSig ? (
        <div className="text-center text-xs text-slate-700">
          <p>Hormat kami,</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/invoice-assets/signature?v=${settings.signatureV}`} alt="Tanda tangan" className="mx-auto my-1 h-16 w-auto max-w-[200px] object-contain" />
          <p className="font-bold text-slate-900">{settings.businessName}</p>
        </div>
      ) : <span />}
      {hasStamp ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/invoice-assets/stamp?v=${settings.stampV}`} alt="Stempel" className="h-24 w-auto max-w-[160px] object-contain" />
      ) : null}
    </section>
  );
}
