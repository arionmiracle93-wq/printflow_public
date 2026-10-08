import "server-only";
import { getSetting } from "@/lib/queries";
import { qrisValidate } from "@/lib/qris";

/**
 * PENGATURAN INVOICE (identitas usaha, pembayaran, dokumen)
 * Disimpan sebagai satu baris JSON di tabel `settings` (kunci "invoice_settings"),
 * jadi tidak perlu tabel baru.
 */
export type BankAccount = { bank: string; no: string; name: string };

export type InvoiceSettings = {
  // --- tab Usaha ---
  businessName: string;
  /** Alamat, boleh 2 baris (satu baris per Enter). */
  address: string;
  email: string;
  /** WhatsApp / telepon usaha. */
  phone: string;
  // --- tab Bayar ---
  banks: BankAccount[];
  /** Tampil di bawah daftar rekening, mis. "Mohon kirim bukti transfer ke WhatsApp kami." */
  paymentNote: string;
  /** Jatuh tempo bawaan: hari setelah tanggal invoice. 0 = tanpa jatuh tempo. */
  dueDays: number;
  /** Saat Terbitkan Invoice, tanyakan apakah pembayaran sudah diterima. */
  askPaidOnSave: boolean;
  /** Invoice di bawah nilai ini tidak ditanya. 0 = semua ditanya. */
  askPaidThreshold: number;
  /** Payload QRIS statis dari merchant (teks hasil baca QR). Kosong = belum diisi. */
  qris: string;
  /** Tambahkan kode unik 1-899 ke nominal transfer agar mudah dicocokkan di mutasi bank. */
  uniqueCode: boolean;
  // --- tab Dokumen ---
  /** Tampilkan nama & WA pelanggan di lembar cetak/PDF. */
  showCustomerOnPrint: boolean;
  /** Syarat & ketentuan bawaan (satu per baris) untuk dokumen baru. */
  defaultTerms: string[];
  /** Tombol Unduh PDF di halaman dokumen. */
  showPdfButton: boolean;
  /** Tombol Kirim WhatsApp di halaman dokumen. */
  showWaButton: boolean;
  /** Versi gambar tanda tangan (0 = belum ada). Diisi dari penyimpanan aset, bukan dari form. */
  signatureV: number;
  /** Versi gambar stempel (0 = belum ada). */
  stampV: number;
};

export const INVOICE_SETTINGS_KEY = "invoice_settings";

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  businessName: "Nama Usaha Anda",
  address: "",
  email: "",
  phone: "",
  banks: [],
  paymentNote: "",
  dueDays: 7,
  askPaidOnSave: false,
  askPaidThreshold: 0,
  qris: "",
  uniqueCode: false,
  showCustomerOnPrint: false,
  showPdfButton: true,
  showWaButton: true,
  signatureV: 0,
  stampV: 0,
  defaultTerms: ["Barang yang sudah dicetak tidak dapat dikembalikan.", "Pembayaran dianggap sah setelah dana diterima."],
};

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function intIn(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}

/** Rapikan data mentah (dari database atau dari form) jadi InvoiceSettings yang valid. */
export function sanitizeInvoiceSettings(raw: unknown): InvoiceSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const termsRaw = Array.isArray(r.defaultTerms) ? r.defaultTerms : DEFAULT_INVOICE_SETTINGS.defaultTerms;
  const banksRaw = Array.isArray(r.banks) ? r.banks : [];
  const banks = banksRaw
    .map((b) => {
      const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
      return { bank: str(o.bank, 40), no: str(o.no, 40), name: str(o.name, 80) };
    })
    .filter((b) => b.bank || b.no)
    .slice(0, 10);
  return {
    businessName: str(r.businessName, 120) || DEFAULT_INVOICE_SETTINGS.businessName,
    address: str(r.address, 300),
    email: str(r.email, 120),
    phone: str(r.phone, 40),
    banks,
    // Data tahap B menyimpan info rekening sebagai satu teks bebas (bankInfo); dipindah jadi catatan pembayaran.
    paymentNote: str(r.paymentNote, 300) || str(r.bankInfo, 300),
    dueDays: intIn(r.dueDays, 0, 365, DEFAULT_INVOICE_SETTINGS.dueDays),
    askPaidOnSave: r.askPaidOnSave === true,
    askPaidThreshold: intIn(r.askPaidThreshold, 0, 2_000_000_000, 0),
    qris: str(r.qris, 1200),
    uniqueCode: r.uniqueCode === true,
    showPdfButton: r.showPdfButton !== false,
    showWaButton: r.showWaButton !== false,
    signatureV: 0,
    stampV: 0,
    showCustomerOnPrint: r.showCustomerOnPrint === true,
    defaultTerms: termsRaw.map((t) => str(t, 300)).filter(Boolean).slice(0, 20),
  };
}

/** Pesan kesalahan bila QRIS yang diisi tidak valid; null bila kosong atau valid. */
export function qrisProblem(qris: string): string | null {
  if (!qris.trim()) return null;
  const check = qrisValidate(qris);
  return check.ok ? null : `QRIS tidak valid: ${check.msg}`;
}

/** Penyimpanan gambar tanda tangan & stempel (data URL) - terpisah supaya tidak ikut terbaca di tiap halaman. */
export const ASSET_KINDS = ["signature", "stamp"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];
export const ASSET_KEY: Record<AssetKind, string> = { signature: "invoice_signature", stamp: "invoice_stamp" };
export const ASSET_META_KEY = "invoice_assets_meta";
export const MAX_ASSET_BYTES = 800 * 1024;

export function isAssetKind(value: string): value is AssetKind {
  return (ASSET_KINDS as readonly string[]).includes(value);
}

export async function getAssetMeta(): Promise<{ signature: number; stamp: number }> {
  const raw = await getSetting(ASSET_META_KEY);
  try {
    const m = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    return { signature: Math.max(0, Math.round(Number(m.signature)) || 0), stamp: Math.max(0, Math.round(Number(m.stamp)) || 0) };
  } catch {
    return { signature: 0, stamp: 0 };
  }
}

export async function getInvoiceSettings(): Promise<InvoiceSettings> {
  const [raw, meta] = await Promise.all([getSetting(INVOICE_SETTINGS_KEY), getAssetMeta()]);
  let base = DEFAULT_INVOICE_SETTINGS;
  if (raw) {
    try {
      base = sanitizeInvoiceSettings(JSON.parse(raw));
    } catch {
      base = DEFAULT_INVOICE_SETTINGS;
    }
  }
  return { ...base, signatureV: meta.signature, stampV: meta.stamp };
}
