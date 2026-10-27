import "server-only";
import { and, asc, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoiceItems, invoiceProducts, invoices, settings, type InvoiceTierConfig, type PricePreset } from "@/db/schema";
import { indexById } from "@/lib/catalog-variants";
import type { CatalogItem } from "@/lib/invoice-catalog-match";
import { MAX_RUPIAH, normalizeTiers, parseLooseNumber, sanitizePricePresets, tiersToText } from "@/lib/invoice-pricing";
import { InvoiceError } from "@/lib/invoice-queries";
import { getSetting } from "@/lib/queries";

/**
 * KATALOG PRODUK INVOICE (server)
 * Satu daftar bersama untuk semua perangkat (menggantikan katalog browser + Supabase di app lama).
 * Mengelola katalog (tambah/ubah/hapus/impor) hanya untuk Owner; semua akun berizin Invoice boleh memakainya.
 *
 * VARIAN (sub-kategori) dua tingkat: NOTA -> NCR A5 -> varian "2 Rangkap 1 Warna". Aturan yang dijaga di sini:
 *  - INDUK UTAMA: isGroup = true, parentId = null. Tidak punya harga.
 *  - SUB-INDUK: isGroup = true, parentId = id induk utama. Tidak boleh punya sub-induk lagi.
 *  - VARIAN: produk biasa (harga + tier sendiri), parentId = induk utama atau sub-induk.
 *  - kategori varian SELALU mengikuti induk terdekat; sub-induk mengikuti kategori induk utama;
 *  - gambar yang kosong memakai gambar induk terdekat, lalu naik ke induk utama bila perlu;
 *  - nama + keterangan harus unik PER INDUK (atau di tingkat atas bila tanpa induk);
 *  - menghapus sub-induk: variannya dipindah ke induk utama dengan awalan nama sub-induk;
 *  - menghapus induk utama: varian langsung dilepas jadi produk biasa, ATAU ikut dihapus.
 *    Induk utama yang masih punya sub-induk harus dibereskan dulu (hapus sub-induknya).
 */

export const MAX_IMAGE_BYTES = 900 * 1024;
const IMAGE_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

export type ProductRow = CatalogItem;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  /** true = kartu INDUK (induk utama atau sub-induk). Hanya berlaku saat membuat produk; tidak bisa diubah belakangan. */
  isGroup: boolean;
  /**
   * Ubah: undefined = biarkan; null = jadikan produk biasa; angka = jadikan varian induk itu.
   * Baru: angka = varian/sub-induk dari induk itu. Untuk isGroup baru, angka harus induk utama.
   */
  parentId: number | null | undefined;
  /** "fleksibel" = produk jasa tanpa harga baku (harga ditetapkan saat menjual). Induk selalu "tetap". */
  pricingMode: "tetap" | "fleksibel";
  /** Preset harga produk fleksibel (sudah dirapikan sanitizePricePresets). null = tanpa preset. */
  pricePresets: PricePreset[] | null;
  /** Teks pengganti gambar (maks 60 karakter, sudah dirapikan). null = tidak memakai teks. */
  imageText: string | null;
};

export function parseProductInput(raw: unknown): ProductInput {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = text(b.name, 200);
  if (!name) throw new InvoiceError(400, "NAMA_KOSONG", "Nama produk belum diisi.");
  const isGroup = b.isGroup === true;
  // Induk (varian dari produk lain): angka > 0, null = tanpa induk, tidak dikirim = tidak diubah.
  let parentId: number | null | undefined;
  if (b.parentId === null) parentId = null;
  else if (b.parentId !== undefined && b.parentId !== "") {
    const n = Number(b.parentId);
    if (!Number.isInteger(n) || n <= 0) throw new InvoiceError(400, "INDUK_TIDAK_VALID", "Induk produk tidak valid.");
    parentId = n;
  }
  // Teks harga gaya Indonesia: "25.000" = 25000, "1.500.000", "Rp 7.000", "2,5". (Number("25.000") salah = 25.)
  const priceNum =
    typeof b.price === "string" ? parseLooseNumber(b.price.replace(/rp\.?/gi, "").replace(/\s+/g, "")) : Number(b.price);
  const price = Number.isFinite(priceNum) ? Math.max(0, Math.round(priceNum)) : 0;
  if (price > MAX_RUPIAH) throw new InvoiceError(400, "HARGA_TERLALU_BESAR", "Harga terlalu besar.");
  const cfg = b.tiers ? normalizeTiers(b.tiers) : null;
  // Harga FLEKSIBEL: tanpa harga baku dan tanpa tier (harga ditetapkan saat menjual). Kartu induk selalu tetap.
  const pricingMode = isGroup ? "tetap" : b.pricingMode === "fleksibel" ? "fleksibel" : "tetap";
  const pricePresets = pricingMode === "fleksibel" ? sanitizePricePresets(b.pricePresets) : null;
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
    // Kartu induk tidak punya harga sendiri: harga dan tier ada di varian-variannya.
    // Produk fleksibel juga: tidak ada harga dasar (harga lahir di saat penjualan).
    price: isGroup || pricingMode === "fleksibel" ? 0 : price,
    tiers: isGroup || pricingMode === "fleksibel" ? null : cfg && cfg.list.length ? cfg : null,
    category: text(b.category, 60) || null,
    image,
    // Teks pengganti gambar: dirapikan (trim) dan dibatasi panjang. Tampil hanya pada kartu
    // tanpa gambar sendiri, jadi tidak menambah file/permintaan jaringan apa pun.
    imageText: text(b.imageText, 60) || null,
    isGroup,
    parentId,
    pricingMode,
    pricePresets,
  };
}

/** Kunci pembeda produk di dalam SATU induk (scope 0 = tingkat atas): induk + nama + keterangan (sama dengan indeks unik di database). */
function productKey(scope: number, name: string, description: string | null | undefined): string {
  return `${scope}\u0000${name.trim().toLowerCase()}\u0000${(description ?? "").trim().toLowerCase()}`;
}

let schemaReady: Promise<void> | null = null;

/**
 * Pastikan struktur tabel katalog sudah mengenal VARIAN (kolom parent_id + is_group), HARGA FLEKSIBEL
 * (pricing_mode + price_presets) dan aturan unik PER INDUK.
 * Database lama baru memilikinya setelah /api/setup dijalankan; fungsi ini menyiapkannya otomatis (sekali per
 * instance server, hanya membaca bila sudah beres) supaya fitur varian tidak bergantung pada ingatan menjalankan
 * /api/setup. Aman dijalankan berulang; indeks lama dibuang SETELAH indeks baru jadi.
 */
export function ensureCatalogSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const cols = await db.execute(
        sql`select column_name from information_schema.columns where table_name = 'invoice_products' and column_name in ('parent_id', 'is_group', 'pricing_mode', 'price_presets', 'image_text')`,
      );
      const haveCols = new Set((cols.rows as { column_name: string }[]).map((r) => r.column_name));
      if (!haveCols.has("parent_id")) {
        await db.execute(sql.raw(`ALTER TABLE invoice_products ADD COLUMN IF NOT EXISTS parent_id integer REFERENCES invoice_products(id) ON DELETE SET NULL`));
      }
      if (!haveCols.has("is_group")) {
        await db.execute(sql.raw(`ALTER TABLE invoice_products ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false`));
      }
      if (!haveCols.has("pricing_mode")) {
        await db.execute(sql.raw(`ALTER TABLE invoice_products ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'tetap'`));
      }
      if (!haveCols.has("price_presets")) {
        await db.execute(sql.raw(`ALTER TABLE invoice_products ADD COLUMN IF NOT EXISTS price_presets jsonb`));
      }
      if (!haveCols.has("image_text")) {
        await db.execute(sql.raw(`ALTER TABLE invoice_products ADD COLUMN IF NOT EXISTS image_text text`));
      }
      const idx = await db.execute(
        sql`select indexname from pg_indexes where tablename = 'invoice_products' and indexname in ('invoice_products_parent_idx', 'invoice_products_scope_name_desc_key', 'invoice_products_name_key', 'invoice_products_name_desc_key')`,
      );
      const haveIdx = new Set((idx.rows as { indexname: string }[]).map((r) => r.indexname));
      if (!haveIdx.has("invoice_products_parent_idx")) {
        await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS invoice_products_parent_idx ON invoice_products (parent_id)`));
      }
      if (!haveIdx.has("invoice_products_scope_name_desc_key")) {
        await db.execute(
          sql.raw(
            `CREATE UNIQUE INDEX IF NOT EXISTS invoice_products_scope_name_desc_key ON invoice_products ((coalesce(parent_id, 0)), (lower(btrim(name))), (lower(btrim(coalesce(description, '')))))`,
          ),
        );
      }
      if (haveIdx.has("invoice_products_name_key")) await db.execute(sql.raw(`DROP INDEX IF EXISTS invoice_products_name_key`));
      if (haveIdx.has("invoice_products_name_desc_key")) await db.execute(sql.raw(`DROP INDEX IF EXISTS invoice_products_name_desc_key`));
      /* Index pencocokan NAMA di baris invoice: dipakai riwayat harga produk fleksibel
         (dialog Set Harga cocokkan lower(btrim(product_name)) dengan invoice terbit).
         Tanpa index ini setiap buka dialog menyapu seluruh tabel invoice_items. */
      const itemIdx = await db.execute(
        sql`select indexname from pg_indexes where tablename = 'invoice_items' and indexname = 'invoice_items_name_lower_idx'`,
      );
      if (!(itemIdx.rows as { indexname: string }[]).some((r) => r.indexname === "invoice_items_name_lower_idx")) {
        await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS invoice_items_name_lower_idx ON invoice_items (lower(btrim(product_name)))`));
      }
    })().catch((e) => {
      schemaReady = null; // gagal = coba lagi pada permintaan berikutnya
      throw e;
    });
  }
  return schemaReady;
}

function dupMessage(input: { name: string; description: string | null }): string {
  const ket = input.description ? `keterangan "${input.description}"` : "keterangan kosong";
  return `Produk "${input.name}" dengan ${ket} sudah ada di katalog (atau di induk yang sama). Ubah isi kolom Keterangan supaya beda dari produk itu, atau ubah produk yang lama.`;
}

function isUniqueViolation(e: unknown): boolean {
  const x = e as { code?: string; cause?: { code?: string } };
  return x?.code === "23505" || x?.cause?.code === "23505";
}

const rawCols = {
  id: invoiceProducts.id,
  name: invoiceProducts.name,
  description: invoiceProducts.description,
  price: invoiceProducts.price,
  tiers: invoiceProducts.tiers,
  category: invoiceProducts.category,
  imageV: invoiceProducts.imageV,
  parentId: invoiceProducts.parentId,
  isGroup: invoiceProducts.isGroup,
  pricingMode: invoiceProducts.pricingMode,
  pricePresets: invoiceProducts.pricePresets,
  imageText: invoiceProducts.imageText,
};

type RawRow = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  tiers: InvoiceTierConfig | null;
  category: string | null;
  imageV: number;
  parentId: number | null;
  isGroup: boolean;
  pricingMode: string;
  pricePresets: PricePreset[] | null;
  imageText: string | null;
};

/**
 * Pipihkan baris mentah ke bentuk katalog yang dipakai UI: mode harga selain
 * "fleksibel" dibaca "tetap" (aman dari data lama/ngawang di database), dan
 * id pemilik gambar dituliskan.
 */
function normalizeRaw(r: RawRow): ProductRow {
  return {
    ...r,
    pricingMode: r.pricingMode === "fleksibel" ? "fleksibel" : "tetap",
    pricePresets: Array.isArray(r.pricePresets) ? r.pricePresets : null,
    imageId: r.id,
    // displayText diatur oleh withEffectiveImage/loadProduct (rantai gambar-vs-teks yang berlaku).
    displayText: null,
  };
}

/**
 * Gambar yang BERLAKU: baris tanpa gambar sendiri memakai gambar induk terdekat, lalu naik ke induk utama.
 * imageId = baris pemilik gambar, imageV = versinya (cache browser ikut segar saat gambar induk diganti).
 *
 * TEKS PENGGANTI GAMBAR ikut rantai yang sama, dengan aturan: gambar SELALU menang atas teks pada
 * baris yang sama. displayText = teks yang TAMPIL di kartu (bisa milik sendiri atau warisan pemilik
 * gambar yang berlaku), null = tampilkan gambar (atau kotak kosong bila tidak ada keduanya):
 *   - baris punya gambar sendiri        -> gambar, displayText null.
 *   - baris punya teks (tanpa gambar)   -> kartu teks, displayText = teksnya.
 *   - warisan dari pemilik GAMBAR       -> gambar induk, displayText null.
 *   - warisan dari pemilik TEKS         -> kartu teks induk, displayText = teks induk.
 * Rantai berhenti di baris pertama yang punya gambar ATAU teks, jadi pencariannya tetap satu kali.
 */
function withEffectiveImage(rows: RawRow[]): ProductRow[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const hasText = (x: RawRow) => (x.imageText ?? "").trim() !== "";
  return rows.map((r) => {
    if (r.imageV > 0) return { ...normalizeRaw(r), displayText: null };
    if (hasText(r)) return { ...normalizeRaw(r), displayText: r.imageText };
    const seen = new Set<number>([r.id]);
    let parentId = r.parentId;
    while (parentId != null && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      if (parent.imageV > 0) {
        return { ...normalizeRaw(r), imageId: parent.id, imageV: parent.imageV, displayText: null };
      }
      if (hasText(parent)) {
        return { ...normalizeRaw(r), imageId: parent.id, imageV: 0, displayText: parent.imageText };
      }
      parentId = parent.parentId;
    }
    return { ...normalizeRaw(r), imageV: 0, displayText: null };
  });
}

export async function listProducts(): Promise<ProductRow[]> {
  await ensureCatalogSchema();
  const rows = await db.select(rawCols).from(invoiceProducts).orderBy(asc(sql`lower(${invoiceProducts.name})`), asc(invoiceProducts.id));
  return withEffectiveImage(rows);
}

export async function getProductImage(id: number): Promise<string | null> {
  const [row] = await db.select({ img: invoiceProducts.imageData }).from(invoiceProducts).where(eq(invoiceProducts.id, id)).limit(1);
  return row?.img ?? null;
}

/** Satu produk lengkap dengan gambar yang berlaku (dibaca di dalam transaksi yang sama dengan penulisannya).
 *  Aturan teks pengganti gambar sama dengan withEffectiveImage (gambar menang atas teks pada baris yang sama). */
async function loadProduct(tx: Tx, id: number): Promise<ProductRow> {
  const [row] = await tx.select(rawCols).from(invoiceProducts).where(eq(invoiceProducts.id, id)).limit(1);
  if (!row) throw new InvoiceError(404, "TIDAK_DITEMUKAN", "Produk tidak ditemukan.");
  const ownText = (row.imageText ?? "").trim() !== "";
  if (row.imageV > 0) return { ...normalizeRaw(row), displayText: null };
  if (ownText) return { ...normalizeRaw(row), displayText: row.imageText };
  const seen = new Set<number>([id]);
  let parentId = row.parentId;
  while (parentId != null && !seen.has(parentId)) {
    seen.add(parentId);
    const [parent] = await tx
      .select({
        id: invoiceProducts.id,
        parentId: invoiceProducts.parentId,
        imageV: invoiceProducts.imageV,
        imageText: invoiceProducts.imageText,
      })
      .from(invoiceProducts)
      .where(eq(invoiceProducts.id, parentId))
      .limit(1);
    if (!parent) break;
    if (parent.imageV > 0) return { ...normalizeRaw(row), imageId: parent.id, imageV: parent.imageV, displayText: null };
    if ((parent.imageText ?? "").trim() !== "") {
      return { ...normalizeRaw(row), imageId: parent.id, imageV: 0, displayText: parent.imageText };
    }
    parentId = parent.parentId;
  }
  return { ...normalizeRaw(row), imageV: 0, displayText: null };
}

/** Induk yang sah: ada dan berupa kartu induk (induk utama maupun sub-induk). */
async function requireGroup(tx: Tx, parentId: number) {
  const [g] = await tx
    .select({
      id: invoiceProducts.id,
      name: invoiceProducts.name,
      category: invoiceProducts.category,
      isGroup: invoiceProducts.isGroup,
      parentId: invoiceProducts.parentId,
      imageV: invoiceProducts.imageV,
    })
    .from(invoiceProducts)
    .where(eq(invoiceProducts.id, parentId))
    .limit(1);
  if (!g) throw new InvoiceError(404, "INDUK_TIDAK_DITEMUKAN", "Induk produk tidak ditemukan.");
  if (!g.isGroup) {
    throw new InvoiceError(400, "BUKAN_KARTU_INDUK", `"${g.name}" bukan kartu induk. Buat kartu induk dulu lewat tombol Induk Baru.`);
  }
  return g;
}

/** Induk utama yang sah: kartu induk tanpa induk. Dipakai saat membuat sub-induk. */
async function requireRootGroup(tx: Tx, parentId: number) {
  const g = await requireGroup(tx, parentId);
  if (g.parentId != null) {
    throw new InvoiceError(400, "SUB_INDUK_TERLALU_DALAM", "Sub-induk tidak bisa dimasukkan ke sub-induk lain. Pilih induk utama (mis. NOTA).");
  }
  return g;
}

/**
 * Ganti kategori sebuah induk dan seluruh isinya. Untuk induk utama: sub-induk + variannya ikut.
 * Untuk sub-induk: varian langsungnya ikut. Dipanggil di dalam transaksi.
 */
async function propagateCategory(tx: Tx, groupId: number, category: string | null): Promise<void> {
  const kids = await tx
    .select({ id: invoiceProducts.id, isGroup: invoiceProducts.isGroup, parentId: invoiceProducts.parentId })
    .from(invoiceProducts)
    .where(eq(invoiceProducts.parentId, groupId));
  if (!kids.length) return;
  await tx.update(invoiceProducts).set({ category, updatedAt: new Date() }).where(eq(invoiceProducts.parentId, groupId));
  const childGroupIds = kids.filter((kid) => kid.isGroup).map((kid) => kid.id);
  if (childGroupIds.length) {
    await tx.update(invoiceProducts).set({ category, updatedAt: new Date() }).where(inArray(invoiceProducts.parentId, childGroupIds));
  }
}

export async function createProduct(input: ProductInput): Promise<ProductRow> {
  await ensureCatalogSchema();
  try {
    return await db.transaction(async (tx) => {
      let parentId: number | null = null;
      let category = input.category;
      if (input.isGroup) {
        if (input.parentId != null) {
          const g = await requireRootGroup(tx, input.parentId);
          parentId = g.id;
          category = g.category; // sub-induk mengikuti kategori induk utama
        }
      } else if (input.parentId != null) {
        const g = await requireGroup(tx, input.parentId);
        parentId = g.id;
        category = g.category; // varian selalu mengikuti kategori induk (utama atau sub-induk)
      }
      const [row] = await tx
        .insert(invoiceProducts)
        .values({
          name: input.name,
          description: input.description,
          price: input.isGroup ? 0 : input.price,
          tiers: input.isGroup ? null : input.tiers,
          category,
          parentId,
          isGroup: input.isGroup,
          pricingMode: input.pricingMode,
          pricePresets: input.pricingMode === "fleksibel" ? input.pricePresets : null,
          imageText: input.imageText,
          imageData: input.image ?? null,
          imageV: input.image ? 1 : 0,
        })
        .returning({ id: invoiceProducts.id });
      return loadProduct(tx, row.id);
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new InvoiceError(409, "NAMA_SUDAH_ADA", dupMessage(input));
    throw e;
  }
}

export async function updateProduct(id: number, input: ProductInput): Promise<ProductRow> {
  await ensureCatalogSchema();
  try {
    return await db.transaction(async (tx) => {
      const [cur] = await tx
        .select({ v: invoiceProducts.imageV, isGroup: invoiceProducts.isGroup, parentId: invoiceProducts.parentId, category: invoiceProducts.category })
        .from(invoiceProducts)
        .where(eq(invoiceProducts.id, id))
        .limit(1);
      if (!cur) throw new InvoiceError(404, "TIDAK_DITEMUKAN", "Produk tidak ditemukan.");
      const imagePatch =
        input.image === undefined ? {} : input.image === null ? { imageData: null, imageV: 0 } : { imageData: input.image, imageV: cur.v + 1 };

      let parentId = cur.parentId;
      let category = input.category;
      let price = input.price;
      let tiers = input.tiers;
      // Mode harga: kartu induk selalu baku. Produk fleksibel dibaca dari input (kalau owner mengubah
      // produk biasa menjadi fleksibel, harga dasar & tier-nya dikosongkan oleh parseProductInput).
      const pricingMode = cur.isGroup ? "tetap" : input.pricingMode;
      if (cur.isGroup) {
        /* Induk tidak bisa dipindah ke induk lain lewat form ini. Sub-induk tetap di bawah induk utamanya;
           induk utama tetap di tingkat atas. Ini mencegah struktur lebih dari dua tingkat. */
        if (input.parentId !== undefined && input.parentId !== cur.parentId) {
          throw new InvoiceError(400, "INDUK_TIDAK_BISA_DIPINDAH", "Induk tidak bisa dipindahkan ke induk lain. Hapus/buat ulang bila perlu.");
        }
        price = 0;
        tiers = null;
        if (parentId != null) {
          const root = await requireRootGroup(tx, parentId);
          category = root.category; // sub-induk selalu mengikuti kategori induk utama
        }
      } else if (input.parentId !== undefined) {
        if (input.parentId === null) parentId = null;
        else if (input.parentId === id) throw new InvoiceError(400, "INDUK_DIRI_SENDIRI", "Produk tidak bisa menjadi varian dari dirinya sendiri.");
        else parentId = input.parentId;
      }
      if (parentId != null && !cur.isGroup) {
        const g = await requireGroup(tx, parentId);
        category = g.category; // varian selalu mengikuti kategori induk
      }

      await tx
        .update(invoiceProducts)
        .set({
          name: input.name,
          description: input.description,
          price,
          tiers,
          category,
          parentId,
          pricingMode,
          pricePresets: pricingMode === "fleksibel" ? input.pricePresets : null,
          imageText: input.imageText,
          updatedAt: new Date(),
          ...imagePatch,
        })
        .where(eq(invoiceProducts.id, id));
      // Ganti kategori induk = seluruh isinya ikut pindah kategori (termasuk varian di sub-induk).
      if (cur.isGroup && (category ?? null) !== (cur.category ?? null)) {
        await propagateCategory(tx, id, category);
      }
      return loadProduct(tx, id);
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new InvoiceError(409, "NAMA_SUDAH_ADA", dupMessage(input));
    throw e;
  }
}

type ReleaseKid = { id: number; name: string; description: string | null; imageV: number; parentId: number | null };

/** Buang awalan nama induk bila varian lama sudah membawanya (mis. "NCR A5 2 Rangkap" -> "2 Rangkap"). */
function stripNamePrefix(name: string, prefix: string): string {
  const cleanName = name.trim();
  const cleanPrefix = prefix.trim();
  if (!cleanPrefix || cleanName.length <= cleanPrefix.length) return cleanName;
  if (!cleanName.toLowerCase().startsWith(`${cleanPrefix.toLowerCase()} `)) return cleanName;
  return cleanName.slice(cleanPrefix.length).trim() || cleanName;
}

/**
 * Lepaskan varian dari induknya. targetParentId null = jadi produk biasa di tingkat atas; angka = pindah ke
 * induk utama (dipakai saat sub-induk dihapus). Namanya diberi awalan `prefix` supaya konteks tidak hilang;
 * kalau tetap bentrok diberi akhiran (2), (3), dst. Pemanggil wajib sudah di dalam transaksi.
 */
async function releaseKids(
  tx: Tx,
  group: { id: number; name: string; imageV: number; category: string | null },
  kids: ReleaseKid[],
  excludeIds: number[],
  targetParentId: number | null = null,
  prefix = group.name,
): Promise<number> {
  if (!kids.length) return 0;
  const scope = targetParentId ?? 0;
  const sameScope = targetParentId == null ? isNull(invoiceProducts.parentId) : eq(invoiceProducts.parentId, targetParentId);
  const where = excludeIds.length ? and(sameScope, notInArray(invoiceProducts.id, excludeIds)) : sameScope;
  const existing = await tx.select({ name: invoiceProducts.name, description: invoiceProducts.description }).from(invoiceProducts).where(where);
  const taken = new Set(existing.map((r) => productKey(scope, r.name, r.description)));
  for (const kid of kids) {
    const base = `${prefix} ${stripNamePrefix(kid.name, group.name)}`.trim().slice(0, 190);
    let name = base;
    for (let n = 2; taken.has(productKey(scope, name, kid.description)) && n < 100; n += 1) name = `${base} (${n})`;
    taken.add(productKey(scope, name, kid.description));
    const inheritImage = kid.imageV === 0 && group.imageV > 0;
    await tx
      .update(invoiceProducts)
      .set({
        name,
        parentId: targetParentId,
        ...(targetParentId != null ? { category: group.category } : {}),
        updatedAt: new Date(),
        ...(inheritImage ? { imageData: sql`(select image_data from invoice_products where id = ${group.id})`, imageV: 1 } : {}),
      })
      .where(eq(invoiceProducts.id, kid.id));
  }
  return kids.length;
}

/**
 * Hapus produk. Untuk kartu induk yang punya varian:
 *  - sub-induk: "release" = variannya dipindah ke induk utama dengan awalan nama sub-induk; "delete" = ikut dihapus.
 *  - induk utama: "release" = varian langsung dilepas jadi produk biasa; "delete" = ikut dihapus.
 * Induk utama yang masih punya sub-induk ditolak supaya isi tidak hilang/terlepas tanpa sengaja.
 */
export async function deleteProducts(ids: number[], variants: "release" | "delete" = "release"): Promise<{ deleted: number; released: number }> {
  const clean = Array.from(new Set(ids.filter((n) => Number.isInteger(n) && n > 0))).slice(0, 500);
  if (!clean.length) return { deleted: 0, released: 0 };
  await ensureCatalogSchema();
  return db.transaction(async (tx) => {
    const targets = await tx
      .select({
        id: invoiceProducts.id,
        name: invoiceProducts.name,
        isGroup: invoiceProducts.isGroup,
        imageV: invoiceProducts.imageV,
        parentId: invoiceProducts.parentId,
        category: invoiceProducts.category,
      })
      .from(invoiceProducts)
      .where(inArray(invoiceProducts.id, clean));
    const deleteSet = new Set(targets.map((t) => t.id));
    const groups = targets.filter((t) => t.isGroup);
    let released = 0;

    if (groups.length) {
      const kids = await tx
        .select({
          id: invoiceProducts.id,
          name: invoiceProducts.name,
          description: invoiceProducts.description,
          imageV: invoiceProducts.imageV,
          parentId: invoiceProducts.parentId,
          isGroup: invoiceProducts.isGroup,
        })
        .from(invoiceProducts)
        .where(inArray(invoiceProducts.parentId, groups.map((g) => g.id)))
        .orderBy(asc(invoiceProducts.id));
      const rootWithSub = groups.find((g) => g.parentId == null && kids.some((k) => k.parentId === g.id && k.isGroup));
      if (rootWithSub) {
        throw new InvoiceError(409, "SUB_INDUK_MASIH_ADA", `Induk "${rootWithSub.name}" masih punya sub-induk. Hapus atau pindahkan sub-induknya dulu.`);
      }
      if (variants === "delete") {
        kids.forEach((k) => deleteSet.add(k.id));
      } else {
        const keep = kids.filter((k) => !deleteSet.has(k.id) && !k.isGroup);
        for (const g of groups) {
          released += await releaseKids(
            tx,
            g,
            keep.filter((k) => k.parentId === g.id),
            Array.from(deleteSet),
            g.parentId ?? null,
            g.name,
          );
        }
      }
    }
    if (!deleteSet.size) return { deleted: 0, released: 0 };
    const gone = await tx.delete(invoiceProducts).where(inArray(invoiceProducts.id, Array.from(deleteSet))).returning({ id: invoiceProducts.id });
    return { deleted: gone.length, released };
  });
}

/**
 * Pindahkan beberapa produk ke sebuah induk (jadi variannya), atau lepaskan dari induk (parentId null).
 * Kartu induk tidak bisa dipindah. Produk yang namanya + keterangannya sudah ada di induk tujuan dilewati.
 * Saat dilepas dari sub-induk, nama lengkapnya (NOTA NCR A5 + nama) dipertahankan di tingkat atas.
 */
export async function moveProducts(ids: number[], parentId: number | null): Promise<{ moved: number; skipped: number }> {
  const clean = Array.from(new Set(ids.filter((n) => Number.isInteger(n) && n > 0))).slice(0, 500);
  if (!clean.length) return { moved: 0, skipped: 0 };
  await ensureCatalogSchema();
  try {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: invoiceProducts.id, name: invoiceProducts.name, description: invoiceProducts.description, isGroup: invoiceProducts.isGroup, parentId: invoiceProducts.parentId, imageV: invoiceProducts.imageV })
        .from(invoiceProducts)
        .where(inArray(invoiceProducts.id, clean))
        .orderBy(asc(invoiceProducts.id));
      const movable = rows.filter((r) => !r.isGroup);
      let skipped = clean.length - movable.length;

      if (parentId == null) {
        const kids = movable.filter((r) => r.parentId != null);
        skipped += movable.length - kids.length;
        let moved = 0;
        const parentIds = Array.from(new Set(kids.map((k) => k.parentId as number)));
        for (const pid of parentIds) {
          const [g] = await tx
            .select({ id: invoiceProducts.id, name: invoiceProducts.name, imageV: invoiceProducts.imageV, category: invoiceProducts.category, parentId: invoiceProducts.parentId })
            .from(invoiceProducts)
            .where(eq(invoiceProducts.id, pid))
            .limit(1);
          if (!g) continue;
          /* Nama lengkap: induk utama + sub-induk (bila ada). */
          const parts = [g.name];
          let imageOwner: { id: number; imageV: number } = { id: g.id, imageV: g.imageV };
          if (g.parentId != null) {
            const [root] = await tx
              .select({ id: invoiceProducts.id, name: invoiceProducts.name, imageV: invoiceProducts.imageV })
              .from(invoiceProducts)
              .where(eq(invoiceProducts.id, g.parentId))
              .limit(1);
            if (root) {
              parts.unshift(root.name);
              /* Varian tanpa gambar sendiri tetapi sub-induk memakai gambar induk utama:
                 bawa gambar induk utama saat varian dilepas ke tingkat atas. */
              if (!imageOwner.imageV && root.imageV > 0) imageOwner = { id: root.id, imageV: root.imageV };
            }
          }
          moved += await releaseKids(
            tx,
            { ...g, id: imageOwner.id, imageV: imageOwner.imageV },
            kids.filter((k) => k.parentId === pid),
            [],
            null,
            parts.join(" "),
          );
        }
        return { moved, skipped };
      }

      const g = await requireGroup(tx, parentId);
      const inGroup = await tx.select({ name: invoiceProducts.name, description: invoiceProducts.description }).from(invoiceProducts).where(eq(invoiceProducts.parentId, parentId));
      const taken = new Set(inGroup.map((r) => productKey(parentId, r.name, r.description)));
      const sourceIds = Array.from(new Set(movable.map((r) => r.parentId).filter((id): id is number => id != null)));
      const sourceGroups = sourceIds.length
        ? await tx
            .select({ id: invoiceProducts.id, name: invoiceProducts.name, parentId: invoiceProducts.parentId })
            .from(invoiceProducts)
            .where(inArray(invoiceProducts.id, sourceIds))
        : [];
      const sourceById = new Map(sourceGroups.map((row) => [row.id, row]));
      let moved = 0;
      for (const r of movable) {
        if (r.parentId === parentId) {
          skipped += 1;
          continue;
        }
        /* Varian lama bisa sudah membawa nama sub-induk di namanya (mis. "NCR A5 2 Rangkap").
           Buang awalan sumber/tujuan agar nama lengkap di invoice tidak menjadi "NOTA NCR A5 NCR A5 ...". */
        const source = r.parentId != null ? sourceById.get(r.parentId) : undefined;
        let name = r.name;
        if (source?.parentId != null) {
          /* Pindah dari sub-induk: ke sub-induk lain cukup nama pendek (path tujuan menambah konteks),
             tetapi saat kembali ke induk utama nama sub-induk sumber dipertahankan sebagai konteks. */
          name = g.parentId == null
            ? `${source.name} ${stripNamePrefix(name, source.name)}`.trim()
            : stripNamePrefix(name, source.name);
        }
        if (g.parentId != null) name = stripNamePrefix(name, g.name);
        const base = (name.trim() || r.name.trim()).slice(0, 190);
        let finalName = base;
        for (let n = 2; taken.has(productKey(parentId, finalName, r.description)) && n < 100; n += 1) {
          finalName = `${base} (${n})`.slice(0, 200);
        }
        const key = productKey(parentId, finalName, r.description);
        if (taken.has(key)) {
          skipped += 1;
          continue;
        }
        taken.add(key);
        await tx
          .update(invoiceProducts)
          .set({ name: finalName, parentId, category: g.category, updatedAt: new Date() })
          .where(eq(invoiceProducts.id, r.id));
        moved += 1;
      }
      return { moved, skipped };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new InvoiceError(409, "NAMA_SUDAH_ADA", "Ada produk bernama sama di induk tujuan. Ubah namanya atau keterangannya dulu.");
    throw e;
  }
}

/**
 * Baris impor. Kolom `parent` berupa path induk:
 *  - kosong          = produk biasa di tingkat atas;
 *  - "*"             = baris ini kartu induk utama;
 *  - "*NOTA"         = baris ini sub-induk di dalam induk utama NOTA;
 *  - "NOTA"          = varian langsung di bawah induk utama NOTA;
 *  - "NOTA > NCR A5" = varian di bawah sub-induk NCR A5.
 * Path memakai " > " supaya nama sub-induk yang sama di induk berbeda tidak ambigu.
 */
export type ImportItem = { name: string; description?: string; price?: unknown; tiers?: unknown; category?: string; parent?: string; imageText?: string };

type ParsedImport = { input: ProductInput; parentPath: string[]; isGroupRow: boolean };

function importPath(raw: unknown): string[] {
  return String(raw ?? "")
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);
}

function importPathKey(path: string[]): string {
  return path.map((part) => part.trim().toLowerCase()).join("\u0001");
}

/**
 * Impor massal (CSV / contoh). mode "merge": produk dengan induk + nama + keterangan sama dilengkapi (isian kosong diisi,
 * isian yang sudah ada dipertahankan - aturan app lama), sisanya ditambah. Nama yang sama dengan keterangan berbeda
 * dianggap produk berbeda. mode "replace": katalog lama dihapus dulu.
 *
 * Sub-induk dibuat otomatis dari path (`*NOTA` untuk sub-induk, `NOTA > NCR A5` untuk varian). Induk utama yang
 * belum ada juga dibuat otomatis. Bila nama induk bentrok dengan produk biasa, baris varian menjadi produk biasa
 * bernama gabungan; baris sub-induk yang bentrok dilewati.
 */
export async function importProducts(items: ImportItem[], mode: "merge" | "replace") {
  const parsed: ParsedImport[] = [];
  const seen = new Set<string>();
  for (const it of items.slice(0, 2000)) {
    const name = text(it.name, 200);
    if (!name) continue;
    try {
      const parentRaw = text(it.parent, 200);
      const groupMarker = parentRaw.startsWith("*");
      const isGroupRow = groupMarker;
      const parentPath = importPath(groupMarker ? parentRaw.slice(1) : parentRaw);
      if (isGroupRow && parentPath.length > 1) continue; // sub-induk hanya boleh satu tingkat
      if (!isGroupRow && parentPath.length > 2) continue; // maksimal induk utama > sub-induk
      const input = parseProductInput({ name, description: it.description, price: it.price, tiers: it.tiers, category: it.category, isGroup: isGroupRow, imageText: it.imageText });
      const key = `${importPathKey(parentPath)}\u0001${isGroupRow ? "G" : "P"}\u0001${productKey(0, input.name, input.description)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      parsed.push({ input, parentPath, isGroupRow });
    } catch {
      /* baris tidak valid dilewati */
    }
  }
  if (!parsed.length) throw new InvoiceError(400, "TIDAK_ADA_PRODUK", "Tidak ada baris produk yang valid.");
  await ensureCatalogSchema();
  try {
    return await db.transaction(async (tx) => {
      let added = 0;
      let updated = 0;
      let skipped = 0;
      let groupsAdded = 0;
      if (mode === "replace") await tx.delete(invoiceProducts);
      const existing = await tx.select(rawCols).from(invoiceProducts);
      type Row = (typeof existing)[number];
      const byId = new Map<number, Row>(existing.map((r) => [r.id, r]));
      const byKey = new Map<string, Row>();
      const groupByPath = new Map<string, Row>();
      for (const r of existing) byKey.set(productKey(r.parentId ?? 0, r.name, r.description), r);

      const pathOfRow = (r: Row): string[] => {
        const parts: string[] = [r.name.trim()];
        const seen = new Set<number>([r.id]);
        let parentId = r.parentId;
        while (parentId != null && !seen.has(parentId)) {
          seen.add(parentId);
          const parent = byId.get(parentId);
          if (!parent) break;
          parts.unshift(parent.name.trim());
          parentId = parent.parentId;
        }
        return parts;
      };
      for (const r of existing) {
        if (r.isGroup) groupByPath.set(importPathKey(pathOfRow(r)), r);
      }

      const registerGroup = (row: Row) => {
        byId.set(row.id, row);
        groupByPath.set(importPathKey(pathOfRow(row)), row);
      };

      const patchRow = async (cur: Row, patch: Partial<typeof invoiceProducts.$inferInsert>): Promise<Row> => {
        if (!Object.keys(patch).length) return cur;
        const [row] = await tx.update(invoiceProducts).set({ ...patch, updatedAt: new Date() }).where(eq(invoiceProducts.id, cur.id)).returning(rawCols);
        byKey.delete(productKey(cur.parentId ?? 0, cur.name, cur.description));
        byKey.set(productKey(row.parentId ?? 0, row.name, row.description), row);
        byId.set(row.id, row);
        if (row.isGroup) groupByPath.set(importPathKey(pathOfRow(row)), row);
        return row;
      };

      /**
       * Pastikan satu path induk ada. path.length 1 = induk utama, 2 = sub-induk.
       * Hasil null = bentrok dengan produk biasa bernama sama.
       */
      const ensureGroupPath = async (
        path: string[],
        description: string | null,
        category: string | null,
      ): Promise<{ row: Row; created: boolean } | null> => {
        if (!path.length || path.length > 2) return null;
        const key = importPathKey(path);
        const found = groupByPath.get(key);
        if (found) {
          let g = found;
          if (path.length === 2) {
            /* Sub-induk selalu mengikuti kategori induk utama, termasuk saat kategori baru diisi lewat CSV. */
            const root = await ensureGroupPath([path[0]], null, category);
            const wanted = root?.row.category ?? category;
            if (wanted != null && (g.category ?? null) !== wanted) g = await patchRow(g, { category: wanted });
          } else if (!g.category && category) {
            g = await patchRow(g, { category });
            await propagateCategory(tx, g.id, category);
          }
          if (!g.description && description) g = await patchRow(g, { description });
          return { row: g, created: false };
        }

        if (path.length === 1) {
          // Jangan membuat induk yang namanya sudah dipakai produk biasa di tingkat atas.
          if (byKey.has(productKey(0, path[0], description)) || byKey.has(productKey(0, path[0], null))) return null;
          const [row] = await tx
            .insert(invoiceProducts)
            .values({ name: path[0], description, category, isGroup: true, price: 0 })
            .returning(rawCols);
          byKey.set(productKey(0, row.name, row.description), row);
          registerGroup(row);
          groupsAdded += 1;
          return { row, created: true };
        }

        const root = await ensureGroupPath([path[0]], null, category);
        if (!root) return null;
        // Nama sub-induk tidak boleh bentrok dengan varian/produk lain di bawah induk utama.
        if (byKey.has(productKey(root.row.id, path[1], description)) || byKey.has(productKey(root.row.id, path[1], null))) return null;
        const childCategory = root.row.category ?? category;
        const [row] = await tx
          .insert(invoiceProducts)
          .values({ name: path[1], description, category: childCategory, parentId: root.row.id, isGroup: true, price: 0 })
          .returning(rawCols);
        byKey.set(productKey(row.parentId ?? 0, row.name, row.description), row);
        registerGroup(row);
        groupsAdded += 1;
        return { row, created: true };
      };

      // Putaran 1: kartu induk eksplisit. Induk utama didahulukan sebelum sub-induk.
      const groupRows = parsed.filter((x) => x.isGroupRow).sort((a, b) => a.parentPath.length - b.parentPath.length);
      for (const p of groupRows) {
        const path = [...p.parentPath, p.input.name];
        const g = await ensureGroupPath(path, p.input.description, p.input.category);
        if (!g) skipped += 1;
      }

      // Putaran 2: produk biasa + varian.
      for (const p of parsed.filter((x) => !x.isGroupRow)) {
        let name = p.input.name;
        let scope = 0;
        let group: Row | null = null;
        if (p.parentPath.length) {
          const ensured = await ensureGroupPath(p.parentPath, null, p.input.category);
          if (ensured) {
            group = ensured.row;
            scope = group.id;
          } else {
            name = `${p.parentPath.join(" ")} ${p.input.name}`.slice(0, 200);
          }
        }
        const category = group ? group.category : p.input.category;
        let cur = byKey.get(productKey(scope, name, p.input.description));
        // Produk lama bernama sama tapi belum punya keterangan -> lengkapi, jangan bikin kembar.
        if (!cur && p.input.description) {
          const blank = byKey.get(productKey(scope, name, null));
          if (blank && !blank.isGroup) {
            byKey.delete(productKey(scope, name, null));
            cur = blank;
          }
        }
        if (cur && cur.isGroup) {
          skipped += 1; // nama itu sudah dipakai kartu induk
          continue;
        }
        if (cur) {
          const patch: Partial<typeof invoiceProducts.$inferInsert> = {};
          if (!cur.description && p.input.description) patch.description = p.input.description;
          if (!cur.price && p.input.price) patch.price = p.input.price;
          if (!cur.tiers && p.input.tiers) patch.tiers = p.input.tiers;
          if (!cur.imageText && p.input.imageText) patch.imageText = p.input.imageText;
          if (!group && !cur.category && category) patch.category = category;
          if (Object.keys(patch).length) {
            await patchRow(cur, patch);
            updated += 1;
          } else {
            byKey.set(productKey(cur.parentId ?? 0, cur.name, cur.description), cur);
          }
        } else {
          const [row] = await tx
            .insert(invoiceProducts)
            .values({ name, description: p.input.description, price: p.input.price, tiers: p.input.tiers, imageText: p.input.imageText, category, parentId: group ? group.id : null })
            .returning(rawCols);
          byKey.set(productKey(row.parentId ?? 0, row.name, row.description), row);
          byId.set(row.id, row);
          added += 1;
        }
      }
      return { added, updated, skipped, groupsAdded, total: parsed.length };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new InvoiceError(409, "NAMA_SUDAH_ADA", "Impor bentrok dengan produk yang sudah ada (nama + keterangan sama). Coba mode Gabungkan, atau perbaiki baris yang kembar di CSV.");
    throw e;
  }
}

/**
 * Baris CSV katalog: Nama Produk;Keterangan;Harga;Harga Bertingkat;Kategori;Induk (gambar tidak ikut).
 * Kolom Induk memakai path: induk utama = "*"; sub-induk = "*NOTA"; varian = "NOTA" atau "NOTA > NCR A5".
 * Varian/sub-induk ditaruh tepat di bawah induknya. Format ini bisa diimpor ulang tanpa kehilangan struktur.
 */
export async function catalogCsvRows(): Promise<string[][]> {
  const rows = await listProducts();
  const byId = indexById(rows);
  const pathNames = (r: ProductRow): string[] => {
    const parts = [r.name.trim()];
    const seen = new Set<number>([r.id]);
    let parentId = r.parentId;
    while (parentId != null && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      parts.unshift(parent.name.trim());
      parentId = parent.parentId;
    }
    return parts;
  };
  const toRow = (r: ProductRow): string[] => {
    let parent = "";
    if (r.isGroup) parent = r.parentId == null ? "*" : `*${pathNames(byId.get(r.parentId) as ProductRow).join(" > ")}`;
    else if (r.parentId != null) {
      const p = byId.get(r.parentId);
      if (p) parent = pathNames(p).join(" > ");
    }
    return [
      r.name,
      r.description ?? "",
      r.isGroup ? "" : String(r.price || ""),
      r.tiers ? tiersToText(r.tiers).split("\n").join(";") : "",
      r.category ?? "",
      parent,
    ];
  };
  const out: string[][] = [["Nama Produk", "Keterangan", "Harga", "Harga Bertingkat", "Kategori", "Induk"]];
  const kidsOf = new Map<number, ProductRow[]>();
  for (const r of rows) {
    if (r.parentId == null) continue;
    const list = kidsOf.get(r.parentId) ?? [];
    list.push(r);
    kidsOf.set(r.parentId, list);
  }
  const pushDescendants = (group: ProductRow) => {
    const kids = kidsOf.get(group.id) ?? [];
    for (const kid of kids) {
      if (!kid.isGroup) continue;
      out.push(toRow(kid));
      pushDescendants(kid);
    }
    for (const kid of kids) {
      if (!kid.isGroup) out.push(toRow(kid));
    }
  };
  for (const r of rows) {
    if (r.parentId != null) continue;
    out.push(toRow(r));
    if (r.isGroup) pushDescendants(r);
  }
  return out;
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

/** Satu baris riwayat harga: pemakaian produk di invoice yang sudah terbit. */
export type ProductPriceHistoryRow = {
  date: string; // YYYY-MM-DD (WIB)
  number: string | null;
  customer: string;
  invoiceId: number;
  unitPrice: number;
  qty: number;
  amount: number;
};

/**
 * Riwayat harga produk berdasarkan NAMA LENGKAP yang tertulis di baris invoice
 * (baris invoice menyimpan nama produk, bukan id katalog, jadi pencocokan pakai
 * nama — dengan risiko kecil produk yang diganti namanya tidak ditemukan).
 * Hanya invoice doc_type "invoice" berstatus "terbit" yang dihitung; draft dan
 * batal bukan transaksi uang. Dipakai dialog "Set Harga" produk fleksibel
 * sebagai acuan operator menetapkan harga.
 */
export async function getProductPriceHistory(fullNameRaw: string, limit = 6): Promise<ProductPriceHistoryRow[]> {
  const name = fullNameRaw.trim().slice(0, 200);
  if (!name) return [];
  const rows = await db
    .select({
      date: sql<string>`to_char(${invoices.issueDate}, 'YYYY-MM-DD')`,
      number: invoices.number,
      customer: sql<string>`coalesce(nullif(btrim(${invoices.customerName}), ''), 'Tanpa nama')`,
      invoiceId: invoices.id,
      unitPrice: invoiceItems.unitPrice,
      qty: invoiceItems.qty,
      amount: invoiceItems.amount,
    })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoices.id, invoiceItems.invoiceId))
    .where(
      and(
        eq(invoices.docType, "invoice"),
        eq(invoices.status, "terbit"),
        sql`lower(btrim(${invoiceItems.productName})) = lower(btrim(${name}))`,
      ),
    )
    .orderBy(desc(invoices.issueDate), desc(invoiceItems.id))
    .limit(Math.min(Math.max(Math.trunc(limit), 1), 20));
  return rows;
}
