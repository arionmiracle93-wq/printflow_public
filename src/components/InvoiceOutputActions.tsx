"use client";

import { useState } from "react";
import { FileDown, Loader2, MessageCircle, Printer } from "lucide-react";
import { SideButton } from "@/components/InvoiceSidebar";
import { downloadBlob, paperToPdf, printPaper, safeFileName, shareViaWhatsApp } from "@/lib/invoice-output";

/**
 * Tombol Cetak / Unduh PDF / Kirim WhatsApp.
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
  disabled,
}: {
  layout: "side" | "row";
  fileBase: string;
  waText: string;
  waPhone: string;
  showPdf: boolean;
  showWa: boolean;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<null | "print" | "pdf" | "wa">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const filename = `${safeFileName(fileBase)}.pdf`;

  async function run(kind: "print" | "pdf" | "wa") {
    setMsg(null);
    setBusy(kind);
    try {
      if (kind === "print") await printPaper();
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
        <div className="flex flex-wrap gap-2">
          {items.map((i) => (
            <button key={i.key} type="button" onClick={() => void run(i.key)} disabled={disabled || busy !== null} className="btn-secondary px-3 py-2 text-xs">
              {i.icon} {i.label}
            </button>
          ))}
        </div>
      )}
      {msg ? <p className="break-words rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">{msg}</p> : null}
    </div>
  );
}
