import { formatDateID, formatRupiah } from "@/lib/domain";
import { DOC_MODES, docModeOf } from "@/lib/invoice-modes";
import type { PayInfo } from "@/lib/invoice-pay";
import type { InvoiceSettings } from "@/lib/invoice-settings";

/** Nomor WhatsApp gaya Indonesia: "0812-3456" -> "628123456". Kosong bila tidak valid. */
export function formatWhatsAppNumber(raw: string | null | undefined): string {
  let d = String(raw ?? "").replace(/[^0-9]/g, "");
  if (!d) return "";
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  else if (d.startsWith("8")) d = `62${d}`;
  return d.length >= 9 ? d : "";
}

type ShareDoc = {
  docType: string;
  number: string | null;
  customerName: string;
  issueDate: string;
  dueDate: string | null;
  payMethod: string;
  subtotal: number;
  discountAmount: number;
  discountType: string;
  discountRate: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  items: { productName: string; qty: number; areaM2: number; unitPrice: number; amount: number }[];
};

/**
 * Teks pesan WhatsApp untuk sebuah dokumen (dibuat di server, dipakai tombol Kirim WhatsApp).
 * Surat Jalan tanpa harga; hanya Invoice yang memuat tagihan & cara bayar.
 */
export function buildWhatsAppMessage(doc: ShareDoc, settings: InvoiceSettings, pay: PayInfo, paid: number): string {
  const mode = docModeOf(doc.docType);
  const L: string[] = [];
  L.push(`Halo ${doc.customerName}, berikut ${mode.label} dari ${settings.businessName}:`);
  L.push("");
  L.push(`*${mode.label} ${doc.number ?? "(draft)"}*`);
  L.push(`${mode.dateLabel}: ${formatDateID(doc.issueDate)}`);
  if (mode.dueLabel && doc.dueDate) L.push(`${mode.dueLabel}: ${formatDateID(doc.dueDate)}`);
  L.push("");
  L.push("Rincian:");
  doc.items.forEach((it, i) => {
    const qty = String(it.qty).replace(".", ",");
    const area = it.areaM2 > 0 ? ` (${String(it.areaM2).replace(".", ",")} m²)` : "";
    L.push(
      mode.showPrices
        ? `${i + 1}. ${it.productName}${area} — ${qty} x ${formatRupiah(Math.round(it.unitPrice))} = ${formatRupiah(it.amount)}`
        : `${i + 1}. ${it.productName}${area} — ${qty}`,
    );
  });
  if (mode.showTotals) {
    L.push("");
    if (doc.discountAmount > 0 || doc.taxAmount > 0) L.push(`Subtotal: ${formatRupiah(doc.subtotal)}`);
    if (doc.discountAmount > 0) L.push(`Diskon${doc.discountType === "persen" ? ` ${doc.discountRate}%` : ""}: - ${formatRupiah(doc.discountAmount)}`);
    if (doc.taxAmount > 0) L.push(`PPN ${doc.taxRate}%: ${formatRupiah(doc.taxAmount)}`);
    L.push(`*Total: ${formatRupiah(doc.total)}*`);
  }
  if (mode.hasPayments && doc.number) {
    if (paid > 0) L.push(`Terbayar: ${formatRupiah(paid)}`);
    if (pay.base > 0) {
      L.push(`*Sisa tagihan: ${formatRupiah(pay.base)}*`);
      L.push("");
      if (pay.method === "Transfer") {
        L.push("Pembayaran via Transfer:");
        settings.banks.filter((b) => b.no).forEach((b) => L.push(`• ${b.bank} ${b.no}${b.name ? ` a.n. ${b.name}` : ""}`));
        if (pay.code > 0) L.push(`Nominal transfer: *${formatRupiah(pay.payable)}* (sudah termasuk kode unik ${pay.code}, mohon transfer tepat sampai 3 angka terakhir)`);
      } else if (pay.method === "QRIS") {
        L.push(`Pembayaran via QRIS ${formatRupiah(pay.payable)} (scan kode QRIS pada dokumen).`);
      } else {
        L.push(`Pembayaran: ${pay.method}`);
      }
      if (settings.paymentNote) L.push(settings.paymentNote);
    } else if (paid > 0) {
      L.push("Status: *LUNAS* ✅");
    }
  }
  L.push("");
  L.push("Terima kasih 🙏");
  L.push(settings.businessName);
  return L.join("\n");
}

export { DOC_MODES };
