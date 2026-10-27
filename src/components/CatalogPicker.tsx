"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Grid3x3, LayoutGrid, List, Loader2, Package, Search, X } from "lucide-react";
import { CategoryChips, CategorySidebar, ProductCard, ProductCompactRow, ProductMiniCard, duplicateNames, filterProducts } from "@/components/CatalogParts";
import { CatalogSetPriceDialog } from "@/components/CatalogPriceDialog";
import { childrenOf, fullName, groupInfoMap, groupLabel, indexById, leafDescendantsOf, pathOf } from "@/lib/catalog-variants";
import { formatRupiah } from "@/lib/domain";
import type { CatalogItem } from "@/lib/invoice-catalog-match";
import { MIN_SEARCH_CHARS, matchesNormalizedSearch, normalizeSearchText } from "@/lib/product-search";

/**
 * Galeri katalog sebagai PEMILIH di dalam editor invoice (tombol "Katalog").
 * Klik kartu = produk masuk ke tabel invoice, lalu jendela otomatis tertutup.
 * Mengelola katalog ada di halaman Katalog (khusus Owner).
 *
 * VARIAN DUA TINGKAT: kartu INDUK UTAMA (mis. "NOTA") tidak punya harga. Mengetuknya membuka
 * sub-induk + varian langsung; mengetuk SUB-INDUK (mis. "NCR A5") membuka variannya. Memilih varian
 * memasukkan produk dengan nama lengkap ("NOTA NCR A5 2 Rangkap 1 Warna"). Saat mengetik di
 * pencarian, hasilnya varian datar dengan nama lengkap, jadi "nota ncr a5" tidak perlu membuka
 * induknya dulu.
 */
/* Pilihan tampilan disimpan di perangkat (preferensi pribadi). Gagal baca/tulis = pakai bawaan. */
const VIEW_KEY = "pf-katalog-pemilih-tampilan";
type View = "kartu" | "padat" | "ringkas";

function readView(): View {
  try {
    const saved = window.localStorage.getItem(VIEW_KEY);
    return saved === "ringkas" || saved === "padat" ? saved : "kartu";
  } catch {
    return "kartu";
  }
}

export function CatalogPicker({
  items,
  categories,
  loading,
  error,
  onPick,
  onClose,
  isOwner,
}: {
  items: CatalogItem[];
  categories: string[];
  loading: boolean;
  error: string | null;
  onPick: (item: CatalogItem) => void;
  onClose: () => void;
  isOwner: boolean;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("__all");
  const [view, setViewState] = useState<View>(readView);
  const setView = (v: View) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* abaikan */
    }
  };
  /* Induk yang sedang dibuka (null = daftar utama). */
  const [openId, setOpenId] = useState<number | null>(null);
  const byId = useMemo(() => indexById(items), [items]);
  const infoMap = useMemo(() => groupInfoMap(items), [items]);
  const openGroup = openId != null ? byId.get(openId) : undefined;
  const searching = normalizeSearchText(q).length >= MIN_SEARCH_CHARS;
  /* Di dalam induk: tanpa pencarian tampilkan sub-induk + varian langsung; saat mencari, tampilkan daun yang cocok
     di seluruh cabang dengan nama lengkap. */
  const shown = useMemo(() => {
    if (openGroup) {
      if (!searching) {
        return childrenOf(items, openGroup.id).filter(
          (p) => !p.isGroup || leafDescendantsOf(items, p.id).length > 0,
        );
      }
      return leafDescendantsOf(items, openGroup.id).filter((p) =>
        matchesNormalizedSearch(normalizeSearchText(`${fullName(p, byId)} ${p.description ?? ""} ${p.category ?? ""}`), q),
      );
    }
    return filterProducts(items, q, cat, { picker: true });
  }, [items, q, cat, openGroup, searching, byId]);
  const dupNames = useMemo(() => duplicateNames(items), [items]);
  const openPath = openGroup ? pathOf(openGroup, byId) : [];

  /* Produk dipilih: namanya dikirim LENGKAP (induk + varian) karena yang tertulis di invoice harus jelas dibaca pelanggan.
     PRODUK FLEKSIBEL (tanpa harga baku, mis. jasa desain): klik kartu membuka dialog "Set Harga" dulu — operator
     menetapkan harga (preset owner/manual) + catatan, baru produk masuk ke invoice. */
  const [flexPick, setFlexPick] = useState<{ item: CatalogItem; name: string } | null>(null);
  const pick = (p: CatalogItem) => {
    const name = fullName(p, byId);
    if (!p.isGroup && p.pricingMode === "fleksibel") {
      setFlexPick({ item: p, name });
      return;
    }
    onPick({ ...p, name });
    onClose();
  };
  const open = (p: CatalogItem) => {
    setOpenId(p.id);
    setQ("");
  };
  /* Nama yang tampil di kartu: lengkap saat hasil datar/pencarian, pendek saat daftar langsung di dalam induk. */
  const labelFor = (p: CatalogItem) => (!p.isGroup && p.parentId != null && (!openGroup || searching) ? fullName(p, byId) : undefined);
  const hintFor = (p: CatalogItem) =>
    p.isGroup
      ? "Klik untuk memilih varian"
      : p.pricingMode === "fleksibel"
        ? "Klik untuk menentukan harga"
        : "Klik untuk menambahkan ke invoice";
  const chooseCat = (v: string) => {
    setCat(v);
    setOpenId(null);
  };

  return (
    <>
    <div className="ppi-modal-back" onClick={onClose} role="dialog" aria-modal="true" aria-label="Katalog produk">
      <div className="ppi-modal flex flex-col !p-3 sm:!p-[18px]" style={{ maxWidth: 820, height: "min(88vh, 720px)" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-extrabold"><Package size={16} className="text-teal-600" /> Katalog Produk</p>
            <p className="text-[11px] text-slate-500">Klik produk untuk menambahkannya ke invoice. Produk berlabel &quot;N varian&quot; punya pilihan: klik untuk memilih variannya.</p>
          </div>
          <button type="button" onClick={onClose} className="ppi-icon-btn" aria-label="Tutup"><X size={14} /></button>
        </div>
        <div className="mb-2 flex items-center gap-2">
        <label className="relative block min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari produk"
            aria-label="Cari produk"
            autoComplete="off"
            enterKeyHint="search"
            className="ppi-in boxed !pl-9 !pr-10"
            autoFocus
          />
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
          <div role="group" aria-label="Tampilan katalog" className="flex shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setView("kartu")}
              aria-pressed={view === "kartu"}
              title="Tampilan kartu (gambar besar)"
              className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold transition ${view === "kartu" ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              <LayoutGrid size={14} /> <span className="max-sm:hidden">Kartu</span>
            </button>
            <button
              type="button"
              onClick={() => setView("padat")}
              aria-pressed={view === "padat"}
              title="Tampilan padat (kartu kecil, lebih banyak produk terlihat)"
              className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold transition ${view === "padat" ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              <Grid3x3 size={14} /> <span className="max-sm:hidden">Padat</span>
            </button>
            <button
              type="button"
              onClick={() => setView("ringkas")}
              aria-pressed={view === "ringkas"}
              title="Tampilan ringkas (daftar kecil, lebih banyak produk terlihat)"
              className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold transition ${view === "ringkas" ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              <List size={14} /> <span className="max-sm:hidden">Ringkas</span>
            </button>
          </div>
        </div>
        {q.trim().length === 1 ? <p className="-mt-1 mb-2 text-[11px] text-slate-500">Ketik minimal 2 huruf untuk mencari.</p> : null}
        {/* Di HP kategori tetap berupa tab mendatar (sidebar akan memakan lebar produk). */}
        <div className="md:hidden">
          <CategoryChips categories={categories} items={items} value={cat} onChange={chooseCat} />
        </div>
        <div className="mt-3 flex min-h-0 flex-1 gap-2 sm:gap-3">
          <aside className="hidden w-40 shrink-0 md:block lg:w-44">
            <CategorySidebar categories={categories} items={items} value={cat} onChange={chooseCat} />
          </aside>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1">
            {openGroup ? (
              <div className="sticky top-0 z-10 -mt-px mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-teal-200 bg-teal-50/95 px-2 py-1.5 backdrop-blur dark:border-teal-500/40 dark:bg-[#0f2a2c]/95">
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(openGroup.parentId ?? null);
                    setQ("");
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-teal-700 shadow-sm ring-1 ring-teal-200 transition hover:bg-teal-100 dark:bg-slate-800 dark:text-teal-200 dark:ring-teal-500/40"
                >
                  <ArrowLeft size={12} strokeWidth={3} /> {openGroup.parentId != null ? `Kembali ke ${byId.get(openGroup.parentId)?.name ?? "induk"}` : "Semua produk"}
                </button>
                <span className="min-w-0 truncate text-[12.5px] font-extrabold text-[color:var(--pf-ink)]">{openPath.map((item) => item.name).join(" / ")}</span>
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">{groupLabel(infoMap.get(openGroup.id) ?? { count: 0, minPrice: null }, formatRupiah)}</span>
                {searching ? <span className="text-[10.5px] text-slate-500">· mencari di dalam induk ini</span> : null}
              </div>
            ) : null}
            {loading ? (
              <p className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Memuat katalog…</p>
            ) : error ? (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>
            ) : shown.length === 0 && openGroup ? (
              <div className="py-10 text-center text-xs text-slate-500">
                <p className="font-bold text-slate-700">
                  {searching
                    ? `Tidak ada varian yang cocok dengan "${q.trim()}".`
                    : openGroup.parentId != null
                      ? "Sub-induk ini belum punya varian."
                      : "Belum ada varian yang bisa dipilih di induk ini."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(openGroup.parentId ?? null);
                    setQ("");
                  }}
                  className="mt-2 font-bold text-teal-700 underline"
                >
                  {openGroup.parentId != null ? "Kembali ke induk utama" : "Kembali ke semua produk"}
                </button>
              </div>
            ) : shown.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                {items.length ? (
                  <>
                    <p className="font-bold text-slate-700">{q.trim() ? `Tidak ada produk yang cocok dengan "${q.trim()}".` : "Tidak ada produk yang cocok."}</p>
                    <p className="mt-1">Coba kata lain{cat !== "__all" ? ", atau pilih kategori Semua" : ""}.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setQ("");
                        setCat("__all");
                      }}
                      className="mt-2 font-bold text-teal-700 underline"
                    >
                      Tampilkan semua produk
                    </button>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-slate-700">Katalog masih kosong.</p>
                    {isOwner ? <Link href="/invoice/katalog" className="mt-1 inline-block font-bold text-teal-700 underline">Isi katalog di sini</Link> : null}
                  </>
                )}
              </div>
            ) : (
              view === "ringkas" ? (
                <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                  {shown.map((p) => (
                    <ProductCompactRow key={p.id} item={p} label={labelFor(p)} group={p.isGroup ? infoMap.get(p.id) : undefined} hint={hintFor(p)} onClick={() => (p.isGroup ? open(p) : pick(p))} />
                  ))}
                </div>
              ) : view === "padat" ? (
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
                  {shown.map((p) => (
                    <ProductMiniCard key={p.id} item={p} label={labelFor(p)} group={p.isGroup ? infoMap.get(p.id) : undefined} dupName={dupNames.has(p.name.trim().toLowerCase())} hint={hintFor(p)} onClick={() => (p.isGroup ? open(p) : pick(p))} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  {shown.map((p) => (
                    <ProductCard key={p.id} item={p} label={labelFor(p)} group={p.isGroup ? infoMap.get(p.id) : undefined} dupName={dupNames.has(p.name.trim().toLowerCase())} hint={hintFor(p)} onClick={() => (p.isGroup ? open(p) : pick(p))} />
                  ))}
                </div>
              )
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white">Tutup</button>
        </div>
      </div>
    </div>
    {flexPick ? (
      <CatalogSetPriceDialog
        productId={flexPick.item.id}
        name={flexPick.name}
        baseDescription={flexPick.item.description}
        presets={flexPick.item.pricePresets ?? []}
        onClose={() => setFlexPick(null)}
        onConfirm={(price, note) => {
          /* Harga dinamis & catatan dibawa ke baris: fillRow memakai p.price sebagai harga baris. */
          onPick({ ...flexPick.item, name: flexPick.name, price, description: note ?? flexPick.item.description });
          onClose();
        }}
      />
    ) : null}
    </>
  );
}
