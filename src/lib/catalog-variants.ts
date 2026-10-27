import type { CatalogItem } from "@/lib/invoice-catalog-match";

/**
 * VARIAN KATALOG (sub-kategori). Kode murni, aman dipakai di server maupun browser.
 * ===================================================================
 * Bentuk datanya tetap satu daftar datar (flat); hubungan induk-varian hanya
 * lewat parentId. Sekarang ada dua tingkat:
 *
 *   INDUK UTAMA : isGroup = true, parentId = null
 *   SUB-INDUK   : isGroup = true, parentId = id induk utama
 *   VARIAN      : parentId = id induk utama ATAU sub-induk
 *   BIASA       : isGroup = false, parentId = null
 *
 * Contoh: NOTA -> NCR A5 -> "2 Rangkap 1 Warna".
 * Sub-induk tidak boleh punya sub-induk lagi. Aturan itu dijaga di server,
 * sedangkan helper di sini hanya membaca bentuk datar yang sudah valid.
 */

export type GroupSummary = { count: number; minPrice: number | null };

/** Item tingkat atas: produk biasa + kartu induk utama (sub-induk/varian tidak termasuk). */
export function topLevel(items: CatalogItem[]): CatalogItem[] {
  return items.filter((p) => p.parentId == null);
}

/** Induk utama (bukan sub-induk). */
export function isRootGroup(p: CatalogItem): boolean {
  return p.isGroup && p.parentId == null;
}

/** Sub-induk: kartu induk yang berada di dalam induk utama. */
export function isSubgroup(p: CatalogItem): boolean {
  return p.isGroup && p.parentId != null;
}

/** Anak langsung sebuah induk: sub-induk lebih dulu, lalu varian (urutan daftar di dalam masing-masing). */
export function childrenOf(items: CatalogItem[], groupId: number): CatalogItem[] {
  return items.filter((p) => p.parentId === groupId).sort((a, b) => Number(b.isGroup) - Number(a.isGroup));
}

/** Sub-induk langsung milik satu induk. */
export function childGroupsOf(items: CatalogItem[], groupId: number): CatalogItem[] {
  return items.filter((p) => p.isGroup && p.parentId === groupId);
}

/**
 * Varian (daun) langsung milik satu induk. Sub-induk TIDAK ikut; pakai
 * childrenOf() bila yang dibutuhkan semua anak langsung untuk ditampilkan.
 */
export function variantsOf(items: CatalogItem[], groupId: number): CatalogItem[] {
  return items.filter((p) => !p.isGroup && p.parentId === groupId);
}

/** Semua keturunan (sub-induk + varian) di bawah satu induk. */
export function descendantsOf(items: CatalogItem[], groupId: number): CatalogItem[] {
  const byParent = new Map<number, CatalogItem[]>();
  for (const p of items) {
    if (p.parentId == null) continue;
    const list = byParent.get(p.parentId) ?? [];
    list.push(p);
    byParent.set(p.parentId, list);
  }
  const out: CatalogItem[] = [];
  const seen = new Set<number>();
  const walk = (id: number) => {
    for (const child of byParent.get(id) ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      out.push(child);
      if (child.isGroup) walk(child.id);
    }
  };
  walk(groupId);
  return out;
}

/** Semua varian (daun) di bawah satu induk, termasuk yang ada di sub-induk. */
export function leafDescendantsOf(items: CatalogItem[], groupId: number): CatalogItem[] {
  return descendantsOf(items, groupId).filter((p) => !p.isGroup);
}

export function indexById(items: CatalogItem[]): Map<number, CatalogItem> {
  return new Map(items.map((p) => [p.id, p]));
}

/** Rantai induk dari induk utama sampai item itu sendiri (termasuk item). */
export function pathOf(p: CatalogItem, byId: Map<number, CatalogItem>): CatalogItem[] {
  const out: CatalogItem[] = [];
  const seen = new Set<number>();
  let cur: CatalogItem | undefined = p;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parentId != null ? byId.get(cur.parentId) : undefined;
  }
  return out;
}

/** Nama path induk, mis. "NOTA > NCR A5" (dipakai di UI dan impor CSV). */
export function groupPath(p: CatalogItem, byId: Map<number, CatalogItem>): string {
  return pathOf(p, byId)
    .map((item) => item.name.trim())
    .filter(Boolean)
    .join(" > ");
}

/**
 * Nama lengkap untuk invoice dan hasil pencarian. Produk biasa = namanya saja.
 * Contoh: "NOTA NCR A5 2 Rangkap 1 Warna".
 */
export function fullName(p: Pick<CatalogItem, "name" | "parentId">, byId: Map<number, CatalogItem>): string {
  const names: string[] = [p.name.trim()];
  const seen = new Set<number>();
  let parentId = p.parentId;
  while (parentId != null && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    names.unshift(parent.name.trim());
    parentId = parent.parentId;
  }
  return names.filter(Boolean).join(" ").trim();
}

/**
 * Ringkasan kartu induk: jumlah SEMUA varian di bawahnya (termasuk sub-induk)
 * dan harga "mulai". Harga mulai = harga DASAR varian termurah (bukan tier
 * grosir), supaya label tidak menyesatkan. Varian berharga 0 tidak dihitung.
 */
export function groupInfo(items: CatalogItem[], groupId: number): GroupSummary {
  let count = 0;
  let min: number | null = null;
  for (const p of leafDescendantsOf(items, groupId)) {
    count += 1;
    if (p.price > 0 && (min === null || p.price < min)) min = p.price;
  }
  return { count, minPrice: min };
}

/** Peta id induk -> ringkasan, dihitung sekali untuk seluruh daftar (O(n)). */
export function groupInfoMap(items: CatalogItem[]): Map<number, GroupSummary> {
  const byId = indexById(items);
  const map = new Map<number, GroupSummary>();
  for (const p of items) {
    if (p.isGroup) map.set(p.id, { count: 0, minPrice: null });
  }
  for (const p of items) {
    if (p.isGroup) continue;
    const seen = new Set<number>();
    let parentId = p.parentId;
    while (parentId != null && !seen.has(parentId)) {
      seen.add(parentId);
      const g = byId.get(parentId);
      if (!g || !g.isGroup) break;
      const info = map.get(g.id);
      if (info) {
        info.count += 1;
        if (p.price > 0 && (info.minPrice === null || p.price < info.minPrice)) info.minPrice = p.price;
      }
      parentId = g.parentId;
    }
  }
  return map;
}

/** Teks label kartu induk: "3 varian · mulai Rp 500" (tanpa "mulai" bila belum ada varian berharga). */
export function groupLabel(info: GroupSummary, formatRupiah: (n: number) => string): string {
  if (!info.count) return "Belum ada varian";
  const base = `${info.count} varian`;
  return info.minPrice ? `${base} · mulai ${formatRupiah(info.minPrice)}` : base;
}

/**
 * Daftar produk yang BOLEH dimasukkan ke invoice: semua kecuali kartu induk,
 * dengan nama varian digabung nama seluruh induknya. Dipakai untuk saran saat
 * mengetik nama produk dan hasil pilihan galeri.
 */
export function leafItems(items: CatalogItem[]): CatalogItem[] {
  const byId = indexById(items);
  return items.filter((p) => !p.isGroup).map((p) => (p.parentId != null ? { ...p, name: fullName(p, byId) } : p));
}
