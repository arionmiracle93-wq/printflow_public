"use client";

import { useState } from "react";
import { FileDown, Loader2, MessageCircle, Printer, Receipt } from "lucide-react";
import { SideButton } from "@/components/InvoiceSidebar";
import { downloadBlob, paperToPdf, printPaper, safeFileName, shareViaWhatsApp } from "@/lib/invoice-output";
import { openInRawBT, printReceiptBrowser, receiptToEscPos, type ReceiptLine } from "@/lib/thermal-receipt";

/**
 * Tombol Cetak / Struk (thermal 58mm) / Unduh PDF / Kirim WhatsApp.
 * layout="side": di sidebar (layar lebar); layout="row": baris tombol (HP).
 * Tombol PDF dan WhatsApp bisa dimatikan di Pengaturan > Dokumen.
 */
export function InvoiceOutputActions({
  layout,
  fileBase,
  waText,
  waPhone,
  showPdf,
  showWa,
  receipt,
  disabled,
}: {
  layout: "side" | "row";
  fileBase: string;
  waText: string;
  waPhone: string;
  showPdf: boolean;
  showWa: boolean;
  /** Baris struk thermal dari server. Kosong = tombol Struk tidak tampil. */
  receipt?: ReceiptLine[];
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<null | "print" | "struk" | "pdf" | "wa">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const filename = `${safeFileName(fileBase)}.pdf`;

  /**
   * Struk thermal. HP/tablet Android -> aplikasi RawBT (Bluetooth/USB).
   * PC/laptop -> dialog cetak browser (printer dipilih di dialog).
   */
  async function printStruk() {
    if (!receipt?.length) throw new Error("Data struk tidak tersedia.");
    if (!/Android/i.test(navigator.userAgent)) {
      await printReceiptBrowser(receipt);
      return;
    }
    openInRawBT(receiptToEscPos(receipt));
    // Kalau RawBT terbuka, halaman ini pindah ke belakang. Kalau tidak, beri petunjuk.
    window.setTimeout(() => {
      if (document.visibilityState === "visible") setMsg("Struk belum terkirim? Pastikan aplikasi RawBT sudah terpasang dan printer Kassen sudah di-pair di Bluetooth HP.");
    }, 2000);
  }

  async function run(kind: "print" | "struk" | "pdf" | "wa") {
    setMsg(null);
    setBusy(kind);
    try {
      if (kind === "print") await printPaper();
      else if (kind === "struk") await printStruk();
      else if (kind === "pdf") downloadBlob(await paperToPdf(), filename);
      else {
        const r = await shareViaWhatsApp({ filename, text: waText, phone: waPhone });
        if (r === "fallback") setMsg("PDF diunduh dan WhatsApp dibuka. Lampirkan file PDF-nya ke chat.");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal memproses dokumen. Coba lagi.");
    } finally {
      setBusy(null);
    }
  }

  const spin = (k: string, icon: React.ReactNode) => (busy === k ? <Loader2 size={15} className="animate-spin" /> : icon);
  const items = [
    { key: "print" as const, label: "Cetak", icon: spin("print", <Printer size={15} />), show: true },
    { key: "struk" as const, label: "Struk", icon: spin("struk", <Receipt size={15} />), show: !!receipt?.length },
    { key: "pdf" as const, label: "Unduh PDF", icon: spin("pdf", <FileDown size={15} />), show: showPdf },
    { key: "wa" as const, label: "Kirim WhatsApp", icon: spin("wa", <MessageCircle size={15} />), show: showWa },
  ].filter((i) => i.show);

  return (
    <div className="space-y-1">
      {layout === "side" ? (
        <div className="space-y-0.5">
          {items.map((i) => (
            <SideButton key={i.key} icon={i.icon} onClick={() => void run(i.key)} disabled={disabled || busy !== null}>
              {i.label}
            </SideButton>
          ))}
        </div>
      ) : (
        /* HP: satu baris ikon-atas-label, sama seperti tombol aksi dokumen.
           Kalau hanya ada dua tombol (mis. WhatsApp dimatikan di
           Pengaturan), keduanya tetap berbagi lebar baris sehingga
           tidak ada ruang kosong yang aneh. */
        <div className="flex items-stretch gap-1">
          {items.map((i) => (
            <button
              key={i.key}
              type="button"
              onClick={() => void run(i.key)}
              disabled={disabled || busy !== null}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[color:var(--pf-ink-2)] hover:bg-[color:var(--pf-surface-2)] disabled:pointer-events-none disabled:opacity-45"
            >
              <span className="flex h-[19px] w-[19px] shrink-0 items-center justify-center [&>svg]:h-[19px] [&>svg]:w-[19px]">{i.icon}</span>
              <span className="w-full truncate text-center text-[10px] font-bold leading-tight">{i.label}</span>
            </button>
          ))}
        </div>
      )}
      {msg ? <p className="break-words rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">{msg}</p> : null}
    </div>
  );
}
