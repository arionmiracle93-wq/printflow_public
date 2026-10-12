import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoiceProducts, settings, type InvoiceTierConfig } from "@/db/schema";
import { SAMPLE_CATALOG } from "@/lib/invoice-catalog-sample";
import { MAX_RUPIAH, normalizeTiers, parseLooseNumber, tiersToText } from "@/lib/invoice-pricing";
import { InvoiceError } from "@/lib/invoice-queries";
import { getSetting } from "@/lib/queries";

/**
 * KATALOG PRODUK INVOICE (server)
 * Satu daftar bersama untuk semua perangkat (menggantikan katalog browser + Supabase di app lama).
 * Mengelola katalog (tambah/ubah/hapus/impor) hanya untuk Owner; semua akun berizin Invoice boleh memakainya.
 */

export const MAX_IMAGE_BYTES = 900 * 1024;
const IMAGE_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

export type ProductRow = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  tiers: InvoiceTierConfig | null;
  category: string | null;
  imageV: number;
};

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export type ProductInput = {
  name: string;
  description: string | null;
  price: number;
  tiers: InvoiceTierConfig | null;
  category: string | null;
  /** undefined = biarkan; null = hapus gambar; string = data URL baru. */
  image: string | null | undefined;
};

export function parseProductInput(raw: unknown): ProductInput {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = text(b.name, 200);
  if (!name) throw new InvoiceError(400, "NAMA_KOSONG", "Nama produk belum diisi.");
  // Teks harga gaya Indonesia: "25.000" = 25000, "1.500.000", "Rp 7.000", "2,5". (Number("25.000") salah = 25.)
  const priceNum =
    typeof b.price === "string" ? parseLooseNumber(b.price.replace(/rp\.?/gi, "").replace(/\s+/g, "")) : Number(b.price);
  const price = Number.isFinite(priceNum) ? Math.max(0, Math.round(priceNum)) : 0;
  if (price > MAX_RUPIAH) throw new InvoiceError(400, "HARGA_TERLALU_BESAR", "Harga terlalu besar.");
  const cfg = b.tiers ? normalizeTiers(b.tiers) : null;
  let image: string | null | undefined;
  if (b.image === null) image = null;
  else if (typeof b.image === "string" && b.image) {
    const m = IMAGE_URL.exec(b.image);
    if (!m) throw new InvoiceError(400, "GAMBAR_TIDAK_VALID", "Gambar harus PNG, JPG, atau WebP.");
    if (Math.floor((m[2].length * 3) / 4) > MAX_IMAGE_BYTES) throw new InvoiceError(400, "GAMBAR_TERLALU_BESAR", "Gambar terlalu besar, maksimal 900KB.");
    image = b.image;
  }
  return {
    name,
    description: text(b.description, 500) || null,
    price,
    tiers: cfg && cfg.list.length ? cfg : null,
    category: text(b.category, 60) || null,
    image,
  };
}

function isUniqueViolation(e: unknown): boolean {
  const x = e as { code?: string; cause?: { code?: string } };
  return x?.code === "23505" || x?.cause?.code === "23505";
}

const cols = {
  id: invoiceProducts.id,
  name: invoiceProducts.name,
  description: invoiceProducts.description,
  price: invoiceProducts.price,
  tiers: invoiceProducts.tiers,
  category: invoiceProducts.category,
  imageV: invoiceProducts.imageV,
};

export async function listProducts(): Promise<ProductRow[]> {
  return db.select(cols).from(invoiceProducts).orderBy(asc(sql`lower(${invoiceProducts.name})`), asc(invoiceProducts.id));
}

export async function getProductImage(id: number): Promise<string | null> {
  const [row] = await db.select({ img: invoiceProducts.imageData }).from(invoiceProducts).where(eq(invoiceProducts.id, id)).limit(1);
  return row?.img ?? null;
}

export async function createProduct(input: ProductInput): Promise<ProductRow> {
  try {
    const [row] = await db
      .insert(invoiceProducts)
      .values({
        name: input.name,
        description: input.description,
        price: input.price,
        tiers: input.tiers,
        category: input.category,
        imageData: input.image ?? null,
        imageV: input.image ? 1 : 0,
      })
      .returning(cols);
    return row;
  } catch (e) {
    if (isUniqueViolation(e)) throw new InvoiceError(409, "NAMA_SUDAH_ADA", `Produk "${input.name}" sudah ada di katalog. Ubah produk yang lama saja.`);
    throw e;
  }
}

export async function updateProduct(id: number, input: ProductInput): Promise<ProductRow> {
  try {
    const [cur] = await db.select({ v: invoiceProducts.imageV }).from(invoiceProducts).where(eq(invoiceProducts.id, id)).limit(1);
    if (!cur) throw new InvoiceError(404, "TIDAK_DITEMUKAN", "Produk tidak ditemukan.");
    const imagePatch =
      input.image === undefined ? {} : input.image === null ? { imageData: null, imageV: 0 } : { imageData: input.image, imageV: cur.v + 1 };
    const [row] = await db
      .update(invoiceProducts)
      .set({ name: input.name, description: input.description, price: input.price, tiers: input.tiers, category: input.category, updatedAt: new Date(), ...imagePatch })
      .where(eq(invoiceProducts.id, id))
      .returning(cols);
    return row;
  } catch (e) {
    if (isUniqueViolation(e)) throw new InvoiceError(409, "NAMA_SUDAH_ADA", `Produk "${input.name}" sudah ada di katalog.`);
    throw e;
  }
}

export async function deleteProducts(ids: number[]): Promise<number> {
  const clean = Array.from(new Set(ids.filter((n) => Number.isInteger(n) && n > 0))).slice(0, 500);
  if (!clean.length) return 0;
  const gone = await db.delete(invoiceProducts).where(inArray(invoiceProducts.id, clean)).returning({ id: invoiceProducts.id });
  return gone.length;
}

export type ImportItem = { name: string; description?: string; price?: unknown; tiers?: unknown; category?: string };

/**
 * Impor massal (CSV / contoh). mode "merge": produk bernama sama dilengkapi (isian kosong diisi, isian yang sudah ada
 * dipertahankan - aturan app lama), sisanya ditambah. mode "replace": katalog lama dihapus dulu.
 */
export async function importProducts(items: ImportItem[], mode: "merge" | "replace") {
  const parsed: ProductInput[] = [];
  const seen = new Set<string>();
  for (const it of items.slice(0, 2000)) {
    const name = text(it.name, 200);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      parsed.push(parseProductInput({ name, description: it.description, price: it.price, tiers: it.tiers, category: it.category }));
    } catch {
      /* baris tidak valid dilewati */
    }
  }
  if (!parsed.length) throw new InvoiceError(400, "TIDAK_ADA_PRODUK", "Tidak ada baris produk yang valid.");
  return db.transaction(async (tx) => {
    let added = 0;
    let updated = 0;
    if (mode === "replace") await tx.delete(invoiceProducts);
    const existing = await tx.select().from(invoiceProducts);
    const byName = new Map(existing.map((r) => [r.name.trim().toLowerCase(), r]));
    for (const p of parsed) {
      const cur = byName.get(p.name.toLowerCase());
      if (cur) {
        const patch: Partial<typeof invoiceProducts.$inferInsert> = {};
        if (!cur.description && p.description) patch.description = p.description;
        if (!cur.price && p.price) patch.price = p.price;
        if (!cur.tiers && p.tiers) patch.tiers = p.tiers;
        if (!cur.category && p.category) patch.category = p.category;
        if (Object.keys(patch).length) {
          await tx.update(invoiceProducts).set({ ...patch, updatedAt: new Date() }).where(eq(invoiceProducts.id, cur.id));
          updated += 1;
        }
      } else {
        await tx.insert(invoiceProducts).values({ name: p.name, description: p.description, price: p.price, tiers: p.tiers, category: p.category });
        added += 1;
      }
    }
    return { added, updated, total: parsed.length };
  });
}

export function sampleItems(): ImportItem[] {
  return SAMPLE_CATALOG.map((s) => ({ name: s.name, description: s.description, price: s.price, tiers: s.tiers, category: s.category }));
}

/** Baris CSV katalog: Nama Produk;Keterangan;Harga;Harga Bertingkat;Kategori (gambar tidak ikut). */
export async function catalogCsvRows(): Promise<string[][]> {
  const rows = await listProducts();
  return [
    ["Nama Produk", "Keterangan", "Harga", "Harga Bertingkat", "Kategori"],
    ...rows.map((r) => [r.name, r.description ?? "", String(r.price || ""), r.tiers ? tiersToText(r.tiers).split("\n").join(";") : "", r.category ?? ""]),
  ];
}

/* ---------------- Kategori ---------------- */
export const CATEGORIES_KEY = "invoice_categories";

export async function getSavedCategories(): Promise<string[]> {
  const raw = await getSetting(CATEGORIES_KEY);
  try {
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.map((c) => text(c, 60)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function sanitizeCategories(list: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  (Array.isArray(list) ? list : []).forEach((c) => {
    const v = text(c, 60);
    const k = v.toLowerCase();
    if (v && !seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  });
  return out.slice(0, 60);
}

export async function saveCategories(list: unknown): Promise<string[]> {
  const clean = sanitizeCategories(list);
  await db
    .insert(settings)
    .values({ key: CATEGORIES_KEY, value: JSON.stringify(clean), updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(clean), updatedAt: new Date() } });
  return clean;
}

/** Semua kategori: yang disimpan + yang dipakai produk (urut abjad Indonesia). */
export async function allCategories(): Promise<string[]> {
  const [saved, products] = await Promise.all([getSavedCategories(), listProducts()]);
  const set = new Map<string, string>();
  [...saved, ...products.map((p) => p.category ?? "")].forEach((c) => {
    const v = c.trim();
    if (v && !set.has(v.toLowerCase())) set.set(v.toLowerCase(), v);
  });
  return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "id"));
}
