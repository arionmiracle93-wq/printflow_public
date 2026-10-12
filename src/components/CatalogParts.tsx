"use client";

import { useState } from "react";
import { Check, ImageIcon } from "lucide-react";
import { formatRupiah } from "@/lib/domain";
import type { CatalogItem } from "@/lib/invoice-catalog-match";

/** Gambar produk; tanpa gambar atau gagal dimuat = kotak aksen dengan ikon. */
export function ProductImage({ item, className = "" }: { item: Pick<CatalogItem, "id" | "name" | "imageV">; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!item.imageV || failed) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 text-teal-500/70 dark:from-teal-500/15 dark:to-cyan-400/10 dark:text-teal-300/70 ${className}`}>
        <ImageIcon size={30} strokeWidth={1.6} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/invoice-products/${item.id}/image?v=${item.imageV}`} alt={item.name} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />
  );
}

/** Lencana harga bertingkat: "3 tier", "⋮" progresif, "m²". */
export function tierLabel(item: Pick<CatalogItem, "tiers">): string {
  const t = item.tiers;
  if (!t || !t.list.length) return "";
  return `${t.list.length} tier${t.mode === "graduated" ? " ⋮" : ""}${t.basis === "m2" ? " m²" : ""}`;
}

export function ProductCard({
  item,
  onClick,
  selected,
  selectable,
  hint,
}: {
  item: CatalogItem;
  onClick: () => void;
  selected?: boolean;
  selectable?: boolean;
  hint?: string;
}) {
  const tl = tierLabel(item);
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#10202c] ${
        selected ? "border-teal-500 ring-2 ring-teal-400" : "border-slate-200 dark:border-slate-700"
      }`}
    >
      <div className="relative">
        <ProductImage item={item} className="aspect-[4/3] w-full" />
        {item.category ? (
          <span className="absolute left-2 top-2 max-w-[80%] truncate rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-teal-700 shadow-sm">{item.category}</span>
        ) : null}
        {selectable ? (
          <span className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 ${selected ? "border-teal-600 bg-teal-600 text-white" : "border-white bg-black/30 text-transparent"}`}>
            <Check size={14} strokeWidth={3} />
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        <p className="line-clamp-2 text-[13px] font-bold leading-snug text-[color:var(--pf-ink)]">{item.name}</p>
        {item.description ? <p className="line-clamp-2 text-[11px] leading-snug text-slate-500">{item.description}</p> : null}
        <div className="mt-auto flex items-center justify-between gap-1 pt-1.5">
          <span className="text-[13px] font-extrabold text-teal-700">{item.price ? formatRupiah(item.price) : "—"}</span>
          {tl ? <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-700">{tl}</span> : null}
        </div>
      </div>
    </button>
  );
}

/** Chip kategori dengan jumlah produk. */
export function CategoryChips({
  categories,
  items,
  value,
  onChange,
  extra,
}: {
  categories: string[];
  items: CatalogItem[];
  value: string;
  onChange: (v: string) => void;
  extra?: React.ReactNode;
}) {
  const count = (c: string) => (c === "__all" ? items.length : items.filter((p) => (p.category || "") === c).length);
  const noCat = items.filter((p) => !p.category).length;
  const chip = (key: string, label: string, n: number) => (
    <button
      key={key}
      type="button"
      onClick={() => onChange(key)}
      className={`chip shrink-0 px-3 py-1.5 text-xs font-semibold ${value === key ? "border-teal-500 bg-teal-500 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
    >
      {label} <span className={`ml-1 text-[10px] ${value === key ? "text-white/80" : "text-slate-400"}`}>{n}</span>
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chip("__all", "Semua", count("__all"))}
      {noCat ? chip("__none", "Tanpa Kategori", noCat) : null}
      {categories.map((c) => chip(c, c, count(c)))}
      {extra}
    </div>
  );
}

/** Saring produk menurut pencarian + kategori (sama dengan galeri app lama). */
export function filterProducts(items: CatalogItem[], q: string, cat: string): CatalogItem[] {
  const needle = q.trim().toLowerCase();
  return items.filter((p) => {
    if (cat === "__none") {
      if (p.category) return false;
    } else if (cat !== "__all" && (p.category || "") !== cat) return false;
    if (!needle) return true;
    return p.name.toLowerCase().includes(needle) || (p.description || "").toLowerCase().includes(needle) || (p.category || "").toLowerCase().includes(needle);
  });
}
