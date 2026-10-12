/**
 * MODE DOKUMEN (diporting dari app lama: Invoice / Estimasi / Surat Jalan / PO)
 * Kode murni, aman dipakai di server maupun layar.
 *
 * Aturan per mode (sama dengan app lama):
 *  - Invoice   : punya pembayaran (DP/cicilan/lunas) dan masuk omzet.
 *  - Estimasi  : harga & total tampil, TANPA pembayaran. Label "Berlaku Sampai".
 *  - Surat Jalan: TANPA harga, jumlah, total, dan jatuh tempo. Ada kolom "Diterima oleh".
 *  - PO        : harga & total tampil, TANPA pembayaran. Label "Tanggal Diminta".
 */
export type DocType = "invoice" | "estimasi" | "suratjalan" | "po";

export type DocMode = {
  key: DocType;
  label: string;
  /** Judul besar di kertas. */
  title: string;
  /** Awalan nomor dokumen: INV-20261006-001. */
  prefix: string;
  newBtn: string;
  dateLabel: string;
  /** Kosong = baris jatuh tempo disembunyikan. */
  dueLabel: string;
  hint: string;
  hasPayments: boolean;
  showPrices: boolean;
  showTotals: boolean;
  /** Warna lencana di daftar. */
  badge: string;
};

export const DOC_MODES: Record<DocType, DocMode> = {
  invoice: {
    key: "invoice",
    label: "Invoice",
    title: "INVOICE",
    prefix: "INV",
    newBtn: "Invoice Baru",
    dateLabel: "Tanggal",
    dueLabel: "Jatuh Tempo",
    hint: "Tagihan lengkap dengan pembayaran.",
    hasPayments: true,
    showPrices: true,
    showTotals: true,
    badge: "border-teal-200 bg-teal-50 text-teal-700",
  },
  estimasi: {
    key: "estimasi",
    label: "Estimasi Harga",
    title: "ESTIMASI",
    prefix: "EST",
    newBtn: "Estimasi Baru",
    dateLabel: "Tanggal",
    dueLabel: "Berlaku Sampai",
    hint: "Penawaran harga, tanpa pembayaran.",
    hasPayments: false,
    showPrices: true,
    showTotals: true,
    badge: "border-amber-200 bg-amber-50 text-amber-700",
  },
  suratjalan: {
    key: "suratjalan",
    label: "Surat Jalan",
    title: "SURAT JALAN",
    prefix: "SJ",
    newBtn: "Surat Jalan Baru",
    dateLabel: "Tanggal Kirim",
    dueLabel: "",
    hint: "Tanpa harga, ada kolom penerima.",
    hasPayments: false,
    showPrices: false,
    showTotals: false,
    badge: "border-sky-200 bg-sky-50 text-sky-700",
  },
  po: {
    key: "po",
    label: "Purchase Order",
    title: "PURCHASE ORDER",
    prefix: "PO",
    newBtn: "PO Baru",
    dateLabel: "Tanggal PO",
    dueLabel: "Tanggal Diminta",
    hint: "Pesanan pembelian, tanpa pembayaran.",
    hasPayments: false,
    showPrices: true,
    showTotals: true,
    badge: "border-violet-200 bg-violet-50 text-violet-700",
  },
};

export const DOC_TYPES = Object.keys(DOC_MODES) as DocType[];

export function isDocType(value: unknown): value is DocType {
  return typeof value === "string" && (DOC_TYPES as string[]).includes(value);
}

export function docModeOf(value: unknown): DocMode {
  return isDocType(value) ? DOC_MODES[value] : DOC_MODES.invoice;
}
