"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { PRODUCT_TYPES, UNITS, formatNumber } from "@/lib/domain";
import { MAX_ITEMS_PER_ORDER, type OrderItemInput } from "@/lib/order-items";

/**
 * Input teks + dropdown pilihan siap pakai.
 * ----------------------------------------------------------------
 * Sebelumnya field ini pakai `<input list="...">` (datalist bawaan
 * browser), lalu sempat diganti jadi dropdown kustom yang di-render
 * `position: absolute` di dalam kartu/tabel. Masalahnya: kartu & tabel
 * di halaman ini ada yang punya `overflow-hidden` (biar sudut rounded-nya
 * rapi), jadi dropdown yang nongol di bawah input ikut KEPOTONG oleh
 * kontainer itu — makanya kelihatan "ngumpet" begitu diklik. Beberapa
 * elemen lain (header, tab bar) juga pakai efek blur yang bisa bikin
 * browser (terutama Chrome Android) salah hitung posisi elemen fixed.
 *
 * Fix-nya: daftar pilihan di-render lewat React portal LANGSUNG ke
 * <body>, dengan posisi dihitung manual dari koordinat asli input-nya
 * (getBoundingClientRect). Jadi dropdown-nya selalu di lapisan paling
 * atas & tidak mungkin kepotong kontainer manapun.
 */
function QuickPick({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  function reposition() {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }

  function openList() {
    if (disabled) return;
    reposition();
    setOpen(true);
  }

  function toggleList() {
    if (disabled) return;
    if (!open) reposition();
    setOpen((o) => !o);
  }

  // Selama dropdown terbuka: klik/tap di luar (input maupun daftar) buat
  // menutup, dan posisi dihitung ulang kalau halaman di-scroll/resize
  // (mis. keyboard HP muncul) supaya dropdown tetap nempel di bawah input.
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onScrollOrResize() {
      reposition();
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={openList}
        disabled={disabled}
        placeholder={placeholder}
        className="input pr-9"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={toggleList}
        disabled={disabled}
        aria-label="Pilih dari daftar"
        className="absolute inset-y-0 right-1 flex w-8 items-center justify-center text-slate-400 transition hover:text-teal-600 disabled:opacity-40 dark:text-slate-500 dark:hover:text-teal-300"
      >
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && !disabled
        ? createPortal(
            <div
              ref={listRef}
              style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
              className="z-[200] max-h-52 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#101e29]"
            >
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition ${
                    opt === value
                      ? "bg-teal-50 text-teal-700 dark:bg-white/10 dark:text-teal-300"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/**
 * TABEL ITEM PEKERJAAN (bisa diedit)
 * ----------------------------------------------------------------
 * Satu pekerjaan = satu kartu, satu status, satu deadline — tapi isinya
 * boleh beberapa produk sekaligus. Komponen ini yang mengatur baris-barisnya.
 *
 * Dipakai di dua tempat dengan tampilan yang sama persis:
 *   1. Form "Pekerjaan Baru"   (belum ada di database)
 *   2. Halaman detail pekerjaan (mengubah isi pekerjaan yang sudah jalan)
 *
 * Komponen ini sengaja "bodoh": tidak menyimpan sendiri ke server, cuma
 * melaporkan perubahan ke induknya lewat `onChange`. Jadi induknya bebas
 * memilih mau ikut disimpan bersama data lain (form baru) atau disimpan
 * sendiri lewat tombol Simpan (halaman detail).
 *
 * Desktop tampil sebagai tabel; mobile tampil sebagai kartu bertumpuk supaya
 * tidak perlu scroll ke samping.
 */
export function OrderItemsEditor({
  items,
  onChange,
  disabled = false,
}: {
  items: OrderItemInput[];
  onChange: (items: OrderItemInput[]) => void;
  disabled?: boolean;
}) {
  const bisaTambah = items.length < MAX_ITEMS_PER_ORDER;

  function updateRow(index: number, patch: Partial<OrderItemInput>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addRow() {
    if (!bisaTambah) return;
    // Baris baru meniru satuan baris terakhir — kebanyakan order berisi
    // produk dengan satuan yang mirip, jadi ini menghemat satu klik.
    const last = items[items.length - 1];
    onChange([...items, { productType: PRODUCT_TYPES[0], quantity: 1, unit: last?.unit ?? UNITS[0] }]);
  }

  function removeRow(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {/* ——— MOBILE: kartu bertumpuk ——— */}
      <div className="space-y-2.5 md:hidden">
        {items.map((item, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.04]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                Produk {index + 1}
              </span>
              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={disabled || items.length <= 1}
                className="rounded-lg p-1.5 text-rose-600 transition hover:bg-rose-50 disabled:opacity-30 dark:hover:bg-rose-500/10"
                title={items.length <= 1 ? "Minimal harus ada satu produk" : "Hapus baris ini"}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="mt-2 space-y-2">
              <div>
                <label className="label">Jenis produk</label>
                <QuickPick
                  value={item.productType}
                  onChange={(v) => updateRow(index, { productType: v })}
                  options={PRODUCT_TYPES}
                  disabled={disabled}
                  placeholder="Contoh: Spanduk / Banner"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Jumlah</label>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateRow(index, { quantity: Math.max(1, Number.parseInt(e.target.value || "1", 10)) })
                    }
                    disabled={disabled}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Satuan</label>
                  <QuickPick
                    value={item.unit}
                    onChange={(v) => updateRow(index, { unit: v })}
                    options={UNITS}
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ——— DESKTOP: tabel ——— */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 md:block dark:border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-white/[0.04]">
            <tr>
              <th className="w-10 px-3 py-2">#</th>
              <th className="px-3 py-2">Jenis produk</th>
              <th className="w-28 px-3 py-2">Jumlah</th>
              <th className="w-32 px-3 py-2">Satuan</th>
              <th className="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {items.map((item, index) => (
              <tr key={index}>
                <td className="px-3 py-2 text-xs font-bold text-slate-400">{index + 1}</td>
                <td className="px-3 py-2">
                  <QuickPick
                    value={item.productType}
                    onChange={(v) => updateRow(index, { productType: v })}
                    options={PRODUCT_TYPES}
                    disabled={disabled}
                    placeholder="Contoh: Spanduk / Banner"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateRow(index, { quantity: Math.max(1, Number.parseInt(e.target.value || "1", 10)) })
                    }
                    disabled={disabled}
                    className="input"
                  />
                </td>
                <td className="px-3 py-2">
                  <QuickPick
                    value={item.unit}
                    onChange={(v) => updateRow(index, { unit: v })}
                    options={UNITS}
                    disabled={disabled}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    disabled={disabled || items.length <= 1}
                    className="rounded-lg p-1.5 text-rose-600 transition hover:bg-rose-50 disabled:opacity-30 dark:hover:bg-rose-500/10"
                    title={items.length <= 1 ? "Minimal harus ada satu produk" : "Hapus baris ini"}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={addRow} disabled={disabled || !bisaTambah} className="btn-secondary">
          <Plus size={15} /> Tambah produk
        </button>
        <p className="text-[11px] font-medium text-slate-500">
          {items.length} produk · total {formatNumber(items.reduce((s, i) => s + (i.quantity || 0), 0))} unit
          {!bisaTambah ? ` · maksimal ${MAX_ITEMS_PER_ORDER} baris` : ""}
        </p>
      </div>
    </div>
  );
}
