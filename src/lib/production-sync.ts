/**
 * Pencocokan item invoice dengan item pekerjaan produksi.
 *
 * Sejak revisi invoice bisa menambah produk setelah invoice terbit, kita
 * perlu tahu item mana yang SUDAH ada di pekerjaan produksi dan mana yang
 * belum. Cara utamanya adalah `lineKey` yang stabil dari invoice:
 *
 *   invoice_items.line_key  ->  order_items.source_line_key
 *
 * Data lama belum punya kunci itu. Untuk data lama, dipakai pencocokan
 * cadangan berdasarkan nama produk + jumlah + satuan. Pencocokan cadangan
 * memakai "stok" (multiset), jadi dua baris yang benar-benar kembar tidak
 * dianggap satu baris.
 */

export type InvoiceItemIdentity = {
  lineKey?: string | null;
  productName: string;
  qty: number;
  unit: string;
};

export type OrderItemIdentity = {
  sourceLineKey?: string | null;
  productType: string;
  quantity: number;
  unit: string;
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function fallbackKey(productName: string, quantity: number, unit: string): string {
  return [
    normalizeText(productName),
    String(Math.max(1, Math.round(quantity))),
    normalizeText(unit || "pcs"),
  ].join("\u0000");
}

/**
 * Kembalikan item invoice yang belum punya pasangan di pekerjaan produksi.
 * Urutan hasil mengikuti urutan item invoice.
 */
export function unmatchedInvoiceItems<T extends InvoiceItemIdentity>(
  invoiceItems: readonly T[],
  orderItems: readonly OrderItemIdentity[],
): T[] {
  const invoiceKeys = new Set(
    invoiceItems.map((item) => item.lineKey).filter((key): key is string => Boolean(key)),
  );
  const matchedKeys = new Set<string>();
  const fallbackStock = new Map<string, number>();

  for (const orderItem of orderItems) {
    if (orderItem.sourceLineKey && invoiceKeys.has(orderItem.sourceLineKey)) {
      matchedKeys.add(orderItem.sourceLineKey);
      continue;
    }
    // Item lama tanpa kunci, atau kunci yang sudah tidak ada di invoice
    // (misalnya karena data lama diedit klien lama): cocokkan lewat isi.
    const key = fallbackKey(orderItem.productType, orderItem.quantity, orderItem.unit);
    fallbackStock.set(key, (fallbackStock.get(key) ?? 0) + 1);
  }

  const result: T[] = [];
  for (const invoiceItem of invoiceItems) {
    if (invoiceItem.lineKey && matchedKeys.has(invoiceItem.lineKey)) continue;
    const key = fallbackKey(invoiceItem.productName, invoiceItem.qty, invoiceItem.unit);
    const stock = fallbackStock.get(key) ?? 0;
    if (stock > 0) {
      fallbackStock.set(key, stock - 1);
      continue;
    }
    result.push(invoiceItem);
  }
  return result;
}
