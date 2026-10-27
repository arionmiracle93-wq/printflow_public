/**
 * STRUK THERMAL 58mm (printer Kassen) - kode murni, aman dipakai di server maupun browser.
 *
 * Satu sumber untuk dua jalur cetak, supaya isi struknya SELALU sama:
 *  1. PC / laptop  -> printReceiptBrowser(): cetak lewat dialog cetak browser + driver printer.
 *  2. HP / tablet  -> receiptToEscPos() + openInRawBT(): kirim perintah ESC/POS ke aplikasi
 *                     RawBT (gratis di Play Store), yang lanjut ke printer Bluetooth/USB.
 *
 * Alurnya: server memanggil buildReceiptLines() (data invoice -> daftar baris teks),
 * baris itu dikirim ke tombol "Struk", dan tombol memilih jalurnya.
 * Lebar 32 karakter = ukuran standar kertas 58mm (font A). Kalau di printer ada baris
 * kosong ekstra setelah garis, ganti RECEIPT_COLS jadi 31.
 */
import type { InvoiceDetail } from "@/lib/invoice-queries";
import type { InvoiceSettings } from "@/lib/invoice-settings";
import { docModeOf } from "@/lib/invoice-modes";

export const RECEIPT_COLS = 32;

export type ReceiptLine = { text: string; align?: "l" | "c" | "r"; bold?: boolean };

/** Printer thermal hanya paham ASCII: hapus aksen, ubah simbol umum, sisanya jadi "?". */
function ascii(s: string): string {
  return s
    .replace(/²/g, "2")
    .replace(/[–—]/g, "-")
    .replace(/[•·]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

/** Potong teks panjang per kata supaya muat di lebar kertas. */
function wrap(text: string, cols: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = "";
    for (let word of ascii(para).trim().split(/\s+/).filter(Boolean)) {
      while (word.length > cols) {
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(word.slice(0, cols));
        word = word.slice(cols);
      }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= cols) line += " " + word;
      else {
        out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

/** Baris dua kolom: kiri rata kiri, kanan rata kanan. */
function row(left: string, right: string, cols: number): string {
  const l = ascii(left);
  const r = ascii(right);
  const gap = cols - l.length - r.length;
  if (gap >= 1) return l + " ".repeat(gap) + r;
  return l.slice(0, Math.max(0, cols - r.length - 1)) + " " + r;
}

const num = (n: number) => {
  const s = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return n < 0 ? `-${s}` : s;
};
const qtyStr = (q: number) => String(Math.round(q * 1000) / 1000).replace(".", ",");
const dateShort = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join("/") : "-");

/** Data dokumen -> daftar baris struk. Dijalankan di server (murni, tanpa database). */
export function buildReceiptLines(detail: InvoiceDetail, settings: InvoiceSettings, cols = RECEIPT_COLS): ReceiptLine[] {
  const { invoice, items, summary } = detail;
  const mode = docModeOf(invoice.docType);
  const L: ReceiptLine[] = [];
  const dash = "-".repeat(cols);
  const add = (text: string, o: Omit<ReceiptLine, "text"> = {}) => void L.push({ text, ...o });
  const addWrapped = (text: string, o: Omit<ReceiptLine, "text"> = {}) => wrap(text, cols).forEach((t) => add(t, o));

  // --- Kop usaha ---
  addWrapped(settings.businessName, { align: "c", bold: true });
  settings.address
    .split(/\r?\n/)
    .filter(Boolean)
    .forEach((l) => addWrapped(l, { align: "c" }));
  if (settings.phone) addWrapped(settings.phone, { align: "c" });
  add(dash);

  // --- Identitas dokumen ---
  if (invoice.status === "draft") add("*** DRAFT ***", { align: "c", bold: true });
  add(mode.title, { align: "c", bold: true });
  add(row("No", invoice.number ?? `Draft #${invoice.id}`, cols));
  add(row(mode.dateLabel, dateShort(invoice.issueDate), cols));
  if (mode.dueLabel && invoice.dueDate) add(row(mode.dueLabel, dateShort(invoice.dueDate), cols));
  if (settings.showCustomerOnPrint) {
    addWrapped(`Kepada: ${invoice.customerName}`);
    if (invoice.customerPhone) addWrapped(invoice.customerPhone);
  }
  add(dash);

  // --- Item ---
  items.forEach((it) => {
    addWrapped(it.productName, { bold: true });
    if (it.description) addWrapped(it.description);
    const area = it.areaM2 > 0 ? ` (${qtyStr(it.areaM2)}m2)` : "";
    const qtyPart = `${qtyStr(it.qty)} ${it.unit}${area}`;
    if (mode.showPrices) {
      // Harga satuan hanya ditampilkan bila cocok dengan jumlahnya (produk berbasis luas/tier tidak).
      const consistent = Math.round(it.qty * it.unitPrice) === it.amount;
      add(row(consistent ? `${qtyPart} x ${num(it.unitPrice)}` : qtyPart, num(it.amount), cols));
    } else {
      add(qtyPart);
    }
  });
  add(dash);

  // --- Total & pembayaran ---
  if (mode.showTotals) {
    if (invoice.discountAmount > 0 || invoice.taxAmount > 0) {
      add(row("Subtotal", num(invoice.subtotal), cols));
      if (invoice.discountAmount > 0) add(row("Diskon", `-${num(invoice.discountAmount)}`, cols));
      if (invoice.taxAmount > 0) add(row(`Pajak ${qtyStr(invoice.taxRate)}%`, num(invoice.taxAmount), cols));
    }
    add(row("TOTAL", `Rp ${num(invoice.total)}`, cols), { bold: true });
    if (mode.hasPayments) {
      add(row("Dibayar", num(summary.paid), cols));
      if (summary.remaining > 0) add(row("SISA", `Rp ${num(summary.remaining)}`, cols), { bold: true });
      if (summary.status === "lunas") add("*** LUNAS ***", { align: "c", bold: true });
    }
  }

  // --- Rekening, hanya bila masih ada tagihan ---
  if (mode.hasPayments && summary.remaining > 0 && settings.banks.length) {
    add(dash);
    add("Transfer ke:");
    settings.banks.slice(0, 3).forEach((b) => {
      addWrapped(`${b.bank} ${b.no}`, { bold: true });
      if (b.name) addWrapped(`a.n. ${b.name}`);
    });
  }

  // --- Surat Jalan: kolom tanda terima ---
  if (invoice.docType === "suratjalan") {
    add("");
    add("Diterima oleh:");
    add("");
    add("");
    add("(......................)");
  }

  add("");
  add("Terima kasih", { align: "c" });
  return L;
}

/** Baris struk -> byte ESC/POS (bahasa standar printer thermal). */
export function receiptToEscPos(lines: ReceiptLine[], opts: { feed?: number; cut?: boolean } = {}): Uint8Array {
  const { feed = 4, cut = false } = opts;
  const bytes: number[] = [0x1b, 0x40]; // ESC @ : reset printer
  let align = 0;
  let bold = false;
  for (const ln of lines) {
    const a = ln.align === "c" ? 1 : ln.align === "r" ? 2 : 0;
    if (a !== align) {
      bytes.push(0x1b, 0x61, a); // ESC a n : rata
      align = a;
    }
    const b = !!ln.bold;
    if (b !== bold) {
      bytes.push(0x1b, 0x45, b ? 1 : 0); // ESC E n : tebal
      bold = b;
    }
    const t = ascii(ln.text);
    for (let i = 0; i < t.length; i += 1) bytes.push(t.charCodeAt(i));
    bytes.push(0x0a);
  }
  bytes.push(0x1b, 0x61, 0, 0x1b, 0x45, 0); // kembalikan rata kiri & tebal mati
  bytes.push(0x1b, 0x64, feed); // ESC d n : dorong kertas keluar supaya struk mudah disobek
  if (cut) bytes.push(0x1d, 0x56, 0x42, 0x00); // GS V : potong (hanya bila printer punya pemotong)
  return Uint8Array.from(bytes);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s);
}

/** HP/tablet Android: serahkan ke aplikasi RawBT (harus terpasang dan printer sudah di-pair). */
export function openInRawBT(bytes: Uint8Array): void {
  window.location.href = `rawbt:base64,${bytesToBase64(bytes)}`;
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * PC/laptop: cetak lewat dialog cetak browser.
 * Kertas 58mm, tinggi mengikuti isi, font monospace 32 kolom - isi sama persis dengan jalur RawBT.
 */
export async function printReceiptBrowser(lines: ReceiptLine[]): Promise<void> {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: "fixed", left: "-12000px", top: "0", width: "300px", height: "900px", border: "0", opacity: "0", pointerEvents: "none" });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    throw new Error("Browser tidak mengizinkan membuat lembar cetak.");
  }
  const body = lines
    .map((l) => `<div class="ln${l.align === "c" ? " c" : l.align === "r" ? " r" : ""}${l.bold ? " b" : ""}">${escHtml(ascii(l.text)) || "&nbsp;"}</div>`)
    .join("");
  doc.open();
  doc.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Struk</title><style>
    @page { size: 58mm auto; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    /* 48mm = area cetak umum printer 58mm; margin auto menengahkannya bila kertas driver lebih lebar. */
    body { width: 48mm; margin: 0 auto; padding: 2mm 0 6mm; font-family: "Courier New", Courier, monospace; font-size: 9.4px; line-height: 1.25; }
    .ln { white-space: pre; }
    .c { text-align: center; } .r { text-align: right; } .b { font-weight: 700; }
  </style></head><body>${body}</body></html>`);
  doc.close();
  await new Promise<void>((r) => setTimeout(r, 250));
  const finish = () => frame.remove();
  win.addEventListener("afterprint", finish);
  setTimeout(finish, 120_000);
  win.focus();
  win.print();
}
