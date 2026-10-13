import type { InvoiceTierConfig } from "@/db/schema";

/**
 * SARAN PRODUK SAAT MENGETIK (diporting dari matchCatalog app lama). Kode murni.
 *  - tidak peka huruf besar/kecil; input kosong = tidak ada saran
 *  - urutan: awalan nama > awalan kata (setelah spasi, -, /, atau "(") > mengandung > cocok di keterangan
 *  - maksimal 8 saran
 */
export type CatalogItem = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  tiers: InvoiceTierConfig | null;
  category: string | null;
  imageV: number;
};

export function matchCatalog<T extends Pick<CatalogItem, "name" | "description">>(items: T[], query: string, limit = 8): T[] {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return [];
  const starts: T[] = [];
  const word: T[] = [];
  const contains: T[] = [];
  items.forEach((item) => {
    const name = String(item.name || "").toLowerCase();
    if (!name) return;
    const pos = name.indexOf(needle);
    if (pos === -1) {
      // Cocokkan juga lewat keterangan agar pencarian tetap membantu.
      const desc = String(item.description || "").toLowerCase();
      if (desc && desc.includes(needle)) contains.push(item);
      return;
    }
    if (pos === 0) starts.push(item);
    else if (/[\s\-/(]/.test(name.charAt(pos - 1))) word.push(item);
    else contains.push(item);
  });
  return starts.concat(word, contains).slice(0, limit);
}
