/**
 * PENCARIAN PRODUK KATALOG
 * ===================================================================
 * Pencarian harus tetap berguna walau penulisan produk tidak sama persis
 * dengan yang diketik pengguna. Tiga hal yang ditangani di sini:
 *
 * 1. Normalisasi: huruf besar/kecil, tanda baca, spasi ganda, aksen, dan
 *    karakter tak terlihat (zero-width) tidak boleh membuat produk hilang.
 *    "A3+", "a3", dan "A3 " dianggap sama.
 *
 * 2. Pencocokan per kata: kata boleh diacak. "banner outdoor" tetap
 *    menemukan "Outdoor Banner 60x80".
 *
 * 2b. Pencocokan dari AWAL KATA, bukan sembarang potongan di tengah kata.
 *    "ro" menemukan "Roll Banner" tetapi tidak lagi menemukan "albatROs".
 *    Angka ukuran tetap bisa dicari dari sisi mana pun: "90" menemukan
 *    "60x90" (lihat kataDimulaiDi).
 *
 * 3. Ukuran ditulis rapat atau renggang dianggap sama: "60x90",
 *    "60 x 90", "60X90", dan "60×90" semuanya menjadi "60x90".
 *
 * 4. Sinonim istilah percetakan yang umum. Daftar ini sengaja kecil dan
 *    hanya untuk istilah yang memang dipakai bergantian di toko cetak -
 *    bukan kamus umum. Contoh paling penting: banner = spanduk. Pemilik
 *    sering menamai produk "Spanduk" lalu mencarinya dengan kata "banner".
 */

/** Pencarian baru jalan setelah minimal sekian huruf diketik. 1 huruf (mis. "x") terlalu umum: hampir semua produk ikut cocok. */
export const MIN_SEARCH_CHARS = 2;

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;

const SINONIM: Record<string, readonly string[]> = {
  banner: ["spanduk"],
  spanduk: ["banner"],
  stiker: ["sticker"],
  sticker: ["stiker"],
  fotocopy: ["foto copy", "copy", "fc"],
  copy: ["fotocopy", "fc"],
  fc: ["fotocopy"],
  laminasi: ["laminating"],
  laminating: ["laminasi"],
  brosur: ["brochure"],
  brochure: ["brosur"],
  baliho: ["billboard"],
  billboard: ["baliho"],
  neonbox: ["neon box"],
  "neon box": ["neonbox"],
  xbanner: ["x banner"],
  "x banner": ["xbanner"],
  rollup: ["roll up"],
  "roll up": ["rollup"],
  /* Istilah yang sering ditukar di toko cetak. */
  print: ["cetak"],
  cetak: ["print"],
  cutting: ["cut"],
  cut: ["cutting"],
  undangan: ["invitation"],
  invitation: ["undangan"],
  backdrop: ["background"],
  background: ["backdrop"],
  akrilik: ["acrylic"],
  acrylic: ["akrilik"],
  yasin: ["yahasin", "yaseen"],
  yahasin: ["yasin"],
  yaseen: ["yasin"],
  namacard: ["kartu nama"],
  "kartu nama": ["namacard"],
  idcard: ["id card"],
  "id card": ["idcard"],
};

/*
 * CATATAN: kuncinya adalah KATA setelah normalisasi, jadi kunci berisi
 * spasi (mis. "kartu nama") tidak pernah terkena - query "kartu nama"
 * dipecah jadi dua kata ("kartu" dan "nama"). Kunci seperti itu tetap
 * ditulis sebagai alias buat kunci satu kata (mis. "namacard"), dan
 * bentuknya yang dipakai saat pencocokan tetap "kartu nama".
 */

/** Bentuk teks yang dipakai untuk membandingkan pencarian dan produk. */
export function normalizeSearchText(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(ZERO_WIDTH, "")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    /* Tanda kali (\u00d7, \u2715, \u2716) disamakan dengan huruf x supaya "60\u00d790" = "60x90". */
    .replace(/[\u00d7\u2715\u2716]/g, "x")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    /* Ukuran: "60 x 90" -> "60x90". x yang diapit angka dirapatkan; x di
       dalam kata biasa (mis. "x banner", "flexi") tidak tersentuh. Aturan
       ini berlaku untuk produk DAN kata kunci, jadi keduanya selalu sama. */
    .replace(/(?<=\d) ?x ?(?=\d)/g, "x");
}

/**
 * Apakah `form` ditemukan di `haystack` pada AWAL sebuah kata.
 * Awal kata = awal teks, setelah spasi, atau setelah huruf "x" pemisah
 * ukuran yang diapit angka ("60x90" -> "90" dihitung awal kata).
 * Ini mencegah "ro" cocok dengan "albatros", sambil tetap membiarkan
 * pencarian ukuran seperti "90" atau "40" menemukan "60x90" / "40x60".
 */
function kataDimulaiDi(haystack: string, form: string): boolean {
  let from = 0;
  for (;;) {
    const pos = haystack.indexOf(form, from);
    if (pos === -1) return false;
    if (pos === 0) return true;
    const prev = haystack.charAt(pos - 1);
    if (prev === " ") return true;
    // Pemisah ukuran: "x" di antara dua angka, mis. 60x90.
    if (prev === "x" && pos >= 2 && /\d/.test(haystack.charAt(pos - 2)) && /\d/.test(haystack.charAt(pos))) return true;
    from = pos + 1;
  }
}

/**
 * Apakah teks produk cocok dengan kata kunci.
 * Semua kata pada kata kunci harus ditemukan (dalam urutan bebas) di
 * AWAL kata produk, dan setiap kata boleh cocok lewat sinonimnya.
 */
export function matchesNormalizedSearch(haystack: string, query: string): boolean {
  const normalized = normalizeSearchText(query);
  /* Kurang dari 2 huruf = belum dianggap mencari: semua produk tetap tampil. */
  if (normalized.length < MIN_SEARCH_CHARS) return true;
  const tokens = normalized.split(" ").filter(Boolean);
  if (!tokens.length) return true;

  return tokens.every((token) => {
    const forms = [token, ...(SINONIM[token] ?? []).map((alias) => normalizeSearchText(alias))];
    return forms.some((form) => form.length > 0 && kataDimulaiDi(haystack, form));
  });
}

/** Versi praktis: teks produk dinormalisasi dulu, lalu dicocokkan. */
export function matchesProductSearch(text: string, query: string): boolean {
  return matchesNormalizedSearch(normalizeSearchText(text), query);
}
