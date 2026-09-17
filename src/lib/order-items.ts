import { formatNumber } from "@/lib/domain";

/**
 * ITEM PEKERJAAN
 * ----------------------------------------------------------------
 * Satu pekerjaan (1 kartu, 1 status, 1 deadline, 1 mesin, 1 operator)
 * bisa berisi BEBERAPA produk sekaligus. Tiap produk = satu "item":
 * jenis + jumlah + satuan.
 *
 * Contoh satu pekerjaan "Order Pak Budi":
 *   - Spanduk / Banner · 2 · pcs
 *   - Stiker / Label    · 500 · lembar
 *   - Kartu Nama        · 1 · box
 *
 * Semua jalan bareng: sekali update status, sekali kirim WA, sekali dilacak.
 */
export type OrderItem = {
  id: number;
  productType: string;
  quantity: number;
  unit: string;
};

/** Bentuk item saat masih diketik di form (belum punya id dari database). */
export type OrderItemInput = {
  productType: string;
  quantity: number;
  unit: string;
};

/** Maksimal baris produk dalam satu pekerjaan — pagar supaya form tetap wajar. */
export const MAX_ITEMS_PER_ORDER = 20;

/**
 * Bersihkan daftar item dari input mentah (form / body API).
 * Baris tanpa nama produk dibuang, jumlah minimal 1, satuan default "pcs".
 * Dipakai di server agar data kotor tidak pernah masuk database.
 */
export function sanitizeItems(raw: unknown): OrderItemInput[] {
  if (!Array.isArray(raw)) return [];
  const out: OrderItemInput[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const productType = typeof row.productType === "string" ? row.productType.trim() : "";
    if (!productType) continue;
    const parsedQty =
      typeof row.quantity === "number"
        ? row.quantity
        : Number.parseInt(String(row.quantity ?? ""), 10);
    const unit = typeof row.unit === "string" && row.unit.trim() ? row.unit.trim() : "pcs";
    out.push({
      productType,
      quantity: Math.max(1, Number.isFinite(parsedQty) ? parsedQty : 1),
      unit,
    });
    if (out.length >= MAX_ITEMS_PER_ORDER) break;
  }
  return out;
}

/** Satu baris item jadi teks pendek: "Spanduk / Banner · 2 pcs". */
export function formatItem(item: OrderItemInput): string {
  return `${item.productType} · ${formatNumber(item.quantity)} ${item.unit}`;
}

/**
 * Ringkasan satu baris untuk tempat sempit (kartu, tabel, dashboard).
 * Menampilkan maksimal `max` produk, sisanya diringkas jadi "+N lainnya".
 */
export function summarizeItems(items: OrderItemInput[], max = 2): string {
  if (!items.length) return "Belum ada rincian produk";
  const shown = items.slice(0, max).map(formatItem).join(" + ");
  const rest = items.length - max;
  return rest > 0 ? `${shown} +${rest} lainnya` : shown;
}

/** Daftar item jadi beberapa baris teks — dipakai di pesan WhatsApp. */
export function itemLines(items: OrderItemInput[], bullet = "   - "): string[] {
  return items.map((item) => `${bullet}${formatItem(item)}`);
}

/** Total kuantitas semua item (hanya berarti bila satuannya sejenis). */
export function totalQuantity(items: OrderItemInput[]): number {
  return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

/** Daftar jenis produk unik dalam satu pekerjaan (untuk filter & statistik). */
export function uniqueProductTypes(items: OrderItemInput[]): string[] {
  return [...new Set(items.map((item) => item.productType))];
}
