"use client";

import { useMemo, useRef, useState } from "react";
import {
  CheckSquare,
  Download,
  FileUp,
  FolderPlus,
  ImagePlus,
  Loader2,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { CategoryChips, ProductCard, ProductImage, filterProducts } from "@/components/CatalogParts";
import { buildCsv, catalogFromCsv } from "@/lib/csv-parse";
import { compressImage } from "@/lib/image-compress";
import { SAMPLE_CATALOG } from "@/lib/invoice-catalog-sample";
import type { CatalogItem } from "@/lib/invoice-catalog-match";
import { parseTierText, tiersToText } from "@/lib/invoice-pricing";

/**
 * GALERI & PENGELOLA KATALOG PRODUK (menggantikan galeri + tab Katalog app lama)
 * Semua akun berizin Invoice bisa MELIHAT; menambah/mengubah/menghapus/impor hanya Owner.
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
  hadImage: boolean;
  imageV: number;
};

/** Alamat unduhan CSV (bukan halaman, jadi memakai <a> biasa). */
const EXPORT_URL = "/api/invoice-products/export";

const blank: Draft = { id: null, name: "", description: "", price: "", tiers: "", category: "", image: undefined, hadImage: false, imageV: 0 };

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
  return (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; penjelasan?: string; data?: unknown; deleted?: number; added?: number; updated?: number; total?: number; categories?: string[] };
}

export function CatalogManager({
  initialProducts,
  initialCategories,
  isOwner,
}: {
  initialProducts: CatalogItem[];
  initialCategories: string[];
  isOwner: boolean;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState(initialCategories);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("__all");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showCats, setShowCats] = useState(false);
  const [catsText, setCatsText] = useState("");
  const [importing, setImporting] = useState<{ items: ReturnType<typeof catalogFromCsv> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => filterProducts(products, q, cat), [products, q, cat]);

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
      hadImage: item.imageV > 0,
      imageV: item.imageV,
    });
  }

  async function save() {
    if (!draft) return;
    setFormError(null);
    if (!draft.name.trim()) return setFormError("Nama produk belum diisi.");
    const ts = tierStatus(draft.tiers);
    if (!ts.ok) return setFormError(ts.label);
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        name: draft.name,
        description: draft.description,
        price: draft.price.replace(/\D/g, ""),
        tiers: draft.tiers.trim() || null,
        category: draft.category,
      };
      if (draft.image !== undefined) body.image = draft.image;
      const j = draft.id ? await api(`/api/invoice-products/${draft.id}`, "PUT", body) : await api("/api/invoice-products", "POST", body);
      if (!j.ok) return setFormError(j.error ?? j.penjelasan ?? "Gagal menyimpan produk.");
      const hasImg = draft.image ? true : draft.image === null ? false : draft.hadImage;
      setDraft(null);
      await reload();
      flash(`${draft.id ? "Produk diperbarui" : "Produk ditambahkan"} · ${hasImg ? "dengan gambar" : "tanpa gambar"}`);
    } finally {
      setBusy(false);
    }
  }

  async function removeOne() {
    if (!draft?.id) return;
    if (!confirm(`Hapus "${draft.name}" dari katalog?`)) return;
    setBusy(true);
    try {
      const j = await api(`/api/invoice-products/${draft.id}`, "DELETE");
      if (!j.ok) return setFormError(j.error ?? "Gagal menghapus produk.");
      setDraft(null);
      await reload();
      flash("Produk dihapus.");
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

  async function deleteSelected() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!confirm(`HAPUS ${ids.length} PRODUK DARI KATALOG?\n\nTindakan ini tidak bisa dibatalkan. Invoice lama tidak terpengaruh.`)) return;
    setBusy(true);
    try {
      const j = await api("/api/invoice-products/bulk-delete", "POST", { ids });
      if (!j.ok) return setError(j.error ?? "Gagal menghapus.");
      setSelected(new Set());
      await reload();
      flash(`${j.deleted ?? ids.length} produk dihapus.`);
    } finally {
      setBusy(false);
    }
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
      flash(mode === "replace" ? `${j.total} produk menggantikan katalog.` : `Impor selesai: ${j.added} ditambah, ${j.updated} dilengkapi.`);
    } finally {
      setBusy(false);
    }
  }

  async function loadSample() {
    if (!confirm(`Muat ${SAMPLE_CATALOG.length} produk contoh percetakan?\n\nProduk yang namanya sama tidak ditimpa; hanya isian yang kosong dilengkapi.`)) return;
    setBusy(true);
    try {
      const j = await api("/api/invoice-products/import", "POST", { sample: true });
      if (!j.ok) return setError(j.error ?? "Gagal memuat contoh.");
      await reload();
      flash(`${j.added} produk contoh ditambahkan.`);
    } finally {
      setBusy(false);
    }
  }

  function downloadSampleCsv() {
    const rows = [["Nama Produk", "Keterangan", "Harga", "Harga Bertingkat", "Kategori"], ...SAMPLE_CATALOG.map((s) => [s.name, s.description, s.price, s.tiers, s.category])];
    const url = URL.createObjectURL(new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "contoh_katalog_harga_bertingkat.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const onCardClick = (item: CatalogItem) => {
    if (!isOwner) return;
    if (selectMode) {
      setSelected((s) => {
        const n = new Set(s);
        if (n.has(item.id)) n.delete(item.id);
        else n.add(item.id);
        return n;
      });
    } else openEdit(item);
  };

  const allShownSelected = shown.length > 0 && shown.every((p) => selected.has(p.id));
  const draftTier = draft ? tierStatus(draft.tiers) : null;

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
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { setFormError(null); setDraft({ ...blank, category: cat !== "__all" && cat !== "__none" ? cat : "" }); }} className="btn-primary">
              <Plus size={15} /> Produk Baru
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="flex items-start justify-between gap-2 break-words rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Tutup"><X size={14} /></button></p> : null}
      {notice ? <p className="flex items-start justify-between gap-2 break-words rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Tutup"><X size={14} /></button></p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-[2_1_220px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, keterangan, atau kategori" className="input w-full pl-9" />
        </label>
        {isOwner ? (
          <>
            <button type="button" onClick={() => { setSelectMode((v) => !v); setSelected(new Set()); }} className={`btn-secondary px-3 py-2 text-xs ${selectMode ? "!border-teal-500 !bg-teal-50 !text-teal-700" : ""}`} title="Mode Pilih: klik kartu untuk memilih banyak produk">
              <CheckSquare size={14} /> {selectMode ? "Selesai memilih" : "Pilih"}
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn-secondary px-3 py-2 text-xs"><FileUp size={14} /> Impor CSV</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { void onCsvFile(e.target.files?.[0]); e.target.value = ""; }} />
          </>
        ) : null}
        <a href={EXPORT_URL} className="btn-ghost px-3 py-2 text-xs"><Download size={14} /> Export CSV</a>
        {isOwner ? (
          <>
            <button type="button" onClick={downloadSampleCsv} className="btn-ghost px-3 py-2 text-xs">Contoh CSV</button>
            <button type="button" onClick={() => void loadSample()} disabled={busy} className="btn-ghost px-3 py-2 text-xs"><Sparkles size={14} /> Muat produk contoh</button>
          </>
        ) : null}
      </div>

      <CategoryChips
        categories={categories}
        items={products}
        value={cat}
        onChange={setCat}
        extra={isOwner ? (
          <button type="button" onClick={() => { setCatsText(categories.join("\n")); setShowCats(true); }} className="chip shrink-0 border-dashed border-teal-400 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700">
            <FolderPlus size={12} /> Kategori
          </button>
        ) : null}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{shown.length} dari {products.length} produk</span>
        {selectMode ? (
          <span className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
              <input type="checkbox" checked={allShownSelected} onChange={(e) => setSelected(e.target.checked ? new Set([...selected, ...shown.map((p) => p.id)]) : new Set([...selected].filter((id) => !shown.some((p) => p.id === id))))} className="h-4 w-4 accent-teal-600" />
              Pilih semua yang tampil
            </label>
            <b className="text-[color:var(--pf-ink)]">{selected.size} dipilih</b>
            <button type="button" onClick={() => void deleteSelected()} disabled={!selected.size || busy} className="btn-danger px-3 py-1.5 text-xs"><Trash2 size={13} /> Hapus terpilih</button>
          </span>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-8 text-center">
          <Package size={30} className="text-teal-500/70" />
          <p className="text-sm font-bold text-[color:var(--pf-ink)]">{products.length ? "Tidak ada produk yang cocok." : "Katalog masih kosong."}</p>
          <p className="text-xs text-slate-500">{products.length ? "Coba ganti kata pencarian atau kategori." : isOwner ? "Klik Produk Baru, impor CSV, atau muat produk contoh untuk memulai." : "Minta Owner mengisi katalog produk."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((p) => (
            <ProductCard key={p.id} item={p} onClick={() => onCardClick(p)} selectable={selectMode} selected={selected.has(p.id)} hint={isOwner ? (selectMode ? "Klik untuk memilih" : "Klik untuk mengubah produk") : undefined} />
          ))}
        </div>
      )}

      {/* ===== Formulir produk ===== */}
      {draft ? (
        <div className="ppi-modal-back" onClick={() => !busy && setDraft(null)} role="dialog" aria-modal="true" aria-label="Formulir produk">
          <div className="ppi-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className="text-sm font-extrabold">{draft.id ? "Ubah Produk" : "Produk Baru"}</p>
              <button type="button" onClick={() => setDraft(null)} className="ppi-icon-btn" aria-label="Tutup"><X size={14} /></button>
            </div>
            <div className="mb-3 flex items-center gap-3">
              {draft.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.image} alt="Gambar produk" className="h-20 w-24 rounded-xl border border-slate-200 object-cover" />
              ) : draft.image === undefined && draft.hadImage && draft.id ? (
                <ProductImage item={{ id: draft.id, name: draft.name, imageV: draft.imageV }} className="h-20 w-24 rounded-xl border border-slate-200" />
              ) : (
                <div className="flex h-20 w-24 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400"><ImagePlus size={22} /></div>
              )}
              <div className="flex flex-col gap-1.5">
                <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { void pickImage(e.target.files?.[0]); e.target.value = ""; }} />
                <button type="button" onClick={() => imgRef.current?.click()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700">
                  {draft.image || (draft.hadImage && draft.image === undefined) ? "Ganti gambar" : "Pilih gambar"}
                </button>
                {draft.image || (draft.hadImage && draft.image === undefined) ? (
                  <button type="button" onClick={() => setDraft((d) => (d ? { ...d, image: null, hadImage: false } : d))} className="text-left text-[11px] font-bold text-rose-600">Hapus gambar</button>
                ) : null}
                <span className="text-[10.5px] text-slate-400">Dikecilkan otomatis (maks 400px).</span>
              </div>
            </div>
            <label className="block"><span className="ppi-label">Nama produk *</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="ppi-in boxed" placeholder="mis. Banner Flexi China 280gr" autoFocus /></label>
            <label className="mt-2 block"><span className="ppi-label">Keterangan</span>
              <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="ppi-in boxed" placeholder="ukuran, finishing, dsb." /></label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block"><span className="ppi-label">Harga dasar (Rp)</span>
                <input value={draft.price} onChange={(e) => setDraft({ ...draft, price: thousands(e.target.value) })} inputMode="numeric" className="ppi-in boxed ppi-num" placeholder="0" /></label>
              <label className="block"><span className="ppi-label">Kategori</span>
                <input list="cat-list" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="ppi-in boxed" placeholder="Tanpa kategori" />
                <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist></label>
            </div>
            <label className="mt-2 block"><span className="ppi-label">Harga bertingkat (opsional)</span>
              <input value={draft.tiers} onChange={(e) => setDraft({ ...draft, tiers: e.target.value })} className="ppi-in boxed font-mono text-xs" placeholder="2=8000;11=7000  atau  mode=progresif;basis=m2;5=23000" /></label>
            {draftTier ? <p className={`mt-1 text-[11px] font-semibold ${draftTier.ok ? "text-teal-700" : "text-rose-600"}`}>{draftTier.label}</p> : null}
            {formError ? <p className="mt-2 break-words rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700">{formError}</p> : null}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              {draft.id ? <button type="button" onClick={() => void removeOne()} disabled={busy} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600"><Trash2 size={13} /> Hapus</button> : <span />}
              <span className="flex gap-2">
                <button type="button" onClick={() => setDraft(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600">Batal</button>
                <button type="button" onClick={() => void save()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
                  {busy ? <Loader2 size={13} className="animate-spin" /> : null} Simpan
                </button>
              </span>
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
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => void doImport(importing.items, "merge")} className="rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white">Gabungkan dengan katalog</button>
              <button type="button" onClick={() => { if (confirm(`Ganti SELURUH katalog (${products.length} produk) dengan ${importing.items.length} produk dari CSV?\n\nGambar produk lama ikut hilang.`)) void doImport(importing.items, "replace"); }} className="rounded-xl border border-rose-300 px-4 py-2.5 text-xs font-bold text-rose-600">Ganti seluruh katalog</button>
              <button type="button" onClick={() => setImporting(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-600">Batal</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
