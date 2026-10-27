import type { InvoiceTierConfig, PricePreset } from "@/db/schema";
import { MIN_SEARCH_CHARS, matchesNormalizedSearch, normalizeSearchText } from "@/lib/product-search";

/**
 * SARAN PRODUK SAAT MENGETIK. Kode murni.
 *  - aturan cocok SAMA PERSIS dengan pencarian di halaman Katalog (product-search.ts):
 *    tidak peka huruf besar/kecil, cocok dari awal kata, kata boleh diacak,
 *    sinonim (banner = spanduk), ukuran 60x90 = 60 x 90
 *  - input kosong atau 1 huruf = tidak ada saran
 *  - urutan: nama diawali kata kunci > kata kunci cocok di nama > cocok lewat keterangan/kategori/sinonim
 *  - maksimal 8 saran
 *  - nama produk boleh kembar (keterangan beda); keterangan ditampilkan di tiap saran
 *  - VARIAN: yang diberikan ke sini adalah daftar "daun" dari leafItems() (catalog-variants.ts):
 *    kartu induk dibuang dan nama varian sudah digabung dengan nama induknya ("Print HVS A4 Warna"),
 *    jadi mengetik "hvs warna" langsung menemukan variannya.
 */
export type CatalogItem = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  tiers: InvoiceTierConfig | null;
  category: string | null;
  /** Versi gambar yang BERLAKU (milik sendiri, atau milik induk terdekat bila belum punya gambar). 0 = tanpa gambar. */
  imageV: number;
  /** id baris pemilik gambar yang berlaku (= id sendiri, atau id induk untuk isi tanpa gambar sendiri). */
  imageId: number;
  /** Varian: id induk/sub-induknya. Induk utama dan produk biasa: null. */
  parentId: number | null;
  /** true = kartu INDUK (induk utama atau sub-induk): tanpa harga, tidak bisa langsung dipilih di invoice. */
  isGroup: boolean;
  /** "fleksibel" = jasa tanpa harga baku: klik kartu di pemilih katalog membuka dialog Set Harga, bukan langsung menambah baris. */
  pricingMode: "tetap" | "fleksibel";
  /** Preset harga (owner) untuk produk fleksibel: klik = harga terisi dengan label itu. null = tanpa preset. */
  pricePresets: PricePreset[] | null;
  /** Teks pengganti gambar MILIK BARIS INI (bukan warisan); dipakai formulir ubah. null = tidak memakai teks. */
  imageText: string | null;
  /** Teks pengganti yang TAMPIL di kartu (milik sendiri atau warisan pemilik gambar yang berlaku). null = tampilkan gambar/kotak kosong. */
  displayText: string | null;
};

export function matchCatalog<T extends Pick<CatalogItem, "name" | "description"> & { category?: string | null }>(items: T[], query: string, limit = 8): T[] {
  const needle = normalizeSearchText(query);
  // Minimal 2 huruf; 1 huruf terlalu umum untuk jadi saran yang berguna.
  if (needle.length < MIN_SEARCH_CHARS) return [];
  const starts: T[] = [];
  const inName: T[] = [];
  const other: T[] = [];
  for (const item of items) {
    const name = normalizeSearchText(item.name);
    if (!name) continue;
    // Sama dengan Katalog: nama + keterangan + kategori.
    const all = normalizeSearchText(`${item.name} ${item.description ?? ""} ${item.category ?? ""}`);
    if (!matchesNormalizedSearch(all, query)) continue;
    if (name.startsWith(needle)) starts.push(item);
    else if (matchesNormalizedSearch(name, query)) inName.push(item);
    else other.push(item);
  }
  return starts.concat(inName, other).slice(0, limit);
}
