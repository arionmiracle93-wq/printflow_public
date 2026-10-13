"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Package, Search, X } from "lucide-react";
import { CategoryChips, ProductCard, filterProducts } from "@/components/CatalogParts";
import type { CatalogItem } from "@/lib/invoice-catalog-match";

/**
 * Galeri katalog sebagai PEMILIH di dalam editor invoice (tombol "Katalog").
 * Klik kartu = produk masuk ke tabel invoice; jendela tetap terbuka supaya bisa memilih beberapa produk.
 * Mengelola katalog ada di halaman Katalog (khusus Owner).
 */
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
  const [added, setAdded] = useState<string | null>(null);
  const shown = useMemo(() => filterProducts(items, q, cat), [items, q, cat]);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(null), 2200);
    return () => clearTimeout(t);
  }, [added]);

  return (
    <div className="ppi-modal-back" onClick={onClose} role="dialog" aria-modal="true" aria-label="Katalog produk">
      <div className="ppi-modal flex flex-col" style={{ maxWidth: 820, height: "min(88vh, 720px)" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-extrabold"><Package size={16} className="text-teal-600" /> Katalog Produk</p>
            <p className="text-[11px] text-slate-500">Klik produk untuk menambahkannya ke invoice.</p>
          </div>
          <button type="button" onClick={onClose} className="ppi-icon-btn" aria-label="Tutup"><X size={14} /></button>
        </div>
        <label className="relative mb-2 block">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk" className="ppi-in boxed !pl-9" autoFocus />
        </label>
        <CategoryChips categories={categories} items={items} value={cat} onChange={setCat} />
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Memuat katalog…</p>
          ) : error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>
          ) : shown.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              <p className="font-bold text-slate-700">{items.length ? "Tidak ada produk yang cocok." : "Katalog masih kosong."}</p>
              {!items.length && isOwner ? <Link href="/invoice/katalog" className="mt-1 inline-block font-bold text-teal-700 underline">Isi katalog di sini</Link> : null}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {shown.map((p) => (
                <ProductCard key={p.id} item={p} hint="Klik untuk menambahkan ke invoice" onClick={() => { onPick(p); setAdded(p.name); }} />
              ))}
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={`flex min-w-0 items-center gap-1.5 truncate text-[11.5px] font-semibold text-emerald-700 transition-opacity ${added ? "opacity-100" : "opacity-0"}`}>
            <Check size={13} /> <span className="truncate">{added ?? "—"} ditambahkan ke invoice</span>
          </span>
          <button type="button" onClick={onClose} className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white">Selesai</button>
        </div>
      </div>
    </div>
  );
}
