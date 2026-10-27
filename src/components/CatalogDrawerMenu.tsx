"use client";

import { useState } from "react";
import { Check, ChevronDown, Download, FileUp, FolderPlus, Settings2, Sparkles } from "lucide-react";

/**
 * MENU TIGA GARIS KHUSUS HALAMAN KATALOG (mobile/tablet)
 * ===================================================================
 * Tombol impor/contoh dan filter kategori dulu memenuhi badan halaman.
 * Di layar kecil sekarang semuanya pindah ke drawer bottom navigation,
 * jadi daftar produk langsung terlihat tanpa harus menggulir melewati
 * deretan tombol.
 *
 * Urutan isi: Kategori (paling atas), Mode Cepat (Owner), Import CSV,
 * Contoh CSV, lalu Export CSV.
 *
 * Kategori memakai pola dropdown: satu baris "Kategori" dengan panah,
 * lalu daftar kategori yang sudah dibuat muncul di bawahnya. Memilih
 * kategori langsung menyaring katalog dan menutup drawer.
 *
 * Di desktop komponen ini tidak tampil (lg:hidden). Toolbar dan chip
 * kategori lama tetap dipakai di sana karena layar lebar punya ruang.
 */

const EXPORT_URL = "/api/invoice-products/export";

type Props = {
  categories: string[];
  active: string;
  counts: Record<string, number>;
  isOwner: boolean;
  onSelect: (value: string) => void;
  onImport: () => void;
  onDownloadSample: () => void;
  onManageCategories: () => void;
  onQuickCreate: () => void;
};

export function CatalogDrawerMenu({
  categories,
  active,
  counts,
  isOwner,
  onSelect,
  onImport,
  onDownloadSample,
  onManageCategories,
  onQuickCreate,
}: Props) {
  const [terbuka, setTerbuka] = useState(false);
  const activeLabel = active === "__all" ? "Semua" : active === "__none" ? "Tanpa kategori" : active;

  return (
    <div className="space-y-0.5 lg:hidden">
      <div>
        <button
          type="button"
          aria-expanded={terbuka}
          aria-controls="katalog-menu-kategori"
          onClick={() => setTerbuka((value) => !value)}
          className={`ppi-side-btn ${terbuka ? "active" : ""}`}
        >
          <span className="ppi-ico"><FolderPlus size={15} /></span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate">Kategori</span>
            <span className="block truncate text-[10.5px] font-semibold text-[color:var(--ppi-muted)]">{activeLabel}</span>
          </span>
          <ChevronDown
            size={16}
            strokeWidth={2.4}
            className={`shrink-0 transition-transform ${terbuka ? "rotate-180" : ""}`}
          />
        </button>

        {terbuka ? (
          <div id="katalog-menu-kategori" className="mt-1 space-y-0.5 border-l border-[color:var(--ppi-panel-line)] pl-2">
            <CategoryOption
              value="__all"
              label="Semua"
              count={counts.__all ?? 0}
              active={active === "__all"}
              onSelect={onSelect}
            />
            {(counts.__none ?? 0) > 0 ? (
              <CategoryOption
                value="__none"
                label="Tanpa kategori"
                count={counts.__none ?? 0}
                active={active === "__none"}
                onSelect={onSelect}
              />
            ) : null}
            {categories.map((category) => (
              <CategoryOption
                key={category}
                value={category}
                label={category}
                count={counts[category] ?? 0}
                active={active === category}
                onSelect={onSelect}
              />
            ))}
            {isOwner ? (
              <button
                type="button"
                data-drawer-close
                onClick={onManageCategories}
                className="mt-1 flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-bold text-[color:var(--ppi-accent)] transition hover:bg-[color:var(--ppi-accent-tint)]"
              >
                <Settings2 size={13} />
                Kelola kategori
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isOwner ? (
        <>
          <button type="button" data-drawer-close onClick={onQuickCreate} className="ppi-side-btn">
            <span className="ppi-ico"><Sparkles size={15} /></span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate">Mode Cepat</span>
              <span className="block truncate text-[10.5px] font-semibold text-[color:var(--ppi-muted)]">Buat nota otomatis</span>
            </span>
          </button>
          <button type="button" data-drawer-close onClick={onImport} className="ppi-side-btn">
            <span className="ppi-ico"><FileUp size={15} /></span>
            <span className="min-w-0 truncate">Import CSV</span>
          </button>
          <button type="button" data-drawer-close onClick={onDownloadSample} className="ppi-side-btn">
            <span className="ppi-ico"><Download size={15} /></span>
            <span className="min-w-0 truncate">Contoh CSV</span>
          </button>
        </>
      ) : null}

      <a href={EXPORT_URL} className="ppi-side-btn">
        <span className="ppi-ico"><Download size={15} /></span>
        <span className="min-w-0 truncate">Export CSV</span>
      </a>
    </div>
  );
}

function CategoryOption({
  value,
  label,
  count,
  active,
  onSelect,
}: {
  value: string;
  label: string;
  count: number;
  active: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      data-drawer-close
      aria-pressed={active}
      onClick={() => onSelect(value)}
      className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition ${
        active
          ? "bg-[color:var(--ppi-accent-tint-strong)] text-[color:var(--ppi-accent)]"
          : "text-[color:var(--ppi-fg)] hover:bg-[color:var(--ppi-accent-tint)]"
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[10px] font-bold text-[color:var(--ppi-muted)]">{count}</span>
      {active ? <Check size={13} strokeWidth={3} className="shrink-0" /> : null}
    </button>
  );
}
