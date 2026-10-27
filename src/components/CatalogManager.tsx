"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore, type Ref } from "react";
import {
  ArrowLeft,
  CheckSquare,
  Download,
  FileText,
  FileUp,
  FolderInput,
  Grid3x3,
  ImagePlus,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { CategoryDropdown, ProductCard, ProductCompactRow, ProductImage, ProductMiniCard, TextTile, duplicateNames, filterProducts } from "@/components/CatalogParts";
import { CatalogQuickCreate } from "@/components/CatalogQuickCreate";
import { ExpandingTabs } from "@/components/ExpandingTabs";
import { Select } from "@/components/Select";
import {
  childGroupsOf,
  childrenOf,
  fullName,
  groupInfoMap,
  groupLabel,
  groupPath,
  indexById,
  leafDescendantsOf,
  pathOf,
  variantsOf,
} from "@/lib/catalog-variants";
import { buildCsv, catalogFromCsv } from "@/lib/csv-parse";
import type { QuickImportItem } from "@/lib/catalog-quick-nota";
import { formatRupiah } from "@/lib/domain";
import { compressImage } from "@/lib/image-compress";
import { SAMPLE_CATALOG, SAMPLE_VARIANTS } from "@/lib/invoice-catalog-sample";
import type { CatalogItem } from "@/lib/invoice-catalog-match";
import { MAX_PRICE_PRESETS, parseTierText, tiersToText } from "@/lib/invoice-pricing";
import { MIN_SEARCH_CHARS, matchesNormalizedSearch, normalizeSearchText } from "@/lib/product-search";

/**
 * GALERI & PENGELOLA KATALOG PRODUK (menggantikan galeri + tab Katalog app lama)
 * Semua akun berizin Invoice bisa MELIHAT; menambah/mengubah/menghapus/impor hanya Owner.
 *
 * VARIAN DUA TINGKAT: kartu INDUK UTAMA (mis. "NOTA") bisa berisi SUB-INDUK (mis. "NCR A5")
 * dan/atau varian langsung. Sub-induk hanya berisi varian (harga + tier sendiri), tidak bisa
 * berisi sub-induk lagi. Mengetuk kartu membuka isinya; tombol "+ Sub-induk" hanya muncul di
 * induk utama. Mode Pilih punya aksi "Jadikan varian…" untuk memindahkan varian lama ke
 * induk/sub-induk (atau melepasnya).
 */

type Draft = {
  id: number | null;
  name: string;
  description: string;
  price: string;
  tiers: string;
  category: string;
  /** undefined = tidak berubah; null = hapus; string = data URL baru. */
  image: string | null | undefined;
  /** Produk ini punya gambar SENDIRI di server (gambar induk yang diwariskan varian tidak dihitung). */
  hadImage: boolean;
  imageV: number;
  /** Varian: id induk/sub-induk. Sub-induk: id induk utama. null = produk biasa / induk utama. */
  parentId: number | null;
  /** true = formulir kartu induk (induk utama atau sub-induk), tanpa harga. */
  isGroup: boolean;
  /** HARGA FLEKSIBEL: produk jasa tanpa harga baku; operator menetapkan harga saat menjual. Kartu induk selalu "tetap". */
  pricingMode: "tetap" | "fleksibel";
  /** Preset harga (owner) untuk produk fleksibel: pilihan klik-cepat di dialog Set Harga. */
  pres: { label: string; price: string }[];
  /** Teks pengganti gambar (tampil di kartu yang tidak punya gambar sendiri). */
  imageText: string;
};

/** Alamat unduhan CSV (bukan halaman, jadi memakai <a> biasa). */
const EXPORT_URL = "/api/invoice-products/export";

/* Tampilan galeri kelola produk. Disimpan di perangkat; bawaan "padat"
   (kartu kecil) supaya lebih banyak produk terlihat saat mengelola. */
const VIEW_KEY = "pf-katalog-kelola-tampilan";
const VIEW_EVENT = "pf-katalog-kelola-tampilan-berubah";
type View = "kartu" | "padat" | "ringkas";

/* Cadangan bila browser menolak localStorage: pilihan tetap berlaku
   sampai halaman ditutup, hanya tidak diingat. */
let fallbackView: View = "padat";

function viewSnapshot(): View {
  try {
    const saved = window.localStorage.getItem(VIEW_KEY);
    return saved === "kartu" || saved === "padat" || saved === "ringkas" ? saved : "padat";
  } catch {
    return fallbackView;
  }
}

/** Server tidak punya localStorage: tampilkan bawaan "padat". */
function serverViewSnapshot(): View {
  return "padat";
}

function subscribeView(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(VIEW_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(VIEW_EVENT, cb);
  };
}

const blank: Draft = { id: null, name: "", description: "", price: "", tiers: "", category: "", image: undefined, hadImage: false, imageV: 0, parentId: null, isGroup: false, pricingMode: "tetap", pres: [], imageText: "" };

function thousands(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d ? Number(d).toLocaleString("id-ID") : "";
}

function tiersToLine(item: CatalogItem): string {
  return item.tiers ? tiersToText(item.tiers).split("\n").join(";") : "";
}

function tierStatus(text: string): { ok: boolean; label: string } {
  const t = text.trim();
  if (!t) return { ok: true, label: "Tanpa harga bertingkat" };
  const cfg = parseTierText(t);
  if (!cfg.list.length) return { ok: false, label: "Format tidak dikenali. Contoh: 2=8000;11=7000" };
  return { ok: true, label: `${cfg.list.length} tier${cfg.mode === "graduated" ? " · progresif" : ""}${cfg.basis === "m2" ? " · basis m²" : ""}` };
}

async function api(url: string, method = "GET", body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; penjelasan?: string; data?: unknown; deleted?: number; released?: number; added?: number; updated?: number; skipped?: number; groupsAdded?: number; moved?: number; total?: number; categories?: string[] };
}

export type CatalogMenuState = {
  categories: string[];
  cat: string;
  counts: Record<string, number>;
};

export type CatalogMenuHandle = {
  pickCsv: () => void;
  downloadSample: () => void;
  openCats: () => void;
  openQuick: () => void;
  setCat: (value: string) => void;
};

function downloadSampleCsv() {
  const rows = [
    ["Nama Produk", "Keterangan", "Harga", "Harga Bertingkat", "Kategori", "Induk"],
    ...SAMPLE_CATALOG.map((s) => [s.name, s.description, s.price, s.tiers, s.category, ""]),
    // Contoh varian: Induk "*" = induk utama; nama induk = varian langsung. Sub-induk memakai "*NOTA" dan variannya "NOTA > NCR A5".
    ...SAMPLE_VARIANTS.map((s) => [s.name, s.description, s.price || "", s.tiers, s.category, s.parent]),
  ];
  const url = URL.createObjectURL(new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "contoh_katalog_harga_bertingkat.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function CatalogManager({
  initialProducts,
  initialCategories,
  isOwner,
  menuRef,
  onMenuChange,
}: {
  initialProducts: CatalogItem[];
  initialCategories: string[];
  isOwner: boolean;
  /** Remote control dari menu tiga garis mobile. */
  menuRef?: Ref<CatalogMenuHandle>;
  /** Laporan kategori/penghitung untuk ditampilkan di menu mobile. */
  onMenuChange?: (state: CatalogMenuState) => void;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState(initialCategories);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("__all");
  const view = useSyncExternalStore(subscribeView, viewSnapshot, serverViewSnapshot);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showCats, setShowCats] = useState(false);
  const [catsText, setCatsText] = useState("");
  const [importing, setImporting] = useState<{ items: ReturnType<typeof catalogFromCsv> } | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  /* Induk yang sedang dibuka (null = daftar utama). */
  const [openId, setOpenId] = useState<number | null>(null);
  /* Pilihan nasib varian saat induk dihapus / pindah-lepas massal. */
  const [groupDel, setGroupDel] = useState<{
    ids: number[];
    affected: { id: number; name: string; kids: number }[];
    fromForm: boolean;
    /** Sub-induk: nama induk utama tujuan pemindahan varian. Induk utama: null = lepas ke tingkat atas. */
    releaseTo: string | null;
  } | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  /* Pilihan tampilan dibaca lewat useSyncExternalStore: server memakai
     "padat", lalu setelah hidrasi browser memakai pilihan yang tersimpan
     tanpa memicu peringatan ketidakcocokan hidrasi. */
  const setView = (v: View) => {
    fallbackView = v;
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* abaikan */
    }
    window.dispatchEvent(new Event(VIEW_EVENT));
  };

  const byId = useMemo(() => indexById(products), [products]);
  const infoMap = useMemo(() => groupInfoMap(products), [products]);
  const groups = useMemo(() => products.filter((p) => p.isGroup), [products]);
  /* Semua induk (utama + sub) untuk pemilih "Induk" dan pemindahan; diurutkan menurut path. */
  const groupOptions = useMemo(
    () => [...groups].sort((a, b) => groupPath(a, byId).localeCompare(groupPath(b, byId), "id")),
    [groups, byId],
  );
  const topCount = useMemo(() => products.filter((p) => p.parentId == null).length, [products]);
  const openGroup = openId != null ? byId.get(openId) : undefined;
  const searching = normalizeSearchText(q).length >= MIN_SEARCH_CHARS;
  /* Di dalam induk: tanpa pencarian tampilkan sub-induk + varian langsung; saat mencari, tampilkan daun yang cocok
     di seluruh cabang induk itu dengan nama lengkap supaya hasil dari sub-induk tidak tersembunyi. */
  const shown = useMemo(() => {
    if (openGroup) {
      if (!searching) return childrenOf(products, openGroup.id);
      return leafDescendantsOf(products, openGroup.id).filter((p) =>
        matchesNormalizedSearch(normalizeSearchText(`${fullName(p, byId)} ${p.description ?? ""} ${p.category ?? ""}`), q),
      );
    }
    return filterProducts(products, q, cat);
  }, [products, q, cat, openGroup, searching, byId]);
  const dupNames = useMemo(() => duplicateNames(products), [products]);
  const openPath = openGroup ? pathOf(openGroup, byId) : [];
  /* Hasil pencarian dari luar induk memakai nama lengkap. Di dalam induk yang tidak sedang mencari, nama pendek cukup. */
  const labelFor = (p: CatalogItem) => {
    if (!p.isGroup && p.parentId != null && (!openGroup || searching)) return fullName(p, byId);
    if (p.isGroup && p.parentId != null && !openGroup) return groupPath(p, byId);
    return undefined;
  };

  /* Induk yang dihapus ikut hilang dari byId, jadi openGroup kosong dan tampilan otomatis kembali ke daftar utama
     (id tidak pernah dipakai ulang). */

  const chooseCat = (v: string) => {
    setCat(v);
    setOpenId(null);
  };

  async function reload() {
    const j = await api("/api/invoice-products");
    const d = j.data as { products: CatalogItem[]; categories: string[] } | undefined;
    if (d) {
      setProducts(d.products);
      setCategories(d.categories);
    }
  }

  function flash(msg: string) {
    setError(null);
    setNotice(msg);
  }

  function openEdit(item: CatalogItem) {
    setFormError(null);
    setDraft({
      id: item.id,
      name: item.name,
      description: item.description ?? "",
      price: item.price ? thousands(String(item.price)) : "",
      tiers: tiersToLine(item),
      category: item.category ?? "",
      image: undefined,
      // Gambar SENDIRI: varian tanpa gambar memakai gambar induk (imageId = id induk), itu bukan miliknya.
      hadImage: item.imageId === item.id && item.imageV > 0,
      imageV: item.imageId === item.id ? item.imageV : 0,
      parentId: item.parentId,
      isGroup: item.isGroup,
      pricingMode: item.isGroup ? "tetap" : item.pricingMode,
      pres: item.pricingMode === "fleksibel" ? (item.pricePresets ?? []).map((p) => ({ label: p.label, price: p.price ? thousands(String(p.price)) : "" })) : [],
      // Teks pengganti MILIK baris ini (bukan teks induk yang diwariskan tampilan).
      imageText: item.imageText ?? "",
    });
  }

  /** Tanpa parent = induk utama baru. Dengan parent = sub-induk di dalam induk utama itu. */
  function openNewGroup(parent: CatalogItem | null = null) {
    setFormError(null);
    setDraft({
      ...blank,
      isGroup: true,
      parentId: parent?.id ?? null,
      category: parent?.category ?? (cat !== "__all" && cat !== "__none" ? cat : ""),
    });
  }

  function openNewVariant(group: CatalogItem) {
    setFormError(null);
    setDraft({ ...blank, parentId: group.id, category: group.category ?? "" });
  }
  /** again = setelah varian baru tersimpan, langsung buka formulir varian kosong untuk induk yang sama. */
  async function save(again = false) {
    if (!draft) return;
    setFormError(null);
    if (!draft.name.trim()) {
      return setFormError(
        draft.isGroup
          ? draft.parentId != null ? "Nama sub-induk belum diisi." : "Nama induk belum diisi."
          : "Nama produk belum diisi.",
      );
    }
    const ts = draft.isGroup ? { ok: true, label: "" } : tierStatus(draft.tiers);
    if (!ts.ok) return setFormError(ts.label);
    setBusy(true);
    try {
      const flexible = !draft.isGroup && draft.pricingMode === "fleksibel";
      const body: Record<string, unknown> = {
        name: draft.name,
        description: draft.description,
        // Produk fleksibel tidak punya harga dasar (harga lahir di saat penjualan) — dikosongkan.
        price: draft.isGroup || flexible ? "" : draft.price.replace(/\D/g, ""),
        tiers: draft.isGroup || flexible ? null : draft.tiers.trim() || null,
        // Varian: kategori ditentukan server (mengikuti induk). Sub-induk juga mengikuti kategori induk utama.
        category: draft.category,
        parentId: draft.parentId,
        // Teks pengganti gambar selalu dikirim (kosong = tidak memakai teks, server menimpa nilai lama).
        imageText: draft.imageText.trim() || null,
      };
      if (!draft.id) body.isGroup = draft.isGroup;
      if (draft.image !== undefined) body.image = draft.image;
      if (!draft.isGroup) {
        body.pricingMode = draft.pricingMode;
        body.pricePresets = [];
        if (flexible) {
          // Preset harga: baris yang dibiarkan kosong diabaikan; label kosong dilengkapi "Opsi N" saat simpan.
          const rows: { label: string; price: number }[] = [];
          let bad = "";
          draft.pres.forEach((p, i) => {
            const label = (p.label.trim() || `Opsi ${i + 1}`).slice(0, 40);
            const n = Number(p.price.replace(/\D/g, ""));
            if (!p.label.trim() && !p.price.trim()) return;
            if (n <= 0) {
              if (!bad) bad = `Preset "${label}": harga belum diisi (atau hapus barisnya).`;
              return;
            }
            rows.push({ label, price: n });
          });
          if (bad) return setFormError(bad);
          body.pricePresets = rows.slice(0, MAX_PRICE_PRESETS);
        }
      }
      const j = draft.id ? await api(`/api/invoice-products/${draft.id}`, "PUT", body) : await api("/api/invoice-products", "POST", body);
      if (!j.ok) return setFormError(j.error ?? j.penjelasan ?? "Gagal menyimpan produk.");
      const hasImg = draft.image ? true : draft.image === null ? false : draft.hadImage;
      const savedId = (j.data as { id?: number } | undefined)?.id;
      const parent = draft.parentId;
      const category = draft.category;
      const kind = draft.isGroup ? (draft.parentId != null ? "Sub-induk" : "Induk") : draft.parentId != null ? "Varian" : "Produk";
      const wasNew = !draft.id;
      const wasGroup = draft.isGroup;
      setDraft(null);
      await reload();
      flash(`${kind} ${wasNew ? "ditambahkan" : "diperbarui"} · ${hasImg ? "dengan gambar" : draft.parentId != null ? "gambar mengikuti induk" : "tanpa gambar"}`);
      if (wasNew && wasGroup && savedId) {
        setOpenId(savedId); // induk/sub-induk baru langsung dibuka supaya varian pertamanya bisa ditambah
        setQ("");
      }
      if (again && wasNew && parent != null) setDraft({ ...blank, parentId: parent, category });
    } finally {
      setBusy(false);
    }
  }

  /**
   * Hapus produk (satu atau banyak). Kartu induk yang punya varian TIDAK ikut dipilih ditanyakan dulu:
   * varian dilepas jadi produk biasa (aman, bawaan) atau ikut dihapus.
   */
  function requestDelete(ids: number[], fromForm = false) {
    const idSet = new Set(ids);
    const selectedGroups = ids
      .map((id) => byId.get(id))
      .filter((p): p is CatalogItem => !!p && p.isGroup);
    /* Induk utama yang masih punya sub-induk tidak dihapus langsung: bereskan sub-induknya dulu supaya
       varian tidak berpindah tempat tanpa disadari. */
    const blocked = selectedGroups.find((g) => childGroupsOf(products, g.id).length > 0);
    if (blocked) {
      const message = `Induk "${blocked.name}" masih punya sub-induk. Hapus sub-induknya dulu sebelum menghapus induk utama.`;
      return fromForm ? setFormError(message) : setError(message);
    }
    const affected = selectedGroups
      .map((g) => ({ id: g.id, name: g.name, kids: variantsOf(products, g.id).filter((v) => !idSet.has(v.id)).length }))
      .filter((g) => g.kids > 0);
    if (affected.length) {
      const first = byId.get(affected[0].id);
      const releaseTo = first?.parentId != null ? (byId.get(first.parentId)?.name ?? "induk utama") : null;
      return setGroupDel({ ids, affected, fromForm, releaseTo });
    }
    const msg =
      ids.length === 1
        ? `Hapus "${byId.get(ids[0])?.name ?? "produk ini"}" dari katalog?`
        : `HAPUS ${ids.length} PRODUK DARI KATALOG?\n\nTindakan ini tidak bisa dibatalkan. Invoice lama tidak terpengaruh.`;
    if (!confirm(msg)) return;
    void doDelete(ids, "release", fromForm);
  }

  async function doDelete(ids: number[], variants: "release" | "delete", fromForm: boolean) {
    setGroupDel(null);
    setBusy(true);
    try {
      const j = await api("/api/invoice-products/bulk-delete", "POST", { ids, variants });
      if (!j.ok) return fromForm ? setFormError(j.error ?? "Gagal menghapus produk.") : setError(j.error ?? "Gagal menghapus.");
      if (fromForm) setDraft(null);
      setSelected(new Set());
      await reload();
      const n = j.deleted ?? ids.length;
      flash(`${n} produk dihapus${j.released ? ` · ${j.released} isi induk dipindahkan, tidak ikut dihapus` : ""}.`);
    } finally {
      setBusy(false);
    }
  }

  async function doMove(parentId: number | null) {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBusy(true);
    try {
      const j = await api("/api/invoice-products/move", "POST", { ids, parentId });
      if (!j.ok) return setError(j.error ?? "Gagal memindahkan produk.");
      setMoveOpen(false);
      setSelected(new Set());
      setSelectMode(false);
      await reload();
      const targetGroup = parentId == null ? undefined : byId.get(parentId);
      const target = targetGroup ? ` ke "${groupPath(targetGroup, byId)}"` : "";
      flash(parentId == null ? `${j.moved ?? 0} varian dilepas jadi produk biasa` : `${j.moved ?? 0} produk jadi varian${target}` + (j.skipped ? ` · ${j.skipped} dilewati (kartu induk, sudah ada di induk itu, atau namanya kembar)` : "") + ".");
    } finally {
      setBusy(false);
    }
  }

  async function pickImage(file: File | undefined) {
    if (!file || !draft) return;
    setFormError(null);
    try {
      const data = await compressImage(file);
      setDraft((d) => (d ? { ...d, image: data } : d));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Gagal memproses gambar.");
    }
  }

  function deleteSelected() {
    const ids = Array.from(selected);
    if (ids.length) requestDelete(ids);
  }

  async function saveCats() {
    setBusy(true);
    try {
      const j = await api("/api/invoice-products/categories", "PUT", { list: catsText.split("\n") });
      if (!j.ok) return setError(j.error ?? "Gagal menyimpan kategori.");
      setCategories(j.categories ?? []);
      setShowCats(false);
      flash("Kategori tersimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function onCsvFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1024 * 1024) return setError("File CSV terlalu besar (maks 1MB).");
    const items = catalogFromCsv(await file.text());
    if (!items.length) return setError("Tidak ada baris produk valid di CSV.");
    if (!products.length) return void doImport(items, "merge");
    setImporting({ items });
  }

  async function doImport(items: ReturnType<typeof catalogFromCsv>, mode: "merge" | "replace") {
    setImporting(null);
    setBusy(true);
    try {
      const j = await api("/api/invoice-products/import", "POST", { items, mode });
      if (!j.ok) return setError(j.error ?? "Gagal mengimpor.");
      await reload();
      const extra = `${j.groupsAdded ? ` · ${j.groupsAdded} induk/sub-induk baru` : ""}${j.skipped ? ` · ${j.skipped} baris dilewati (nama bentrok dengan induk/produk lain)` : ""}`;
      flash(mode === "replace" ? `${j.total} baris menggantikan katalog${extra}.` : `Impor selesai: ${j.added} ditambah, ${j.updated} dilengkapi${extra}.`);
    } finally {
      setBusy(false);
    }
  }

  /** Mode Cepat: semua baris (induk + varian + tambahan) dibuat lewat impor transaksi yang sudah ada. */
  async function submitQuick(items: QuickImportItem[]) {
    const j = await api("/api/invoice-products/import", "POST", { items, mode: "merge" });
    if (!j.ok) return j.error ?? j.penjelasan ?? "Gagal membuat produk dari Mode Cepat.";
    await reload();
    setOpenId(null);
    setQ("");
    setCat("__all");
    const parts = [`${j.added ?? 0} produk baru`];
    if (j.groupsAdded) parts.push(`${j.groupsAdded} induk/sub-induk baru`);
    if (j.updated) parts.push(`${j.updated} dilengkapi`);
    if (j.skipped) parts.push(`${j.skipped} dilewati`);
    flash(`Mode Cepat selesai: ${parts.join(" · ")}.`);
    return null;
  }

  /* Menu tiga garis mobile tidak punya state katalog sendiri. Ia memanggil
     fungsi yang sudah ada di sini lewat ref, supaya impor, contoh CSV,
     dan kelola kategori tetap memakai satu jalur kode. */
  useImperativeHandle(menuRef, () => ({
    pickCsv: () => fileRef.current?.click(),
    downloadSample: downloadSampleCsv,
    openCats: () => {
      setCatsText(categories.join("\n"));
      setShowCats(true);
    },
    openQuick: () => setQuickOpen(true),
    setCat: chooseCat,
  }));

  /* Kirim daftar kategori + jumlah produk ke menu mobile. Menu ini berada
     di luar pohon CatalogManager (dirender InvoiceSidebar), jadi angka dan
     kategori aktif dikirim lewat callback. */
  useEffect(() => {
    if (!onMenuChange) return;
    /* Hanya item tingkat atas: satu induk dihitung satu kartu, variannya ikut kategori induk. */
    const counts: Record<string, number> = { __all: products.filter((p) => p.parentId == null).length };
    for (const product of products) {
      if (product.parentId != null) continue;
      const key = product.category || "__none";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    onMenuChange({ categories, cat, counts });
  }, [categories, cat, products, onMenuChange]);

  const onCardClick = (item: CatalogItem) => {
    if (selectMode) {
      if (!isOwner) return;
      setSelected((s) => {
        const n = new Set(s);
        if (n.has(item.id)) n.delete(item.id);
        else n.add(item.id);
        return n;
      });
    } else if (item.isGroup) {
      // Kartu induk/sub-induk dibuka untuk semua akun; mengubahnya lewat tombol "Ubah induk/sub-induk".
      setOpenId(item.id);
      setQ("");
    } else if (isOwner) openEdit(item);
  };
  /** Props khas kartu induk / label nama untuk semua tampilan galeri. Tombol "+ Varian" hanya ada di tampilan Ringkas
      dan di bagian atas daftar varian; kartu pada tampilan Kartu dan Padat sengaja polos. */
  const cardExtras = (p: CatalogItem) => ({
    group: p.isGroup ? infoMap.get(p.id) : undefined,
    label: labelFor(p),
    hint: p.isGroup ? (selectMode ? "Klik untuk memilih" : "Klik untuk melihat isi") : isOwner ? (selectMode ? "Klik untuk memilih" : "Klik untuk mengubah produk") : undefined,
  });

  const allShownSelected = shown.length > 0 && shown.every((p) => selected.has(p.id));
  const draftTier = draft && !draft.isGroup ? tierStatus(draft.tiers) : null;
  const draftParent = draft && draft.parentId != null ? byId.get(draft.parentId) : undefined;
  /* Varian dan sub-induk: kategori mengikuti induk. */
  const inheritsCat = !!draft && draft.parentId != null;
  const hasOwnImg = !!draft && (!!draft.image || (draft.hadImage && draft.image === undefined));
  /* Isi tanpa gambar sendiri memakai gambar induk; pratinjaunya ditampilkan di formulir. */
  const inheritedImg = !!draft && !hasOwnImg && !!draftParent && draftParent.imageV > 0;
  /* TEKS PENGGANTI: pratinjau milik sendiri (diketik di formulir) dan warisan teks induk.
     Gambar selalu menang atas teks pada kartu yang sama, jadi teks hanya dipratinjau bila
     kartu tidak punya gambar sendiri (sudah dihapus / belum ada). */
  const ownText = !!draft && !hasOwnImg && !inheritedImg && draft.imageText.trim() !== "";
  const inheritedText = !!draft && !hasOwnImg && !ownText && !!draftParent && draftParent.imageV === 0 && !!draftParent.imageText;
  const groupDelKids = groupDel ? groupDel.affected.reduce((n, g) => n + g.kids, 0) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2"><Package size={22} strokeWidth={2.3} /> Katalog Produk</h1>
          <p className="text-sm text-slate-500">
            {isOwner ? "Isi sekali, pakai di semua invoice: nama, keterangan, harga, harga bertingkat, dan gambar." : "Daftar produk dan harga. Pilih produk saat membuat invoice lewat tombol Katalog atau saran saat mengetik nama produk."}
          </p>
        </div>
        {isOwner ? (
          <div role="group" aria-label="Tambah produk" className="seg-group max-sm:w-full">
            <button type="button" onClick={() => { setFormError(null); setDraft({ ...blank, category: cat !== "__all" && cat !== "__none" ? cat : "" }); }} className="seg-btn seg-btn-on max-sm:min-w-0 max-sm:flex-1 max-sm:gap-0.5 max-sm:whitespace-nowrap max-sm:px-1.5 max-sm:py-1.5 max-sm:text-[11.5px]">
              <Plus size={14} className="max-sm:h-4 max-sm:w-4" /> Produk Baru
            </button>
            <button type="button" onClick={() => openNewGroup()} className="seg-btn max-sm:min-w-0 max-sm:flex-1 max-sm:gap-0.5 max-sm:whitespace-nowrap max-sm:px-1.5 max-sm:py-1.5 max-sm:text-[11.5px]" title="Buat kartu induk (mis. Print HVS) yang berisi beberapa varian">
              <Layers size={14} className="max-sm:h-4 max-sm:w-4" /> Induk Baru
            </button>
            <button type="button" onClick={() => setQuickOpen(true)} className="seg-btn max-sm:min-w-0 max-sm:flex-1 max-sm:gap-0.5 max-sm:whitespace-nowrap max-sm:px-1.5 max-sm:py-1.5 max-sm:text-[11.5px]" title="Buat induk, varian, numerator, dan perforasi otomatis">
              <Sparkles size={14} className="max-sm:h-4 max-sm:w-4" /> Mode Cepat
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="flex items-start justify-between gap-2 break-words rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Tutup"><X size={14} /></button></p> : null}
      {notice ? <p className="flex items-start justify-between gap-2 break-words rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Tutup"><X size={14} /></button></p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-[2_1_220px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, keterangan, atau kategori" className="input w-full pl-9 pr-9" />
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Hapus pencarian"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          ) : null}
        </label>
        <CategoryDropdown
          categories={categories}
          items={products}
          value={cat}
          onChange={chooseCat}
          onManage={isOwner ? () => { setCatsText(categories.join("\n")); setShowCats(true); } : undefined}
          className="hidden w-[214px] shrink-0 lg:block"
        />
        {isOwner ? (
          <>
            <button type="button" onClick={() => { setSelectMode((v) => !v); setSelected(new Set()); }} className={`btn-outline min-h-[34px] px-3 py-1.5 text-xs ${selectMode ? "!border-teal-500 !bg-teal-50 !text-teal-700" : ""}`} title="Mode Pilih: klik kartu untuk memilih banyak produk">
              <CheckSquare size={14} /> {selectMode ? "Selesai memilih" : "Pilih"}
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn-outline hidden min-h-[34px] px-3 py-1.5 text-xs lg:inline-flex"><FileUp size={14} /> Impor CSV</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { void onCsvFile(e.target.files?.[0]); e.target.value = ""; }} />
          </>
        ) : null}
        <a href={EXPORT_URL} className="btn-outline hidden min-h-[34px] px-3 py-1.5 text-xs lg:inline-flex"><Download size={14} /> Export CSV</a>
        {isOwner ? (
          <>
            <button type="button" onClick={downloadSampleCsv} className="btn-outline btn-outline-muted hidden min-h-[34px] px-3 py-1.5 text-xs lg:inline-flex"><FileText size={14} /> Contoh CSV</button>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {shown.length} dari{" "}
          {openGroup
            ? searching
              ? leafDescendantsOf(products, openGroup.id).length
              : childrenOf(products, openGroup.id).length
            : topCount}{" "}
          {openGroup ? "item" : "produk"}
          {q.trim().length === 1 ? " · ketik minimal 2 huruf untuk mencari" : ""}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {selectMode ? (
            <span className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                <input type="checkbox" checked={allShownSelected} onChange={(e) => setSelected(e.target.checked ? new Set([...selected, ...shown.map((p) => p.id)]) : new Set([...selected].filter((id) => !shown.some((p) => p.id === id))))} className="h-4 w-4 accent-teal-600" />
                Pilih semua yang tampil
              </label>
              <b className="text-[color:var(--pf-ink)]">{selected.size} dipilih</b>
              <button type="button" onClick={() => { setMoveTarget(""); setMoveOpen(true); }} disabled={!selected.size || busy} className="btn-secondary min-h-[34px] px-3 py-1.5 text-xs" title="Pindahkan produk terpilih ke sebuah induk, atau lepaskan dari induknya"><FolderInput size={13} /> Jadikan varian…</button>
              <button type="button" onClick={deleteSelected} disabled={!selected.size || busy} className="btn-danger px-3 py-1.5 text-xs"><Trash2 size={13} /> Hapus terpilih</button>
            </span>
          ) : null}
          <ExpandingTabs<View>
            ariaLabel="Tampilan katalog"
            value={view}
            onChange={setView}
            items={[
              { value: "kartu", label: "Kartu", icon: <LayoutGrid size={16} />, title: "Tampilan kartu (gambar besar)" },
              { value: "padat", label: "Padat", icon: <Grid3x3 size={16} />, title: "Tampilan padat (kartu kecil, lebih banyak produk terlihat)" },
              { value: "ringkas", label: "Ringkas", icon: <List size={16} />, title: "Tampilan ringkas (daftar baris kecil)" },
            ]}
          />
        </div>
      </div>

      {openGroup ? (
        <div className="card flex flex-wrap items-center gap-x-3 gap-y-2 border-teal-200 p-2.5 dark:border-teal-500/40 max-sm:flex-nowrap max-sm:gap-1.5 max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none">
          <button
            type="button"
            onClick={() => {
              setOpenId(openGroup.parentId ?? null);
              setQ("");
              setSelected(new Set());
            }}
            className="btn-secondary min-h-[34px] px-3 py-1.5 text-xs max-sm:min-h-[32px] max-sm:w-8 max-sm:shrink-0 max-sm:px-0 max-sm:py-1"
            aria-label={openGroup.parentId != null ? `Kembali ke ${byId.get(openGroup.parentId)?.name ?? "induk"}` : "Kembali ke semua produk"}
            title={openGroup.parentId != null ? `Kembali ke ${byId.get(openGroup.parentId)?.name ?? "induk"}` : "Kembali ke semua produk"}
          >
            <ArrowLeft size={14} /> <span className="max-sm:hidden">{openGroup.parentId != null ? `Kembali ke ${byId.get(openGroup.parentId)?.name ?? "induk"}` : "Semua produk"}</span>
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2 max-sm:hidden">
            <ProductImage item={openGroup} className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-extrabold text-[color:var(--pf-ink)]">
                <Layers size={14} className="shrink-0 text-teal-600" /> {openGroup.name}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {openGroup.parentId != null ? `${openPath.map((item) => item.name).join(" / ")} · ` : ""}
                {groupLabel(infoMap.get(openGroup.id) ?? { count: 0, minPrice: null }, formatRupiah)}
                {openGroup.category ? ` · ${openGroup.category}` : ""}
                {openGroup.description ? ` · ${openGroup.description}` : ""}
              </p>
            </div>
          </div>
          {isOwner ? (
            <div role="group" aria-label="Aksi induk" className="seg-group max-sm:min-w-0 max-sm:flex-1">
              {openGroup.parentId == null ? (
                <button type="button" onClick={() => openNewGroup(openGroup)} className="seg-btn max-sm:min-w-0 max-sm:flex-1 max-sm:gap-0.5 max-sm:whitespace-nowrap max-sm:px-1.5 max-sm:py-1.5 max-sm:text-[11.5px]" title="Buat sub-induk di dalam induk utama ini">
                  <Plus size={14} className="max-sm:h-4 max-sm:w-4" /> Sub-induk
                </button>
              ) : null}
              <button type="button" onClick={() => openNewVariant(openGroup)} className="seg-btn seg-btn-on max-sm:min-w-0 max-sm:flex-1 max-sm:gap-0.5 max-sm:whitespace-nowrap max-sm:px-1.5 max-sm:py-1.5 max-sm:text-[11.5px]"><Plus size={14} className="max-sm:h-4 max-sm:w-4" /> Varian</button>
              <button type="button" onClick={() => openEdit(openGroup)} aria-label={`Ubah ${openGroup.parentId != null ? "sub-induk" : "induk"}`} className="seg-btn max-sm:min-w-0 max-sm:flex-1 max-sm:gap-0.5 max-sm:whitespace-nowrap max-sm:px-1.5 max-sm:py-1.5 max-sm:text-[11.5px]"><span className="sm:hidden">Ubah</span><span className="max-sm:hidden">Ubah {openGroup.parentId != null ? "sub-induk" : "induk"}</span></button>
            </div>
          ) : null}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-8 text-center">
          <Package size={30} className="text-teal-500/70" />
          <p className="text-sm font-bold text-[color:var(--pf-ink)]">
            {openGroup
              ? searching
                ? "Tidak ada varian yang cocok."
                : openGroup.parentId != null
                  ? "Sub-induk ini belum punya varian."
                  : "Induk ini belum punya sub-induk atau varian."
              : products.length
                ? "Tidak ada produk yang cocok."
                : "Katalog masih kosong."}
          </p>
          <p className="text-xs text-slate-500">
            {openGroup
              ? isOwner
                ? "Klik + Varian untuk menambah varian, atau + Sub-induk (pada induk utama) untuk membuat kelompok seperti NCR A5."
                : "Minta Owner menambahkan varian."
              : products.length
                ? "Coba ganti kata pencarian atau kategori."
                : isOwner
                  ? "Klik Produk Baru atau impor CSV untuk memulai."
                  : "Minta Owner mengisi katalog produk."}
          </p>
        </div>
      ) : view === "ringkas" ? (
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <ProductCompactRow
              key={p.id}
              item={p}
              selectable={selectMode}
              selected={selected.has(p.id)}
              onClick={() => onCardClick(p)}
              onAddVariant={isOwner && p.isGroup && !selectMode ? () => openNewVariant(p) : undefined}
              {...cardExtras(p)}
            />
          ))}
        </div>
      ) : view === "padat" ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {shown.map((p) => (
            <ProductMiniCard
              key={p.id}
              item={p}
              dupName={dupNames.has(p.name.trim().toLowerCase())}
              selectable={selectMode}
              selected={selected.has(p.id)}
              onClick={() => onCardClick(p)}
              {...cardExtras(p)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((p) => (
            <ProductCard key={p.id} item={p} dupName={dupNames.has(p.name.trim().toLowerCase())} onClick={() => onCardClick(p)} selectable={selectMode} selected={selected.has(p.id)} {...cardExtras(p)} />
          ))}
        </div>
      )}

      {/* ===== Formulir produk / induk / varian ===== */}
      {draft ? (
        /* Sengaja TIDAK menutup saat area luar panel diketuk: isian yang sedang diketik sering hilang karena salah ketuk.
           Menutup lewat tombol X atau Batal. */
        <div className="ppi-modal-back" role="dialog" aria-modal="true" aria-label="Formulir produk">
          <div className="ppi-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-extrabold">
                {draft.isGroup ? <Layers size={15} className="text-teal-600" /> : null}
                {draft.isGroup
                  ? draft.id
                    ? draft.parentId != null ? "Ubah Sub-induk" : "Ubah Induk"
                    : draft.parentId != null ? "Sub-induk Baru" : "Induk Baru"
                  : draft.parentId != null
                    ? draft.id ? "Ubah Varian" : "Varian Baru"
                    : draft.id ? "Ubah Produk" : "Produk Baru"}
              </p>
              <button type="button" onClick={() => setDraft(null)} className="ppi-icon-btn" aria-label="Tutup"><X size={14} /></button>
            </div>
            {draft.isGroup ? (
              <p className="mb-3 rounded-lg bg-teal-50 px-2.5 py-1.5 text-[11px] font-semibold text-teal-800 dark:bg-teal-500/10 dark:text-teal-200">
                {draft.parentId != null
                  ? "Sub-induk membungkus varian di dalam induk utama (mis. NOTA > NCR A5). Sub-induk tidak punya harga dan tidak bisa berisi sub-induk lagi."
                  : "Induk utama membungkus sub-induk dan/atau varian (mis. NOTA). Induk tidak punya harga; harga dan harga bertingkat diisi di setiap varian."}
              </p>
            ) : null}
            <div className="mb-3 flex items-center gap-3">
              {draft.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.image} alt="Gambar produk" className="h-20 w-24 rounded-xl border border-slate-200 object-cover" />
              ) : draft.image === undefined && draft.hadImage && draft.id ? (
                <ProductImage item={{ id: draft.id, name: draft.name, imageV: draft.imageV }} className="h-20 w-24 rounded-xl border border-slate-200" />
              ) : ownText ? (
                <TextTile text={draft.imageText} className="h-20 w-24 rounded-xl border border-slate-200" />
              ) : inheritedImg && draftParent ? (
                <div className="relative h-20 w-24 overflow-hidden rounded-xl border border-dashed border-teal-300">
                  <ProductImage item={{ id: draftParent.id, name: draftParent.name, imageV: draftParent.imageV, imageId: draftParent.imageId }} className="h-20 w-24" />
                  <span className="absolute inset-x-0 bottom-0 bg-teal-700/85 py-0.5 text-center text-[9px] font-bold text-white">Gambar induk</span>
                </div>
              ) : inheritedText && draftParent ? (
                <div className="relative h-20 w-24 overflow-hidden rounded-xl border border-dashed border-teal-300">
                  <TextTile text={draftParent.imageText ?? ""} className="h-20 w-24" />
                  <span className="absolute inset-x-0 bottom-0 bg-teal-700/85 py-0.5 text-center text-[9px] font-bold text-white">Teks induk</span>
                </div>
              ) : (
                <div className="flex h-20 w-24 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400"><ImagePlus size={22} /></div>
              )}
              <div className="flex flex-col gap-1.5">
                <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { void pickImage(e.target.files?.[0]); e.target.value = ""; }} />
                <button type="button" onClick={() => imgRef.current?.click()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700">
                  {hasOwnImg ? "Ganti gambar" : inheritedImg ? "Pakai gambar sendiri" : "Pilih gambar"}
                </button>
                {hasOwnImg ? (
                  <button type="button" onClick={() => setDraft((d) => (d ? { ...d, image: null, hadImage: false } : d))} className="text-left text-[11px] font-bold text-rose-600">
                    {draftParent && draftParent.imageV > 0 ? "Hapus gambar (pakai gambar induk)" : "Hapus gambar"}
                  </button>
                ) : null}
                <span className="text-[10.5px] text-slate-400">
                  {inheritedImg ? "Tanpa gambar sendiri, isi ini memakai gambar induk. " : ""}Dikecilkan otomatis (maks 400px).
                </span>
              </div>
            </div>
            <label className="mb-3 block">
              <span className="ppi-label">Teks pengganti gambar (opsional)</span>
              <input
                value={draft.imageText}
                onChange={(e) => setDraft((d) => (d ? { ...d, imageText: e.target.value } : d))}
                maxLength={60}
                placeholder="mis. CETAK FOTO"
                className="ppi-in boxed"
                aria-label="Teks pengganti gambar"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Tampil besar di kartu yang tidak punya gambar sendiri (kartu induk, produk, atau varian tanpa gambar &mdash; varian ikut teks induknya).
                Kalau kartu punya gambar sendiri, gambar yang tampil dan teks baru aktif lagi setelah gambar dihapus.
              </span>
            </label>
            {!draft.isGroup && groups.length ? (
              <label className="mb-2 block"><span className="ppi-label">Induk (opsional)</span>
                <Select
                  value={draft.parentId != null ? String(draft.parentId) : ""}
                  onChange={(e) => setDraft((d) => (d ? { ...d, parentId: e.target.value ? Number(e.target.value) : null, category: e.target.value ? (byId.get(Number(e.target.value))?.category ?? "") : d.category } : d))}
                  className="ppi-in boxed"
                  aria-label="Induk produk"
                >
                  <option value="">Tanpa induk (produk biasa)</option>
                  {groupOptions.map((g) => (
                    <option key={g.id} value={g.id}>{groupPath(g, byId)}</option>
                  ))}
                </Select>
                {draftParent ? (
                  <span className="mt-1 block text-[11px] text-slate-500">
                    Di invoice tertulis: <b className="text-[color:var(--pf-ink)]">{fullName({ name: draft.name.trim() || "…", parentId: draftParent.id }, byId)}</b>
                  </span>
                ) : null}
              </label>
            ) : null}
            <label className="block"><span className="ppi-label">{draft.isGroup ? (draft.parentId != null ? "Nama sub-induk *" : "Nama induk *") : draft.parentId != null ? "Nama varian *" : "Nama produk *"}</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="ppi-in boxed" placeholder={draft.isGroup ? (draft.parentId != null ? "mis. NCR A5" : "mis. NOTA") : draft.parentId != null ? "mis. A4 Warna" : "mis. Banner Flexi China 280gr"} autoFocus /></label>
            <label className="mt-2 block"><span className="ppi-label">Keterangan</span>
              <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="ppi-in boxed" placeholder="ukuran, finishing, dsb." /></label>
            {/* HARGA FLEKSIBEL: pemilihan mode harga + preset (produk biasa/varian saja, bukan kartu induk). */}
            {!draft.isGroup ? (
              <div className="mt-2">
                <span className="ppi-label">Mode harga</span>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mode harga">
                  {([{ v: "tetap" as const, label: "Harga tetap" }, { v: "fleksibel" as const, label: "Harga fleksibel" }]).map((o) => {
                    const on = draft.pricingMode === o.v;
                    return (
                      <button
                        key={o.v}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setDraft((d) => (d ? { ...d, pricingMode: o.v } : d))}
                        className={`chip px-2.5 py-1.5 text-[11px] font-semibold transition ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-[color:var(--pf-ink-2)] hover:border-indigo-400 hover:text-indigo-700"}`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {draft.pricingMode === "fleksibel" && !draft.isGroup ? (
              <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5 dark:border-indigo-500/20 dark:bg-indigo-500/5">
                <span className="ppi-label">Preset harga (pilihan cepat untuk operator)</span>
                <p className="text-[10.5px] leading-snug text-slate-500">
                  Tanpa harga baku saat menjual &mdash; operator menetapkan harga di dialog &ldquo;Set Harga&rdquo;: preset ini jadi pilihan klik-cepat, riwayat harga invoice produk ini ikut tampil sebagai acuan.
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {draft.pres.map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input
                        value={p.label}
                        onChange={(e) => setDraft((d) => (d ? { ...d, pres: d.pres.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) } : d))}
                        className="ppi-in boxed"
                        style={{ flex: "1 1 0%", minWidth: 0 }}
                        placeholder="Label (mis. Simple)"
                        aria-label={`Label preset ${i + 1}`}
                        maxLength={40}
                      />
                      {/* Lebar & fleksibilitas diatur inline: class global .ppi-in (width:100%) menang atas util Tailwind biasa,
                          jadi tanpa inline style input harga meguasai baris dan input label jadi gepeng. */}
                      <input
                        value={p.price}
                        onChange={(e) => setDraft((d) => (d ? { ...d, pres: d.pres.map((x, j) => (j === i ? { ...x, price: thousands(e.target.value) } : x)) } : d))}
                        inputMode="numeric"
                        className="ppi-in boxed ppi-num"
                        style={{ flex: "0 0 104px", width: 104 }}
                        placeholder="Harga"
                        aria-label={`Harga preset ${i + 1}`}
                      />
                      <button type="button" onClick={() => setDraft((d) => (d ? { ...d, pres: d.pres.filter((_, j) => j !== i) } : d))} className="ppi-icon-btn shrink-0" aria-label="Hapus preset"><X size={12} /></button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={draft.pres.length >= MAX_PRICE_PRESETS}
                  onClick={() => setDraft((d) => (d ? { ...d, pres: [...d.pres, { label: "", price: "" }] } : d))}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg border border-indigo-300 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 disabled:opacity-60 dark:border-indigo-500/50 dark:text-indigo-300"
                >
                  <Plus size={12} /> Tambah preset
                  <span className="font-semibold opacity-70">({draft.pres.length}/{MAX_PRICE_PRESETS})</span>
                </button>
              </div>
            ) : null}
            <div className={`pf-m2-pair mt-2 grid gap-2 ${draft.isGroup || inheritsCat || draft.pricingMode === "fleksibel" ? "grid-cols-1" : "grid-cols-2"}`}>
              {!draft.isGroup && draft.pricingMode !== "fleksibel" ? (
                <label className="block"><span className="ppi-label">Harga dasar (Rp)</span>
                  <input value={draft.price} onChange={(e) => setDraft({ ...draft, price: thousands(e.target.value) })} inputMode="numeric" className="ppi-in boxed ppi-num" placeholder="0" /></label>
              ) : null}
              {!inheritsCat ? (
                <label className="block"><span className="ppi-label">Kategori</span>
                  <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="ppi-in boxed" placeholder="Tanpa kategori" /></label>
              ) : null}
            </div>
            {inheritsCat ? (
              <p className="mt-1.5 text-[11px] text-slate-500">Kategori mengikuti induk{draftParent?.category ? `: ${draftParent.category}` : " (induknya belum punya kategori)"}.</p>
            ) : (
              /* Daftar kategori selalu tampil utuh. (Dulu memakai datalist bawaan browser yang hanya menampilkan
                 kategori yang cocok dengan teks di kolom, jadi saat kolom sudah terisi kategori lama, kategori
                 lain tidak muncul dan tidak bisa dipilih.) Ketik di kolom untuk membuat kategori baru. */
              <div className="mt-1.5 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto" role="group" aria-label="Pilih kategori">
                {[{ label: "Tanpa kategori", value: "" }, ...categories.map((c) => ({ label: c, value: c }))].map((o) => {
                  const on = draft.category.trim().toLowerCase() === o.value.toLowerCase();
                  return (
                    <button
                      key={o.value || "__none"}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDraft((d) => (d ? { ...d, category: o.value } : d))}
                      className={`chip px-2.5 py-1 text-[11px] transition ${on ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 text-[color:var(--pf-ink-2)] hover:border-teal-400 hover:text-teal-700"}`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )}
            {!draft.isGroup && draft.pricingMode !== "fleksibel" ? (
              <label className="mt-2 block"><span className="ppi-label">Harga bertingkat (opsional)</span>
                <input value={draft.tiers} onChange={(e) => setDraft({ ...draft, tiers: e.target.value })} className="ppi-in boxed font-mono text-xs" placeholder="2=8000;11=7000  atau  mode=progresif;basis=m2;5=23000" /></label>
            ) : null}
            {draftTier ? <p className={`mt-1 text-[11px] font-semibold ${draftTier.ok ? "text-teal-700" : "text-rose-600"}`}>{draftTier.label}</p> : null}
            {formError ? <p className="mt-2 break-words rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700">{formError}</p> : null}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              {draft.id ? <button type="button" onClick={() => requestDelete([draft.id as number], true)} disabled={busy} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600"><Trash2 size={13} /> Hapus</button> : <span />}
              <span className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setDraft(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600">Batal</button>
                {!draft.id && !draft.isGroup && draft.parentId != null ? (
                  <button type="button" onClick={() => void save(true)} disabled={busy} className="rounded-xl border border-teal-600 px-3 py-2 text-xs font-bold text-teal-700 disabled:opacity-60">Simpan &amp; tambah lagi</button>
                ) : null}
                <button type="button" onClick={() => void save()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
                  {busy ? <Loader2 size={13} className="animate-spin" /> : null} Simpan
                </button>
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===== Hapus induk yang masih punya varian ===== */}
      {groupDel ? (
        <div className="ppi-modal-back" onClick={() => setGroupDel(null)} role="dialog" aria-modal="true" aria-label="Hapus induk atau sub-induk">
          <div className="ppi-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-extrabold">Hapus {groupDel.affected.length === 1 ? `${groupDel.releaseTo ? "sub-induk" : "induk"} "${groupDel.affected[0].name}"` : `${groupDel.affected.length} induk/sub-induk`}?</p>
            <p className="mt-1 text-xs text-slate-500">
              {groupDel.affected.length === 1
                ? `Induk/sub-induk ini masih punya ${groupDel.affected[0].kids} varian.`
                : `Induk/sub-induk yang dipilih masih punya ${groupDelKids} varian (${groupDel.affected.map((g) => `${g.name}: ${g.kids}`).join(", ")}).`}{" "}
              Mau diapakan variannya? Invoice lama tidak terpengaruh.
            </p>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => void doDelete(groupDel.ids, "release", groupDel.fromForm)} disabled={busy} className="rounded-xl bg-teal-600 px-4 py-2.5 text-left text-xs font-bold text-white">
                {groupDel.releaseTo ? `Pindahkan varian ke induk ${groupDel.releaseTo} (aman)` : "Lepas varian jadi produk biasa (aman)"}
                <span className="mt-0.5 block text-[10.5px] font-medium text-teal-50">
                  {groupDel.releaseTo
                    ? `Varian tetap di dalam induk utama, namanya diberi awalan "${groupDel.affected[0].name}". Harga dan tier tetap.`
                    : `Nama jadi gabungan, mis. "${groupDel.affected[0].name} A4 Warna". Harga dan tier tetap.`}
                </span>
              </button>
              <button type="button" onClick={() => void doDelete(groupDel.ids, "delete", groupDel.fromForm)} disabled={busy} className="rounded-xl border border-rose-300 px-4 py-2.5 text-left text-xs font-bold text-rose-600">
                {groupDel.releaseTo ? "Hapus sub-induk + semua variannya" : "Hapus induk + semua variannya"}
                <span className="mt-0.5 block text-[10.5px] font-medium text-rose-500">Tidak bisa dibatalkan.</span>
              </button>
              <button type="button" onClick={() => setGroupDel(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-600">Batal</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===== Jadikan varian / lepas dari induk (mode Pilih) ===== */}
      {moveOpen ? (
        <div className="ppi-modal-back" onClick={() => !busy && setMoveOpen(false)} role="dialog" aria-modal="true" aria-label="Jadikan varian">
          <div className="ppi-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-sm font-extrabold">Pindahkan {selected.size} produk ke induk</p>
              <button type="button" onClick={() => setMoveOpen(false)} className="ppi-icon-btn" aria-label="Tutup"><X size={14} /></button>
            </div>
            <p className="mb-2 text-[11px] text-slate-500">
              Produk terpilih jadi varian dari induk/sub-induk yang Anda pilih; harga dan harga bertingkatnya tetap, kategorinya mengikuti induk. Kartu induk yang ikut terpilih dilewati.
            </p>
            {groupOptions.length ? (
              <div className="max-h-56 space-y-1 overflow-y-auto" role="radiogroup" aria-label="Induk tujuan">
                {groupOptions.map((g) => {
                  const on = moveTarget === String(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setMoveTarget(String(g.id))}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition ${on ? "border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200" : "border-slate-200 text-slate-700 hover:border-teal-300 dark:border-slate-700 dark:text-slate-200"}`}
                    >
                      <Layers size={13} className="shrink-0 text-teal-600" />
                      <span className="min-w-0 flex-1 truncate">{groupPath(g, byId)}</span>
                      <span className="shrink-0 text-[10.5px] text-slate-500">{infoMap.get(g.id)?.count ?? 0} varian</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
                Belum ada kartu induk.{" "}
                <button type="button" onClick={() => { setMoveOpen(false); setSelectMode(false); setSelected(new Set()); openNewGroup(); }} className="font-bold text-teal-700 underline">Buat induk dulu</button>
              </p>
            )}
            <div className="mt-3 grid gap-2">
              <button type="button" onClick={() => void doMove(Number(moveTarget))} disabled={!moveTarget || busy} className="rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                {busy ? <Loader2 size={13} className="mr-1 inline animate-spin" /> : null}Jadikan varian
              </button>
              <button type="button" onClick={() => void doMove(null)} disabled={busy} className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-600 disabled:opacity-50" title="Varian terpilih dilepas dari induknya jadi produk biasa">
                Lepas dari induk (jadi produk biasa)
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===== Kelola kategori ===== */}
      {showCats ? (
        <div className="ppi-modal-back" onClick={() => setShowCats(false)} role="dialog" aria-modal="true" aria-label="Kelola kategori">
          <div className="ppi-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start justify-between gap-2"><p className="text-sm font-extrabold">Kelola Kategori</p>
              <button type="button" onClick={() => setShowCats(false)} className="ppi-icon-btn" aria-label="Tutup"><X size={14} /></button></div>
            <p className="mb-2 text-[11px] text-slate-500">Satu kategori per baris. Hapus barisnya untuk menghapus kategori. Kategori yang masih dipakai produk tetap tampil di galeri meski dihapus dari daftar ini.</p>
            <textarea value={catsText} onChange={(e) => setCatsText(e.target.value)} rows={8} className="ppi-in boxed" />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCats(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600">Batal</button>
              <button type="button" onClick={() => void saveCats()} disabled={busy} className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white">Simpan</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===== Pilih cara impor ===== */}
      {importing ? (
        <div className="ppi-modal-back" onClick={() => setImporting(null)} role="dialog" aria-modal="true" aria-label="Impor CSV">
          <div className="ppi-modal" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-extrabold">Impor {importing.items.length} produk dari CSV</p>
            <p className="mt-1 text-xs text-slate-500">Katalog saat ini berisi {products.length} produk. Gabungkan akan melengkapi isian yang kosong tanpa menimpa yang sudah ada.</p>
            <p className="mt-1 text-[11px] text-slate-500">Kolom Induk memakai path: <b>*</b> = induk utama, <b>*NOTA</b> = sub-induk, <b>NOTA &gt; NCR A5</b> = varian di sub-induk.</p>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => void doImport(importing.items, "merge")} className="rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white">Gabungkan dengan katalog</button>
              <button type="button" onClick={() => { if (confirm(`Ganti SELURUH katalog (${products.length} produk) dengan ${importing.items.length} produk dari CSV?\n\nGambar produk lama ikut hilang.`)) void doImport(importing.items, "replace"); }} className="rounded-xl border border-rose-300 px-4 py-2.5 text-xs font-bold text-rose-600">Ganti seluruh katalog</button>
              <button type="button" onClick={() => setImporting(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-600">Batal</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===== Mode Cepat: induk + varian + tambahan otomatis ===== */}
      {quickOpen ? (
        <CatalogQuickCreate
          products={products}
          categories={categories}
          onClose={() => setQuickOpen(false)}
          onSubmit={submitQuick}
        />
      ) : null}
    </div>
  );
}
