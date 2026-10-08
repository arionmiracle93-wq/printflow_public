/**
 * HITUNG HARGA & TOTAL INVOICE (kode murni, tanpa database)
 *
 * Rumus di sini DIPORTING PERSIS dari aplikasi invoice lama
 * (computeRowPricing, graduatedCost, normalizeTiers, parseTiers, getInvoiceTotals)
 * supaya angka invoice di PrintFlow sama dengan yang biasa Anda pakai.
 *
 * File ini dipakai di DUA tempat:
 *  - layar (pratinjau saat kasir mengetik), dan
 *  - server (hitung ulang resmi sebelum disimpan — angka kiriman browser
 *    tidak pernah dipercaya).
 *
 * Aturan pembulatan (satu-satunya beda kecil dari app lama): jumlah per
 * baris, diskon, dan pajak masing-masing dibulatkan ke rupiah utuh, supaya
 * total yang tercetak = penjumlahan angka yang terlihat di kertas.
 */

export type TierMode = "flat" | "graduated";
export type TierBasis = "qty" | "m2";
export type Tier = { min: number; price: number };
export type TierConfig = { mode: TierMode; basis: TierBasis; list: Tier[] };

export const EMPTY_TIERS: TierConfig = { mode: "flat", basis: "qty", list: [] };

/** Batas aman nominal (kolom integer PostgreSQL maksimal ±2,14 miliar). */
export const MAX_RUPIAH = 2_000_000_000;

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Bersihkan daftar tier: buang yang tidak valid, gabung min kembar, urutkan naik. */
export function sanitizeTierList(list: unknown): Tier[] {
  const map = new Map<number, Tier>();
  (Array.isArray(list) ? list : []).forEach((raw) => {
    if (!raw || typeof raw !== "object") return;
    const min = Number((raw as { min?: unknown }).min);
    const price = Number((raw as { price?: unknown }).price);
    if (!Number.isFinite(min) || min <= 0) return;
    if (!Number.isFinite(price) || price < 0) return;
    map.set(min, { min, price: Math.round(price) });
  });
  return Array.from(map.values()).sort((a, b) => a.min - b.min);
}

/** Terima bentuk apa pun (objek, array lama, JSON string) → TierConfig yang rapi. */
export function normalizeTiers(value: unknown): TierConfig {
  if (!value) return { ...EMPTY_TIERS, list: [] };
  if (Array.isArray(value)) return { mode: "flat", basis: "qty", list: sanitizeTierList(value) };
  if (typeof value === "object") {
    const v = value as { mode?: unknown; basis?: unknown; list?: unknown; tiers?: unknown };
    return {
      mode: v.mode === "graduated" ? "graduated" : "flat",
      basis: v.basis === "m2" ? "m2" : "qty",
      list: sanitizeTierList(v.list ?? v.tiers ?? []),
    };
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return { ...EMPTY_TIERS, list: [] };
    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        return normalizeTiers(JSON.parse(s));
      } catch {
        /* jatuh ke parser teks di bawah */
      }
    }
    return parseTierText(s);
  }
  return { ...EMPTY_TIERS, list: [] };
}

/**
 * Angka gaya Indonesia yang diketik manusia: "1.500" → 1500, "2,5" → 2.5, "2.5" → 2.5.
 * Dipakai untuk teks tier dan kolom angka di form invoice.
 */
export function parseLooseNumber(raw: string): number {
  return looseNumber(raw);
}

function looseNumber(raw: string): number {
  const s = raw.trim();
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
  if (s.includes(",")) return Number(s.replace(",", ".")) || 0;
  // titik saja: "1.500" (ribuan) vs "2.5" (desimal)
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, "")) || 0;
  return Number(s) || 0;
}

/**
 * Parser teks tier yang diketik kasir, mis. "2=8000;11=7000" atau
 * "mode=progresif; basis=m2; 10=7000". Pemisah: baris baru, ; atau |.
 */
export function parseTierText(text: string): TierConfig {
  const cfg: TierConfig = { mode: "flat", basis: "qty", list: [] };
  const raw = String(text ?? "");
  if (!raw.trim()) return cfg;
  const pairRe = /(?:>=?\s*|min\.?\s*)?(\d[\d.,]*)\s*(?:-\s*\d[\d.,]*\s*)?(?:pcs|pc|lbr|lembar|m2|m²)?\s*[=:]\s*(?:rp\.?\s*)?(\d[\d.,]*)/gi;
  raw.split(/[\n\r;|]+/).forEach((token) => {
    const t = token.trim();
    if (!t) return;
    const modeMatch = t.match(/^\s*(?:mode|tipe|jenis)\s*[=:]\s*([a-z]+)/i);
    if (modeMatch) {
      cfg.mode = /prog|grad|berjenjang|bertahap|akum/i.test(modeMatch[1]) ? "graduated" : "flat";
      return;
    }
    const basisMatch = t.match(/^\s*(?:basis|dasar|per|hitung)\s*[=:]\s*([a-z0-9²]+)/i);
    if (basisMatch) {
      cfg.basis = /m2|m²|luas|meter/i.test(basisMatch[1]) ? "m2" : "qty";
      return;
    }
    pairRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pairRe.exec(t)) !== null) {
      cfg.list.push({ min: looseNumber(m[1]), price: looseNumber(m[2]) });
    }
  });
  cfg.list = sanitizeTierList(cfg.list);
  return cfg;
}

/** Kebalikan parser: TierConfig → teks yang bisa diedit kasir. */
export function tiersToText(cfg: TierConfig): string {
  const c = normalizeTiers(cfg);
  if (!c.list.length) return "";
  const lines: string[] = [];
  if (c.mode === "graduated") lines.push("mode=progresif");
  if (c.basis === "m2") lines.push("basis=m2");
  c.list.forEach((t) => lines.push(`${t.min}=${t.price}`));
  return lines.join("\n");
}

function activeTierOf(units: number, list: Tier[]): Tier | null {
  let found: Tier | null = null;
  list.forEach((t) => {
    if (units + 1e-9 >= t.min) found = t;
  });
  return found;
}

/** Harga progresif: tiap "tangga" dihitung dengan harganya sendiri. */
function graduatedCost(units: number, list: Tier[], basePrice: number): number {
  const u = Math.max(0, units || 0);
  if (!u) return 0;
  const tiers = sanitizeTierList(list);
  let cost = 0;
  let prevBound = 0;
  let prevPrice = basePrice || 0;
  for (let i = 0; i < tiers.length; i += 1) {
    const bound = tiers[i].min;
    if (u > bound) {
      cost += (bound - prevBound) * prevPrice;
      prevBound = bound;
      prevPrice = tiers[i].price;
    } else break;
  }
  cost += (u - prevBound) * prevPrice;
  return cost;
}

export type RowPricingInput = {
  qty: unknown;
  /** Luas per unit (m²). 0/kosong = bukan produk berbasis luas. */
  areaM2?: unknown;
  basePrice: unknown;
  tiers?: unknown;
};

export type RowPricing = {
  amount: number;
  unitPrice: number;
  basis: TierBasis;
  mode: TierMode;
  units: number;
  hasTier: boolean;
  tier: Tier | null;
  label: string;
  area: number;
  qty: number;
};

/** Hitung satu baris item (porting computeRowPricing). */
export function computeRowPricing(input: RowPricingInput): RowPricing {
  const qty = Math.max(0, toNumber(input.qty));
  const m2 = Math.max(0, toNumber(input.areaM2));
  const base = Math.max(0, toNumber(input.basePrice));
  const cfg = normalizeTiers(input.tiers);
  const area = m2 > 0 ? m2 : 1;
  const hasTier = cfg.list.length > 0;
  const units = cfg.basis === "m2" ? qty * area : qty;

  let amount = 0;
  let unitPrice = base;
  let tier: Tier | null = null;
  let label = "";

  if (!hasTier || qty <= 0) {
    amount = base * qty * area;
    unitPrice = base;
    label = "harga dasar";
  } else if (cfg.mode === "graduated") {
    const cost = graduatedCost(units, cfg.list, base);
    amount = cfg.basis === "m2" ? cost : cost * area;
    unitPrice = units > 0 ? cost / units : base;
    tier = activeTierOf(units, cfg.list);
    label = "progresif";
  } else {
    tier = activeTierOf(units, cfg.list);
    unitPrice = tier ? tier.price : base;
    amount = cfg.basis === "m2" ? unitPrice * units : unitPrice * qty * area;
    label = tier ? `tier ≥${tier.min}` : "harga dasar";
  }

  return {
    amount: Math.round(amount),
    unitPrice,
    basis: cfg.basis,
    mode: cfg.mode,
    units,
    hasTier,
    tier,
    label,
    area,
    qty,
  };
}

/** Persentase diskon/pajak: dibatasi 0–100. */
export function clampRate(value: unknown): number {
  const n = toNumber(value);
  if (n <= 0) return 0;
  return Math.min(100, Math.round(n * 1000) / 1000);
}

export type DiscountType = "persen" | "rp";

export type InvoiceTotals = {
  subtotal: number;
  discountType: DiscountType;
  /** Isian mentah: persen (0-100) atau rupiah, sesuai discountType. */
  discountInput: number;
  /** Persentase diskon; 0 bila tipe rp. */
  discountRate: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
};

export function isDiscountType(value: unknown): value is DiscountType {
  return value === "persen" || value === "rp";
}

/**
 * Total invoice: subtotal -> diskon -> pajak % dari sisa setelah diskon.
 * Diskon persen: 0-100. Diskon Rp: dibulatkan ke rupiah utuh dan DIBATASI
 * maksimal subtotal (tidak boleh membuat total minus) - aturan app lama.
 */
export function computeInvoiceTotals(
  rowAmounts: number[],
  discountInputRaw: unknown,
  taxRateInput: unknown,
  discountType: DiscountType = "persen",
): InvoiceTotals {
  const subtotal = rowAmounts.reduce((sum, n) => sum + Math.round(toNumber(n)), 0);
  let discountRate = 0;
  let discountAmount = 0;
  let discountInput = 0;
  if (discountType === "rp") {
    discountInput = Math.max(0, Math.round(toNumber(discountInputRaw)));
    discountAmount = Math.min(discountInput, subtotal);
  } else {
    discountRate = clampRate(discountInputRaw);
    discountInput = discountRate;
    discountAmount = Math.round((subtotal * discountRate) / 100);
  }
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxRate = clampRate(taxRateInput);
  const taxAmount = Math.round((taxable * taxRate) / 100);
  return { subtotal, discountType, discountInput, discountRate, discountAmount, taxRate, taxAmount, total: taxable + taxAmount };
}

export type PayStatus = "belum" | "sebagian" | "lunas";

/**
 * Ringkasan pembayaran (aturan sama dengan app lama):
 * terbayar = jumlah pembayaran yang tidak dibatalkan,
 * sisa = total - terbayar, lunas jika terbayar >= total - 0,5.
 */
export function summarizePayments(total: number, paid: number): {
  paid: number;
  remaining: number;
  overpaid: number;
  status: PayStatus;
} {
  const t = Math.max(0, Math.round(toNumber(total)));
  const p = Math.max(0, Math.round(toNumber(paid)));
  const status: PayStatus = p <= 0 ? "belum" : t > 0 && p >= t - 0.5 ? "lunas" : "sebagian";
  return { paid: p, remaining: Math.max(0, t - p), overpaid: Math.max(0, p - t), status };
}

export const PAY_METHODS = ["Transfer", "Cash", "QRIS"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

export function isPayMethod(value: unknown): value is PayMethod {
  return typeof value === "string" && (PAY_METHODS as readonly string[]).includes(value);
}
