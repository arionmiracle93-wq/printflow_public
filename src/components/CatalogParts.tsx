"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Filter, ImageIcon, Layers, Plus, Search, Settings2 } from "lucide-react";
import { formatRupiah } from "@/lib/domain";
import { TabBar, type TabItem } from "@/components/TabBar";
import { fullName, groupLabel, indexById } from "@/lib/catalog-variants";
import { MIN_SEARCH_CHARS, matchesNormalizedSearch, normalizeSearchText } from "@/lib/product-search";
import type { CatalogItem } from "@/lib/invoice-catalog-match";

/** Ringkasan kartu induk: jumlah varian + harga dasar termurah ("mulai"). Lihat catalog-variants.ts. */
export type GroupSummary = { count: number; minPrice: number | null };

/**
 * Token pemenggal kartu teks: spasi memisah kata, dan tanda "/" "-" "–" "·" "," menjadi titik
 * putus TAMBAHAN setelah tandanya (mis. "rangkap/warna" bisa turun jadi "RANGKAP/" · "WARNA").
 * Dengan ini kata tidak pernah dipotong di tengah, dan teks aslinya tetap utuh (tandanya dibawa).
 */
function tileWords(t: string): string[] {
  return t
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((w) => (/[\/\-–·,]/.test(w) ? w.split(/(?<=[\/\-–·,])/) : [w]))
    .filter(Boolean);
}

/**
 * Pecah teks kartu per kata, maks `max` huruf per baris & maks 3 baris
 * (dengan penanda … bila sisa teks benar-benar tidak muat lagi).
 */
function tileLines(t: string, max: number): string[] {
  const out: string[] = [];
  for (const word of tileWords(t)) {
    if (out.length >= 3) break;
    // Kata tunggal yang panjang (tanpa spasi) dipotong per max huruf.
    if (word.length > max * 1.6) {
      for (let i = 0; i < word.length && out.length < 3; i += max) out.push(word.slice(i, i + max));
      continue;
    }
    const last = out[out.length - 1];
    if (!last || `${last} ${word}`.length > max) out.push(word);
    else out[out.length - 1] = `${last} ${word}`;
  }
  // Menandai teks yang benar-benar dijemput: jumlah huruf yang tertulis < jumlah huruf aslinya.
  if (out.length === 3 && out.join(" ").replace(/\s+/g, " ").length < t.replace(/\s+/g, " ").trim().length) {
    out[2] = `${out[2].slice(0, max - 1)}…`;
  }
  return out;
}

/** Padding kartu teks dalam unit viewBox (0 0 120 90): teks dijaga TIDAK PERNAH menyentuh tepi. */
const TILE_PAD_X = 14; // kiri + kanan
const TILE_PAD_Y = 9; // atas + bawah
const TILE_W = 120 - TILE_PAD_X * 2; // lebar terpakai untuk teks
const TILE_H = 90 - TILE_PAD_Y * 2; // tinggi terpakai untuk teks

/**
 * Ukuran huruf TERBESAR yang membuat SEMUA baris berhenti di dalam padding:
 *   - lebar: perkiraan huruf tebal kapital ≈ 0,64 × fontSize per karakter (0,64 = sudah ada rem aman)
 *   - tinggi: makin banyak baris, makin ketat (jarak baris 1,15 × fontSize)
 */
function tileFontSize(lines: string[]): number {
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 1);
  const byWidth = TILE_W / (0.64 * longest);
  const byHeight = TILE_H / (0.7 + 1.15 * (lines.length - 1));
  return Math.min(30, Math.max(10, Math.floor(Math.min(byWidth, byHeight))));
}

/**
 * Pilih pemenggalan baris dgn HURUF PALING BESAR: coba batas baris dari longgar (10 huruf) ke
 * rapat (4 huruf). Baris yang — pada ukuran huruf hasilnya — menyentuh padding otomatis dipecah
 * ke baris berikutnya, lalu ukuran huruf dihitung ulang di layout baru. Layout yang penuh
 * (tanpa memangkas …) dipilih hanya bila hurufnya lebih besar dari layout terbaik sebelumnya,
 * jadi teks pendek tampil tegap tanpa dipecah-pajang seadanya. Semua perhitungan murni aritmetika
 * (tanpa pengukuran layout browser) supaya tetap ringan.
 */
function tileLayout(text: string): { lines: string[]; fs: number } {
  const normalized = text.replace(/\s+/g, " ").trim();
  let best: { lines: string[]; fs: number } | null = null;
  let fallback: string[] = [];
  for (let max = 10; max >= 4; max -= 1) {
    const lines = tileLines(text, max);
    const fit = lines.join(" ").replace(/\s+/g, " ").trim().length >= normalized.length;
    if (fit) {
      const fs = tileFontSize(lines);
      // Pinggiran: ukuran huruf sama = pilih baris paling sepede, biar terlihat lumrah (tidak split di tengah kata).
      if (!best || fs > best.fs || (fs === best.fs && lines.length < best.lines.length)) best = { lines, fs };
    } else if (!fallback.length) {
      fallback = lines; // cadangan bila tak satu pun batas baris membuat teks penuh muat
    }
  }
  if (best) return best;
  const lines = fallback.length ? fallback : tileLines(text, 10);
  return { lines, fs: tileFontSize(lines) };
}

/**
 * KARTU TEKS PENGGANTI GAMBAR — ringan dan hemat performa: SVG murni inline (tanpa file, tanpa
 * permintaan jaringan, tanpa pengukuran layout).
 *
 * KUNCI PENYESUAIAN RUANG: mode "meet" (bukan "slice") membuat teks TIDAK PERNAH terpotong di
 * kartu dengan rasio apa pun — bila kartu lebih sempit dari 4:3, skala SVG otomatis turun sampai
 * teks muat seluruhnya. Lalu supaya area kartu tetap terisi warna sampai tepi (walau viewBox 4:3
 * berada di tengah), latar diberi jauh melewati bingkai dan bagian luarnya terpangkas di tepi
 * kartu oleh viewport. Semua konstanta dalam satuannya viewBox (0 0 120 90) jadi ikut skala kartu,
 * termasuk padding: di kartu kecil padding tetap proporsional terhadap lebar kartu.
 */
export function TextTile({ text, className = "" }: { text: string; className?: string }) {
  const { lines, fs } = tileLayout(text);
  const gap = fs * 1.15;
  // Garis dasar baris pertama supaya blok teks tampak di tengah (x tengah = 60, tinggi kartu = 90).
  const startY = 45 - ((lines.length - 1) * gap) / 2 + fs * 0.28;
  return (
    <svg viewBox="0 0 120 90" preserveAspectRatio="xMidYMid meet" className={className} role="img" aria-label={text}>
      {/* Latar dibesarkan jauh melewati bingkai viewBox (±1200 unit) supaya kartu rasio apa pun tetap tertutup warna penuh.
          Light mode sengaja sedikit lebih gelap dari kartu aplikasi biar ada perbedaan jelas; dark mode tidak diubah. */}
      <rect x="-1140" y="-1155" width="2400" height="2400" className="fill-slate-300 dark:fill-slate-700" />
      <text
        x="60"
        y={startY}
        textAnchor="middle"
        fontSize={fs}
        fontWeight={800}
        className="fill-slate-800 select-none dark:fill-slate-200"
        style={{ textTransform: "uppercase" }}
      >
        {lines.map((line, i) => (
          <tspan key={i} x="60" dy={i === 0 ? 0 : gap}>
            {line}
          </tspan>
        ))}
      </text>
    </svg>
  );
}

/** Gambar produk; tanpa gambar atau gagal dimuat = kartu teks (bila ada teks pengganti), kalau tidak kotak aksen berikon. */
export function ProductImage({ item, className = "" }: { item: Pick<CatalogItem, "id" | "name" | "imageV"> & { imageId?: number; displayText?: string | null }; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!item.imageV || failed) {
    const tile = item.displayText?.trim();
    if (tile) return <TextTile text={tile} className={className} />;
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 text-teal-500/70 dark:from-teal-500/15 dark:to-cyan-400/10 dark:text-teal-300/70 ${className}`}>
        <ImageIcon size={30} strokeWidth={1.6} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/invoice-products/${item.imageId ?? item.id}/image?v=${item.imageV}`} alt={item.name} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />
  );
}

/** Lencana harga bertingkat: "3 tier", "⋮" progresif, "m²". */
export function tierLabel(item: Pick<CatalogItem, "tiers">): string {
  const t = item.tiers;
  if (!t || !t.list.length) return "";
  return `${t.list.length} tier${t.mode === "graduated" ? " ⋮" : ""}${t.basis === "m2" ? " m²" : ""}`;
}

/** Nama produk yang dipakai lebih dari satu produk (keterangannya beda). Huruf besar/kecil diabaikan. */
export function duplicateNames(items: CatalogItem[]): Set<string> {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const p of items) {
    const k = p.name.trim().toLowerCase();
    if (seen.has(k)) dup.add(k);
    else seen.add(k);
  }
  return dup;
}

/**
 * Lencana produk HARGA FLEKSIBEL: tidak ada harga baku — operator menetapkan harga di dialog
 * "Set Harga" saat produk ditambahkan ke invoice (preset owner + riwayat harga jadi acuan).
 */
export function FlexPriceBadge({ tiny }: { tiny?: boolean }) {
  return (
    <span
      title="Harga fleksibel: harga ditetapkan saat penjualan (bukan harga baku katalog)"
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-indigo-50 px-1.5 py-0.5 font-bold text-indigo-700 ${
        tiny ? "text-[8.5px]" : "text-[9px] sm:text-[10px]"
      } dark:bg-indigo-500/15 dark:text-indigo-300`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" aria-hidden />
      Fleksibel
    </span>
  );
}

/**
 * Tombol "+ Varian" di baris induk pada tampilan RINGKAS (Kelola Katalog). Tombol di dalam tombol tidak sah di HTML,
 * jadi tombol ini saudara dari barisnya: GroupShell membungkus keduanya. Tampilan Kartu dan Padat sengaja polos
 * seperti sebelum fitur varian; tombol "+ Varian" untuk induk ada di bagian atas daftar variannya.
 */
function GroupShell({ onAddVariant, children }: { onAddVariant?: () => void; children: React.ReactNode }) {
  if (!onAddVariant) return <>{children}</>;
  return (
    <div className="relative flex min-w-0 items-center gap-1.5">
      {children}
      <button
        type="button"
        onClick={onAddVariant}
        title="Tambah varian ke induk ini"
        aria-label="Tambah varian"
        className="z-10 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 font-bold text-white shadow ring-2 ring-white transition hover:bg-teal-700 dark:ring-[#10202c]"
      >
        <Plus size={12} strokeWidth={3} />
      </button>
    </div>
  );
}

/**
 * Keterangan pada kartu VARIAN selalu tampil (juga di HP) di bawah nama varian dengan warna aksen sendiri,
 * beda dari nama (gelap) dan harga (teal), supaya "Full color 1 sisi" / "Hitam putih" langsung terbaca.
 */
const VARIANT_DESC = "font-medium text-indigo-600 dark:text-indigo-300";

export function ProductCard({
  item,
  onClick,
  selected,
  selectable,
  hint,
  dupName,
  group,
  label,
}: {
  item: CatalogItem;
  onClick: () => void;
  selected?: boolean;
  selectable?: boolean;
  hint?: string;
  /** true bila ada produk lain bernama sama: keterangan wajib terlihat (juga di HP) supaya bisa dibedakan. */
  dupName?: boolean;
  /** Diisi untuk kartu INDUK: harga diganti label "N varian · mulai Rp X". */
  group?: GroupSummary;
  /** Nama yang ditampilkan (mis. nama lengkap varian "Print HVS A4 Warna" di hasil pencarian). Bawaan: item.name. */
  label?: string;
}) {
  const tl = group ? "" : tierLabel(item);
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 sm:rounded-2xl hover:shadow-md dark:bg-[#10202c] ${
        selected ? "border-teal-500 ring-2 ring-teal-400" : "border-slate-200 dark:border-slate-700"
      }`}
    >
      <div className="relative">
        <ProductImage item={item} className="aspect-[4/3] w-full" />
        {selectable ? (
          <span className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center sm:right-2 sm:top-2 sm:h-6 sm:w-6 justify-center rounded-full border-2 ${selected ? "border-teal-600 bg-teal-600 text-white" : "border-white bg-black/30 text-transparent"}`}>
            <Check size={14} strokeWidth={3} />
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2 sm:p-2.5">
        <p className="line-clamp-2 text-[11.5px] font-bold leading-snug sm:text-[13px] text-[color:var(--pf-ink)]">{label ?? item.name}</p>
        {item.description ? (
          <p className={`line-clamp-2 text-[11px] leading-snug ${!item.isGroup && item.parentId != null ? VARIANT_DESC : `text-slate-500 ${dupName ? "" : "max-sm:hidden"}`}`}>{item.description}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5 pt-1 sm:pt-1.5">
          {group ? (
            <span className="text-[10.5px] font-extrabold leading-tight text-teal-700 sm:text-[12px]">{groupLabel(group, formatRupiah)}</span>
          ) : item.pricingMode === "fleksibel" ? (
            <FlexPriceBadge />
          ) : (
            <span className="text-[11.5px] font-extrabold text-teal-700 sm:text-[13px]">{item.price ? formatRupiah(item.price) : "—"}</span>
          )}
          {tl ? <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold text-teal-700 sm:text-[10px]">{tl}</span> : null}
        </div>
      </div>
    </button>
  );
}

/** Baris ringkas satu produk (tampilan "Ringkas" di pop up katalog invoice): gambar kecil, nama, keterangan, harga. */
export function ProductCompactRow({
  item,
  onClick,
  hint,
  selectable,
  selected,
  group,
  label,
  onAddVariant,
}: {
  item: CatalogItem;
  onClick: () => void;
  hint?: string;
  selectable?: boolean;
  selected?: boolean;
  group?: GroupSummary;
  label?: string;
  onAddVariant?: () => void;
}) {
  const tl = group ? "" : tierLabel(item);
  return (
    <GroupShell onAddVariant={group ? onAddVariant : undefined}>
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={`group flex w-full min-w-0 flex-1 items-center gap-2 rounded-lg border bg-white p-1.5 text-left shadow-sm transition hover:border-teal-400 hover:shadow dark:bg-[#10202c] ${
        selected ? "border-teal-500 ring-2 ring-teal-400" : group ? "border-teal-300 dark:border-teal-500/50" : "border-slate-200 dark:border-slate-700"
      }`}
    >
      <span className="relative shrink-0">
        <ProductImage item={item} className="h-9 w-9 rounded-md [&_svg]:h-4 [&_svg]:w-4" />
        {group ? <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-700 text-white ring-2 ring-white dark:ring-[#10202c]"><Layers size={9} strokeWidth={2.6} /></span> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-bold leading-tight text-[color:var(--pf-ink)]">{label ?? item.name}</span>
        {item.description ? <span className="block truncate text-[10.5px] leading-tight text-slate-500">{item.description}</span> : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        {group ? (
          <span className="text-right text-[10.5px] font-extrabold leading-tight text-teal-700">{groupLabel(group, formatRupiah)}</span>
        ) : item.pricingMode === "fleksibel" ? (
          <FlexPriceBadge />
        ) : (
          <span className="text-[12px] font-extrabold text-teal-700">{item.price ? formatRupiah(item.price) : "—"}</span>
        )}
        {tl ? <span className="rounded-full bg-teal-50 px-1.5 text-[9px] font-bold text-teal-700">{tl}</span> : null}
      </span>
      {selectable ? (
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white text-transparent dark:border-slate-600 dark:bg-slate-800"
          }`}
        >
          <Check size={12} strokeWidth={3} />
        </span>
      ) : null}
    </button>
    </GroupShell>
  );
}

/** Kartu kecil (tampilan "Padat" di pop up katalog invoice): gambar mini, nama, harga. */
export function ProductMiniCard({
  item,
  onClick,
  hint,
  dupName,
  selectable,
  selected,
  group,
  label,
}: {
  item: CatalogItem;
  onClick: () => void;
  hint?: string;
  /** true bila ada produk lain bernama sama: keterangan tetap terlihat supaya bisa dibedakan. */
  dupName?: boolean;
  selectable?: boolean;
  selected?: boolean;
  group?: GroupSummary;
  label?: string;
}) {
  const tl = group ? "" : tierLabel(item);
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={`group flex min-w-0 flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow dark:bg-[#10202c] ${
        selected ? "border-teal-500 ring-2 ring-teal-400" : "border-slate-200 dark:border-slate-700"
      }`}
    >
      <span className="relative block">
        <ProductImage item={item} className="aspect-square w-full" />
        {selectable ? (
          <span
            className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 ${
              selected ? "border-teal-600 bg-teal-600 text-white" : "border-white bg-black/30 text-transparent"
            }`}
          >
            <Check size={12} strokeWidth={3} />
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 p-1.5">
        <span className="line-clamp-2 text-[11px] font-bold leading-tight text-[color:var(--pf-ink)]">{label ?? item.name}</span>
        {item.description && (dupName || item.parentId != null) ? (
          <span className={`${item.parentId != null ? "line-clamp-2" : "line-clamp-1"} text-[9.5px] leading-tight ${!item.isGroup && item.parentId != null ? VARIANT_DESC : "text-slate-500"}`}>{item.description}</span>
        ) : null}
        <span className="mt-auto flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5 pt-0.5">
          {group ? (
            <span className="text-[9.5px] font-extrabold leading-tight text-teal-700">{groupLabel(group, formatRupiah)}</span>
          ) : item.pricingMode === "fleksibel" ? (
            <FlexPriceBadge tiny />
          ) : (
            <span className="text-[11px] font-extrabold text-teal-700">{item.price ? formatRupiah(item.price) : "—"}</span>
          )}
          {tl ? <span className="rounded-full bg-teal-50 px-1 py-0.5 text-[8.5px] font-bold text-teal-700">{tl}</span> : null}
        </span>
      </span>
    </button>
  );
}

/**
 * Baris kategori (nilai, label, jumlah produk) yang dipakai tab maupun sidebar.
 * Yang dihitung hanya item tingkat atas (produk biasa + kartu induk): varian ikut kategori induknya
 * dan tampil di dalam kartu induk, jadi satu induk dihitung satu kartu.
 */
function categoryRows(categories: string[], items: CatalogItem[]) {
  const top = items.filter((p) => p.parentId == null);
  const counts = new Map<string, number>();
  let noCat = 0;
  for (const p of top) {
    if (!p.category) noCat++;
    else counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  }
  return [
    { value: "__all", label: "Semua", count: top.length },
    ...(noCat ? [{ value: "__none", label: "Tanpa Kategori", count: noCat }] : []),
    ...categories.map((c) => ({ value: c, label: c, count: counts.get(c) ?? 0 })),
  ];
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
  // Tab kategori: satu kategori aktif pada satu waktu, jadi bentuknya
  // segmented (berdempetan, garis bawah di tab aktif) - sama dengan tab
  // Pengaturan Invoice. Jumlah produk per kategori ikut ditampilkan.
  // fill=false karena kategorinya bisa banyak; kalau kelebihan ruang,
  // .pf-tabbar menampilkan bilah gulir yang jelas, bukan guntingan tepi.
  const tabs: TabItem<string>[] = categoryRows(categories, items).map((r) => ({ value: r.value, label: r.label, meta: r.count }));
  return (
    <div className="flex flex-col gap-2">
      <TabBar fill={false} items={tabs} value={value} onChange={onChange} ariaLabel="Filter kategori produk" />
      {extra ? <div className="flex flex-wrap items-center gap-2">{extra}</div> : null}
    </div>
  );
}

/**
 * Filter kategori berbentuk dropdown untuk halaman Katalog (layar lebar).
 * Menggantikan deretan tab mendatar: satu tombol di samping kolom cari,
 * panel berisi daftar kategori + jumlah, bisa dicari, dan tombol kelola.
 */
export function CategoryDropdown({
  categories,
  items,
  value,
  onChange,
  onManage,
  className = "",
}: {
  categories: string[];
  items: CatalogItem[];
  value: string;
  onChange: (v: string) => void;
  onManage?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [align, setAlign] = useState<"left" | "right">("left");
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const rows = categoryRows(categories, items);
  const active = rows.find((r) => r.value === value) ?? rows[0];
  const filtered = value !== "__all";
  const activeLabel = active.value === "__all" ? "Semua Kategori" : active.label;

  /* Fokus ke kotak cari begitu panel terbuka. */
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  /* Tutup panel saat klik di luar atau menekan Escape. */
  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setQuery("");
    };
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      btnRef.current?.focus();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  /* Panel selebar 320px, tombol hanya 214px. Kalau tombol ada di kiri
     layar, panel dibuka ke kanan; kalau di kanan, panel dibuka ke kiri
     supaya tidak keluar dari layar. */
  const openPanel = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    setAlign(rect && rect.left < 340 ? "left" : "right");
    setOpen(true);
  };

  const choose = (v: string) => {
    onChange(v);
    close();
    btnRef.current?.focus();
  };

  const normalized = normalizeSearchText(query);
  const visible = normalized ? rows.filter((r) => normalizeSearchText(r.label).includes(normalized)) : rows;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="katalog-filter-kategori"
        onClick={() => (open ? close() : openPanel())}
        title="Filter kategori produk"
        className={`flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 text-left text-sm shadow-sm transition dark:bg-[#0c1c27] ${
          filtered
            ? "border-teal-400 text-teal-800 dark:border-teal-500/60 dark:text-teal-200"
            : "border-slate-200 text-slate-700 hover:border-teal-300 dark:border-slate-700 dark:text-slate-200"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Filter size={15} className={filtered ? "text-teal-600 dark:text-teal-300" : "text-slate-400"} />
          <span className="truncate font-semibold">{activeLabel}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              filtered
                ? "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            {active.count}
          </span>
          <ChevronDown size={15} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open ? (
        <div
          id="katalog-filter-kategori"
          role="dialog"
          aria-label="Filter kategori"
          className={`absolute z-40 mt-2 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#10202c] ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          <div className="border-b border-slate-100 p-2 dark:border-slate-700/70">
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari kategori"
                className="input min-h-9 w-full py-1.5 pl-8 text-xs"
              />
            </label>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {visible.length ? (
              visible.map((r) => {
                const aktif = r.value === value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => choose(r.value)}
                    aria-pressed={aktif}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition ${
                      aktif
                        ? "bg-teal-50 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{r.label}</span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        aktif
                          ? "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {r.count}
                    </span>
                    {aktif ? (
                      <Check size={14} strokeWidth={3} className="shrink-0 text-teal-600 dark:text-teal-300" />
                    ) : (
                      <span className="w-3.5 shrink-0" aria-hidden />
                    )}
                  </button>
                );
              })
            ) : (
              <p className="px-2.5 py-3 text-xs text-slate-500">Kategori tidak ditemukan.</p>
            )}
          </div>
          {onManage ? (
            <div className="border-t border-slate-100 p-1.5 dark:border-slate-700/70">
              <button
                type="button"
                onClick={() => {
                  close();
                  onManage();
                }}
                className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold text-teal-700 transition hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-500/10"
              >
                <Settings2 size={13} />
                Kelola kategori
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Sidebar kategori untuk pop up Katalog di editor invoice (layar lebar).
 * Satu kategori aktif pada satu waktu; jumlah produk per kategori ikut
 * ditampilkan supaya isi katalog tetap terbaca tanpa membukanya.
 */
export function CategorySidebar({
  categories,
  items,
  value,
  onChange,
}: {
  categories: string[];
  items: CatalogItem[];
  value: string;
  onChange: (v: string) => void;
}) {
  const rows = categoryRows(categories, items);
  return (
    <nav
      aria-label="Filter kategori produk"
      className="flex h-full min-h-0 w-full flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-1.5 dark:border-slate-700 dark:bg-slate-800/30"
    >
      <p className="px-2 pb-1.5 pt-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">Kategori</p>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5">
        {rows.map((r) => {
          const aktif = r.value === value;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => onChange(r.value)}
              aria-pressed={aktif}
              title={r.label}
              className={`flex w-full items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-left text-[12px] font-semibold transition ${
                aktif
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/60 dark:hover:text-white"
              }`}
            >
              <span className="min-w-0 truncate">{r.label}</span>
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  aktif ? "bg-white/20 text-white" : "bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {r.count}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Saring produk menurut pencarian + kategori.
 *  - Tanpa pencarian: hanya item TINGKAT ATAS (produk biasa + kartu induk utama); sub-induk dan varian
 *    tampil setelah kartu induk dibuka. Di picker invoice, induk tanpa isi disembunyikan karena tidak bisa dipilih.
 *  - Dengan pencarian: varian dicari lewat NAMA LENGKAP-nya (seluruh rantai induk + nama varian), jadi
 *    "hvs warna" langsung menemukan "A4 Warna" di bawah "Print HVS", dan "nota ncr a5" menemukan varian
 *    di dalam sub-induk. Induk yang cocok menyembunyikan keturunannya (buka kartunya untuk melihat).
 *      picker  : kartu induk disembunyikan, hasilnya varian + produk biasa (datar), semuanya bisa langsung dipilih.
 *      kelola  : induk yang cocok tampil; varian dari induk yang tidak cocok tampil datar dengan nama lengkap.
 */
export function filterProducts(items: CatalogItem[], q: string, cat: string, opts: { picker?: boolean } = {}): CatalogItem[] {
  const query = q.trim();
  const inCat = (p: CatalogItem) => (cat === "__none" ? !p.category : cat === "__all" || (p.category || "") === cat);
  const searching = normalizeSearchText(query).length >= MIN_SEARCH_CHARS;
  const byId = indexById(items);

  if (!searching) {
    /* Tandai semua induk yang punya varian (daun) di keturunannya, bukan hanya yang punya anak langsung.
       Induk tanpa varian sama sekali disembunyikan dari picker karena tidak ada yang bisa dipilih. */
    const withKids = new Set<number>();
    for (const p of items) {
      if (p.isGroup) continue;
      let parentId = p.parentId;
      const seen = new Set<number>();
      while (parentId != null && !seen.has(parentId)) {
        seen.add(parentId);
        withKids.add(parentId);
        parentId = byId.get(parentId)?.parentId ?? null;
      }
    }
    return items.filter((p) => p.parentId == null && inCat(p) && (!opts.picker || !p.isGroup || withKids.has(p.id)));
  }

  const matched = items.filter((p) => inCat(p) && matchesNormalizedSearch(productHaystack(p, byId), query));
  if (opts.picker) return matched.filter((p) => !p.isGroup);
  const matchedGroups = new Set(matched.filter((p) => p.isGroup).map((p) => p.id));
  const insideMatchedGroup = (p: CatalogItem) => {
    let parentId = p.parentId;
    const seen = new Set<number>();
    while (parentId != null && !seen.has(parentId)) {
      if (matchedGroups.has(parentId)) return true;
      seen.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return false;
  };
  return matched.filter((p) => !insideMatchedGroup(p));
}

/* Teks pencarian produk dinormalisasi sekali lalu di-cache per objek produk.
   Objeknya stabil selama daftar tidak dimuat ulang, jadi pengetikan tidak
   menormalisasi ulang ratusan nama pada setiap huruf. Varian ikut membawa nama induknya. */
const haystackCache = new WeakMap<CatalogItem, string>();

function productHaystack(p: CatalogItem, byId: Map<number, CatalogItem>): string {
  const cached = haystackCache.get(p);
  if (cached !== undefined) return cached;
  /* fullName() membaca seluruh rantai induk, jadi sub-induk dan varian ikut membawa konteks NOTA. */
  const text = normalizeSearchText(`${fullName(p, byId)} ${p.description ?? ""} ${p.category ?? ""}`);
  haystackCache.set(p, text);
  return text;
}
