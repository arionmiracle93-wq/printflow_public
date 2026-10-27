/**
 * MODE CEPAT KATALOG — CETAK NOTA NCR (kode murni, tanpa database)
 * ===================================================================
 * Mengubah satu isian singkat menjadi daftar produk yang siap dikirim ke
 * endpoint impor katalog yang sudah ada:
 *   - 1 kartu induk baru (tanpa harga), atau memakai induk/sub-induk yang
 *     sudah ada (mis. wadah umum "NOTA" atau "NOTA > NCR A5"),
 *   - varian rangkap × warna (harga per rim + tier),
 *   - produk tambahan numerator/perforasi (per rim),
 *   - produk setting numerator/perforasi (per order, opsional).
 *
 * File ini sengaja tidak menyentuh database dan bisa dipakai di browser
 * maupun server. Semua harga di sini adalah harga PER RIM, bukan per buku.
 */

export type QuickExtraInput = {
  enabled: boolean;
  price: string;
  setup: string;
};

/** Isi ruang gambar varian baru: "inherit" = gambar induk seperti biasa; "text" = kartu teks dari pola. */
export type QuickTileInput = { mode: "inherit" | "text"; pattern: string };

/** Keterangan produk: "auto" = dibuat lengkap per baris; "manual" = satu pola, kata kunci {r}/{w}/{s}/{m}/{p}/{y}. */
export type QuickDescInput = { mode: "auto" | "manual"; text: string };

export type QuickParentMode = "new" | "existing";

export type QuickNotaInput = {
  /** "new" = buat kartu induk baru; "existing" = pakai induk yang sudah ada. */
  parentMode: QuickParentMode;
  /** Nama induk baru saat parentMode = "new". */
  parentName: string;
  /** Induk lama yang dipilih (id) saat parentMode = "existing". */
  existingParentId: number | null;
  /** Path induk lama, mis. "NOTA > NCR A5" (bisa induk utama atau sub-induk). */
  existingParentPath: string;
  /** Awal nama varian saat memakai induk umum (mis. "NCR A5"). Kosongkan bila induk sudah sub-induk. */
  variantPrefix: string;
  category: string;
  size: string;
  material: string;
  rangkap: number[];
  colors: number[];
  /** Kunci: "2x1" = 2 rangkap, 1 warna. Nilai: teks rupiah yang diformat. */
  prices: Record<string, string>;
  autoYield: boolean;
  sheetsPerRim: string;
  upsPerSheet: string;
  sheetsPerBook: string;
  booksPerRim: string;
  minRim: string;
  numerator: QuickExtraInput;
  perforasi: QuickExtraInput;
  /** Teks diskon grosir, mis. "5=5%; 10=10%". */
  discounts: string;
  /** Ruang gambar varian baru: gambar induk (bawaan) atau kartu teks dari pola {r}/{w}/{s}/{m}/{p}. */
  tile: QuickTileInput;
  /** Keterangan produk: otomatis (bawaan) atau satu pola manual untuk semua baris yang dibuat. */
  desc: QuickDescInput;
};

export type QuickProductKind = "induk" | "varian" | "tambahan" | "setting";

export type QuickProduct = {
  key: string;
  kind: QuickProductKind;
  /**
   * Nama yang disimpan di database. Varian memakai nama pendek; saat memakai
   * induk umum, nama pendek diberi awalan label (mis. "NCR A5 ...") supaya
   * beberapa ukuran/bahan tidak bentrok di dalam satu induk.
   */
  name: string;
  /** Nama yang terlihat di invoice (varian = nama induk + nama varian). */
  displayName: string;
  description: string;
  price: number;
  tiers: string;
  category: string;
  /** Kolom "Induk" pada impor: "*" = induk, nama induk = varian, kosong = produk biasa. */
  parent: string;
  /** Ringkasan hasil per rim untuk varian. */
  yieldLabel?: string;
  /** Teks pengganti gambar varian (kartu teks), bila mode "text" dipilih dan pola menghasilkan teks. */
  imageText?: string;
};

export type QuickImportItem = {
  name: string;
  description: string;
  price: string;
  tiers: string;
  category: string;
  parent: string;
  /** Bawaan langsung ke kolom image_text lewat endpoint impor. */
  imageText?: string;
};

export type QuickNotaBuild = {
  parent: QuickProduct | null;
  /** Nama induk tujuan yang sudah digabung path, mis. "NOTA NCR A5". */
  targetParentName: string;
  /** Id induk lama; null saat membuat induk baru. */
  targetParentId: number | null;
  variants: QuickProduct[];
  extras: QuickProduct[];
  products: QuickProduct[];
  items: QuickImportItem[];
  errors: string[];
  warnings: string[];
};

export type QuickExistingProduct = {
  id: number;
  name: string;
  parentId: number | null;
  isGroup: boolean;
};

export type QuickNotaConflicts = {
  errors: string[];
  warnings: string[];
  /** Perkiraan produk yang benar-benar baru (bukan nama yang sudah ada). */
  fresh: number;
};

export type QuickYield = {
  valid: boolean;
  /** Angka buku utuh + sisa lembar (untuk tampilan). */
  label: string;
  books: number;
  remainder: number;
  /** Kalimat siap tempel di keterangan produk. */
  text: string;
};

const MAX_NAME = 200;
const MAX_DESCRIPTION = 500;
const MAX_CATEGORY = 60;

function clip(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function toInt(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))].sort((a, b) => a - b);
}

export function quickPriceKey(rangkap: number, warna: number): string {
  return `${rangkap}x${warna}`;
}

export function quickNumberInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("id-ID") : "";
}

/**
 * Hasil per rim. Bila "otomatis" dipakai, rumusnya:
 *   (lembar per rim × potong per lembar) ÷ (isi lembar per buku × rangkap)
 * Contoh F4 2-up A5, 50 lembar/buku:
 *   1 rangkap = 20 buku; 2 rangkap = 10 buku; 3 rangkap = 6 buku + 100 lembar.
 * Bila NCR sudah collated, pemilik bisa memakai isian manual.
 */
export function quickYieldFor(input: QuickNotaInput, rangkap: number): QuickYield {
  const sheets = toInt(input.sheetsPerRim);
  const ups = toInt(input.upsPerSheet);
  const perBook = toInt(input.sheetsPerBook);
  const r = Math.max(1, Math.round(rangkap));

  if (input.autoYield) {
    if (!sheets || !ups || !perBook) {
      return { valid: false, label: "belum dihitung", books: 0, remainder: 0, text: "Hasil per rim belum dihitung." };
    }
    const totalSheets = sheets * ups;
    const need = perBook * r;
    const books = Math.floor(totalSheets / need);
    const remainder = totalSheets - books * need;
    const label = books > 0
      ? `${books} buku${remainder > 0 ? ` + ${remainder} lembar` : ""}`
      : `0 buku (${totalSheets} lembar)`;
    return {
      valid: true,
      label,
      books,
      remainder,
      text: books > 0
        ? `1 rim ≈ ${label} @ ${perBook} lembar/buku`
        : `1 rim = ${totalSheets} lembar, belum cukup 1 buku @ ${perBook} lembar/buku`,
    };
  }

  const books = toInt(input.booksPerRim);
  return {
    valid: books > 0,
    label: books > 0 ? `${books} buku` : "belum diisi",
    books,
    remainder: 0,
    text: books > 0
      ? `1 rim = ${books} buku${perBook > 0 ? ` @ ${perBook} lembar/buku` : ""}`
      : "Hasil per rim belum diisi.",
  };
}

export type QuickDiscount = { min: number; percent: number };

/** Baca diskon grosir "5=5%; 10=10%" menjadi daftar minimal qty + persen. */
export function parseQuickDiscounts(raw: string): { list: QuickDiscount[]; error: string | null } {
  const text = String(raw ?? "").trim();
  if (!text) return { list: [], error: null };
  const list: QuickDiscount[] = [];
  for (const token of text.split(/[\n\r;|]+/)) {
    const t = token.trim();
    if (!t) continue;
    const match = t.match(/^(?:min\.?\s*)?(\d+)\s*(?:rim)?\s*[=:]\s*(\d+(?:[.,]\d+)?)\s*%?$/i);
    if (!match) {
      return { list: [], error: "Format diskon belum benar. Contoh: 5=5%; 10=10%." };
    }
    const min = Number(match[1]);
    const percent = Number(match[2].replace(",", "."));
    if (!Number.isFinite(min) || min < 1 || !Number.isFinite(percent) || percent <= 0 || percent >= 100) {
      return { list: [], error: "Diskon harus berupa minimal qty dan persen 1–99. Contoh: 5=5%; 10=10%." };
    }
    list.push({ min: Math.round(min), percent });
  }
  const byMin = new Map<number, QuickDiscount>();
  for (const item of list) byMin.set(item.min, item);
  return { list: [...byMin.values()].sort((a, b) => a.min - b.min), error: null };
}

/** Susun teks tier dari harga dasar + diskon. Harga dasar tetap berlaku di qty 1. */
function quickTierText(basePrice: number, discounts: QuickDiscount[]): string {
  if (basePrice <= 0) return "";
  return discounts
    .map((d) => ({ min: d.min, price: Math.max(1, Math.round(basePrice * (1 - d.percent / 100))) }))
    .filter((tier) => tier.price < basePrice)
    .map((tier) => `${tier.min}=${tier.price}`)
    .join(";");
}

function withSuffix(parent: string, suffix: string): string {
  const clean = parent.trim() || "Nota";
  const tail = ` - ${suffix}`;
  return `${clean.slice(0, Math.max(1, MAX_NAME - tail.length))}${tail}`.slice(0, MAX_NAME);
}

/**
 * Ekspansi pola keterangan/kartu teks Mode Cepat:
 *   {r} rangkap · {w} warna · {s} ukuran · {m} bahan · {p} label · {y} hasil per rim.
 * Baris yang tidak berlaku (induk/tambahan tidak punya rangkap/warna) cukup diberi nilainya NULL
 * — sisanya (spasi ganda, ruang kosong) dirapikan. Semua pemrosesan pola murni teks, murah.
 */
function expandQuickTemplate(
  text: string,
  values: { r: number | string | null; w: number | string | null; s: string; m: string; p: string; y: string },
  max: number,
): string {
  return String(text ?? "")
    .replace(/\{r\}/gi, values.r == null ? "" : String(values.r))
    .replace(/\{w\}/gi, values.w == null ? "" : String(values.w))
    .replace(/\{s\}/gi, values.s)
    .replace(/\{m\}/gi, values.m)
    .replace(/\{p\}/gi, values.p)
    .replace(/\{y\}/gi, values.y)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trimEnd();
}

function compactList(values: string[], max = 4): string {
  if (values.length <= max) return values.join(", ");
  return `${values.slice(0, max).join(", ")}, dan ${values.length - max} lainnya`;
}

export function buildQuickNota(input: QuickNotaInput): QuickNotaBuild {
  const parentMode: QuickParentMode = input.parentMode === "existing" ? "existing" : "new";
  const rawExistingPathParts = String(input.existingParentPath ?? "")
    .split(">")
    .map((part) => clip(part, MAX_NAME))
    .filter(Boolean);
  const existingPathParts = rawExistingPathParts.slice(0, 2);
  const newParentName = clip(input.parentName, MAX_NAME);
  const parentName = parentMode === "existing" ? existingPathParts.join(" ") : newParentName;
  /* Path untuk kolom Induk (impor): induk lama memakai "NOTA > NCR A5"; induk baru cukup namanya. */
  const targetParentPath = parentMode === "existing" ? existingPathParts.join(" > ") : newParentName;
  const variantPrefix = clip(input.variantPrefix, 80);
  const category = clip(input.category, MAX_CATEGORY);
  const size = clip(input.size, 40) || "A5";
  const material = clip(input.material, 60) || "NCR";
  const rangkap = uniqueNumbers(input.rangkap);
  const colors = uniqueNumbers(input.colors);
  const minRim = toInt(input.minRim);
  const sheetsPerRim = toInt(input.sheetsPerRim);
  const upsPerSheet = toInt(input.upsPerSheet);
  const sheetsPerBook = toInt(input.sheetsPerBook);
  const booksPerRim = toInt(input.booksPerRim);
  const discounts = parseQuickDiscounts(input.discounts);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!parentName) errors.push(parentMode === "existing" ? "Pilih induk/sub-induk yang sudah ada." : "Nama induk belum diisi.");
  if (parentMode === "existing" && rawExistingPathParts.length > 2) {
    errors.push("Path induk terlalu dalam. Katalog hanya mendukung induk utama > sub-induk > varian.");
  }
  if (rangkap.length === 0) errors.push("Pilih minimal satu opsi rangkap.");
  if (!colors.length) errors.push("Pilih minimal satu opsi warna.");
  if (minRim < 1) errors.push("Minimal order harus minimal 1 rim.");
  if (input.autoYield) {
    if (!sheetsPerRim || !upsPerSheet || !sheetsPerBook) {
      errors.push("Lembar per rim, potongan per lembar, dan isi lembar per buku harus lebih dari 0.");
    }
  } else if (!booksPerRim) {
    errors.push("Hasil per rim (buku) belum diisi.");
  }
  if (discounts.error) errors.push(discounts.error);
  const descManual = input.desc.mode === "manual";
  if (descManual && !clip(input.desc.text, MAX_DESCRIPTION)) {
    errors.push("Keterangan manual belum diisi. Tulis pola keterangannya, atau pilih Otomatis lagi.");
  }

  if (!parentName) {
    return { parent: null, targetParentName: "", targetParentId: null, variants: [], extras: [], products: [], items: [], errors, warnings };
  }

  const shortPrefix = parentMode === "existing" ? variantPrefix : "";
  const finishingLabels = [
    input.numerator.enabled ? "numerator" : "",
    input.perforasi.enabled ? "perforasi" : "",
  ].filter(Boolean);
  const finishingText = finishingLabels.join("/");
  const finishingNote = finishingLabels.length
    ? `${finishingText.charAt(0).toUpperCase()}${finishingText.slice(1)} dihitung terpisah.`
    : "Belum termasuk finishing.";

  /** Ekspansi pola kartu teks varian: {r}=rangkap, {w}=warna, {s}=ukuran, {m}=bahan, {p}=label. */
  const tileTextFor = (r: number, c: number): string =>
    input.tile.mode !== "text"
      ? ""
      : String(input.tile.pattern ?? "")
          .replace(/\{r\}/gi, String(r))
          .replace(/\{w\}/gi, String(c))
          .replace(/\{s\}/gi, size)
          .replace(/\{m\}/gi, material)
          .replace(/\{p\}/gi, shortPrefix || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 60);

  const missingPrices: string[] = [];
  const variants: QuickProduct[] = [];
  for (const r of rangkap) {
    for (const c of colors) {
      const price = toInt(input.prices[quickPriceKey(r, c)]);
      if (price <= 0) missingPrices.push(`${r} rangkap ${c} warna`);
      const yieldInfo = quickYieldFor(input, r);
      const shortName = clip(
        parentMode === "existing" ? `${shortPrefix} ${r} Rangkap ${c} Warna` : `${r} Rangkap ${c} Warna`,
        MAX_NAME,
      );
      variants.push({
        key: `varian-${r}-${c}`,
        kind: "varian",
        name: shortName,
        displayName: `${parentName} ${shortName}`,
        description: descManual
          ? expandQuickTemplate(input.desc.text, { r, w: c, s: size, m: material, p: shortPrefix, y: yieldInfo.text }, MAX_DESCRIPTION)
          : clip(
              `Harga per rim · ${r} rangkap ${c} warna. ${material} ukuran ${size}${upsPerSheet > 1 ? `, ${upsPerSheet} nota/lembar` : ""}. ${yieldInfo.text}. Minimal ${minRim || 1} rim. ${finishingNote}`,
              MAX_DESCRIPTION,
            ),
        price,
        tiers: quickTierText(price, discounts.list),
        category,
        parent: targetParentPath,
        yieldLabel: yieldInfo.label,
        imageText: tileTextFor(r, c) || undefined,
      });
    }
  }
  if (missingPrices.length) {
    errors.push(`Harga per rim belum diisi/lengkap untuk: ${compactList(missingPrices)}.`);
  }

  const yieldSummary = input.autoYield && sheetsPerRim && upsPerSheet
    ? `Hasil per rim dihitung dari ${sheetsPerRim} lembar × ${upsPerSheet} potong, dibagi isi buku × rangkap (lihat tiap varian).`
    : `1 rim = ${booksPerRim || "…"} buku${sheetsPerBook > 0 ? ` @ ${sheetsPerBook} lembar/buku` : ""}.`;
  const autoParentDesc = clip(
    `Harga per rim. Cetak nota ${material} ukuran ${size}${upsPerSheet > 1 ? `, ${upsPerSheet} nota/lembar` : ""}. ${yieldSummary} Minimal ${minRim || 1} rim. Pilih varian rangkap & warna. ${finishingNote}`,
    MAX_DESCRIPTION,
  );
  // Keterangan manual: pola yang sama dipakai untuk induk (rangkap/warna tidak berlaku = dibuang).
  const parentDesc = descManual
    ? expandQuickTemplate(input.desc.text, { r: null, w: null, s: size, m: material, p: shortPrefix, y: yieldSummary }, MAX_DESCRIPTION)
    : autoParentDesc;
  const parent: QuickProduct | null = parentMode === "new"
    ? {
        key: "induk",
        kind: "induk",
        name: newParentName,
        displayName: newParentName,
        description: parentDesc,
        price: 0,
        tiers: "",
        category,
        parent: "*",
      }
    : null;

  const extras: QuickProduct[] = [];
  const extraBase = parentMode === "existing" ? `${parentName} ${shortPrefix}`.trim() : parentName;
  const addExtra = (key: string, label: string, price: number, setup: number) => {
    if (price > 0) {
      extras.push({
        key,
        kind: "tambahan",
        name: withSuffix(extraBase, `${label} (per rim)`),
        displayName: withSuffix(extraBase, `${label} (per rim)`),
        description: descManual
          ? expandQuickTemplate(input.desc.text, { r: null, w: null, s: size, m: material, p: shortPrefix, y: yieldSummary }, MAX_DESCRIPTION)
          : clip(
              `Dihitung per rim, bukan per buku. Qty mengikuti jumlah rim nota. ${label} dikerjakan setelah nota dicetak.`,
              MAX_DESCRIPTION,
            ),
        price,
        tiers: quickTierText(price, discounts.list),
        category,
        parent: "",
      });
    }
    if (setup > 0) {
      extras.push({
        key: `${key}-setting`,
        kind: "setting",
        name: withSuffix(extraBase, `Setting ${label}`),
        displayName: withSuffix(extraBase, `Setting ${label}`),
        description: descManual
          ? expandQuickTemplate(input.desc.text, { r: null, w: null, s: size, m: material, p: shortPrefix, y: yieldSummary }, MAX_DESCRIPTION)
          : clip(`Sekali per order, tidak dikalikan jumlah rim. Setting ${label.toLowerCase()} untuk nota.`, MAX_DESCRIPTION),
        price: setup,
        tiers: "",
        category,
        parent: "",
      });
    }
  };

  const numeratorPrice = toInt(input.numerator.price);
  const numeratorSetup = toInt(input.numerator.setup);
  if (input.numerator.enabled) {
    if (numeratorPrice <= 0) errors.push("Harga numerator per rim belum diisi (atau matikan pilihan numerator).");
    addExtra("numerator", "Numerator", numeratorPrice, numeratorSetup);
  }

  const perforasiPrice = toInt(input.perforasi.price);
  const perforasiSetup = toInt(input.perforasi.setup);
  if (input.perforasi.enabled) {
    if (perforasiPrice <= 0) errors.push("Harga perforasi per rim belum diisi (atau matikan pilihan perforasi).");
    addExtra("perforasi", "Perforasi", perforasiPrice, perforasiSetup);
  }

  if (input.autoYield && rangkap.some((r) => r > 1)) {
    warnings.push("Hasil otomatis membagi lembar menurut rangkap. Kalau NCR sudah collated (1 rim = 500 set), pilih Isi manual.");
  }
  for (const r of rangkap) {
    const info = quickYieldFor(input, r);
    if (input.autoYield && info.valid && info.books === 0) {
      warnings.push(`Rangkap ${r}: 1 rim belum menghasilkan 1 buku penuh.`);
    }
  }

  /* Label hanya diperlukan saat memakai induk utama sebagai wadah umum. Sub-induk (path 2 tingkat) sudah
     memberi konteks "NCR A5", jadi label tidak wajib. */
  if (parentMode === "existing" && existingPathParts.length < 2 && !shortPrefix) {
    warnings.push("Label varian kosong. Nama varian dibuat pendek; isi label (mis. NCR A5) kalau induk ini wadah umum agar mudah dibedakan.");
  }

  const products = parent ? [parent, ...variants, ...extras] : [...variants, ...extras];
  const items: QuickImportItem[] = products.map((product) => ({
    name: product.name,
    description: product.description,
    price: product.price > 0 ? String(product.price) : "",
    tiers: product.tiers,
    category: product.category,
    parent: product.parent,
    imageText: product.imageText,
  }));

  return {
    parent,
    targetParentName: parentName,
    targetParentId: parentMode === "existing" ? input.existingParentId ?? null : null,
    variants,
    extras,
    products,
    items,
    errors,
    warnings,
  };
}

/**
 * Cek bentrok dengan katalog yang sudah ada. Mode Cepat bersifat MENAMBAH,
 * bukan menimpa harga lama. Karena itu varian/tambahan yang namanya sudah
 * ada dianggap error supaya pemilik tidak mengira harganya ikut diperbarui.
 */
export function quickNotaConflicts(build: QuickNotaBuild, existing: QuickExistingProduct[]): QuickNotaConflicts {
  const errors: string[] = [];
  const warnings: string[] = [];
  let fresh = 0;
  const targetName = (build.parent?.name ?? build.targetParentName).trim();
  if (!targetName) return { errors, warnings, fresh };

  const top = existing.filter((item) => item.parentId == null);
  const parentKey = targetName.toLowerCase();
  const existingGroup = build.parent
    ? /* Induk baru: cari bentrok nama di tingkat atas. */
      top.find((item) => item.isGroup && item.name.trim().toLowerCase() === parentKey)
    : /* Induk lama: id lebih aman daripada nama, terutama untuk sub-induk yang namanya bisa sama. */
      (build.targetParentId != null
        ? existing.find((item) => item.id === build.targetParentId && item.isGroup) ?? null
        : top.find((item) => item.isGroup && item.name.trim().toLowerCase() === parentKey) ?? null);
  const existingPlain = build.parent
    ? top.find((item) => !item.isGroup && item.name.trim().toLowerCase() === parentKey)
    : null;

  if (!build.parent) {
    if (!existingGroup) {
      errors.push(`Induk/sub-induk "${build.targetParentName}" tidak ditemukan. Muat ulang katalog lalu pilih induk lagi.`);
    }
  } else if (existingPlain) {
    errors.push(`Nama induk "${targetName}" sudah dipakai produk biasa. Ganti nama induk dulu.`);
  } else if (existingGroup) {
    warnings.push(`Induk "${targetName}" sudah ada. Varian baru akan digabung ke induk itu.`);
  } else {
    fresh += 1;
  }

  /* Varian dibandingkan dengan anak LANGSUNG induk tujuan (termasuk sub-induk, supaya nama tidak ambigu).
     Saat memakai sub-induk, varian lain di induk utama tidak ikut dianggap bentrok karena scopenya berbeda. */
  const existingKids = existingGroup ? existing.filter((item) => item.parentId === existingGroup.id) : [];
  for (const variant of build.variants) {
    const same = existingKids.find((item) => item.name.trim().toLowerCase() === variant.name.trim().toLowerCase());
    if (same) {
      errors.push(`Varian "${variant.name}" sudah ada di induk "${build.targetParentName}". Hapus/ubah varian lama atau ganti label varian.`);
    } else {
      fresh += 1;
    }
  }

  const topNames = new Set(top.map((item) => item.name.trim().toLowerCase()));
  for (const extra of build.extras) {
    if (topNames.has(extra.name.trim().toLowerCase())) {
      errors.push(`Produk "${extra.name}" sudah ada. Hapus/ubah produk lama atau ganti induk/label varian.`);
    } else {
      fresh += 1;
    }
  }

  return { errors, warnings, fresh };
}
