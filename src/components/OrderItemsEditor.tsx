"use client";

import { Plus, Trash2 } from "lucide-react";
import { PRODUCT_TYPES, UNITS, formatNumber } from "@/lib/domain";
import { MAX_ITEMS_PER_ORDER, type OrderItemInput } from "@/lib/order-items";

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
                <input
                  list="product-type-list"
                  value={item.productType}
                  onChange={(e) => updateRow(index, { productType: e.target.value })}
                  disabled={disabled}
                  placeholder="Contoh: Spanduk / Banner"
                  className="input"
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
                  <input
                    list="unit-list"
                    value={item.unit}
                    onChange={(e) => updateRow(index, { unit: e.target.value })}
                    disabled={disabled}
                    className="input"
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
                  <input
                    list="product-type-list"
                    value={item.productType}
                    onChange={(e) => updateRow(index, { productType: e.target.value })}
                    disabled={disabled}
                    placeholder="Contoh: Spanduk / Banner"
                    className="input"
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
                  <input
                    list="unit-list"
                    value={item.unit}
                    onChange={(e) => updateRow(index, { unit: e.target.value })}
                    disabled={disabled}
                    className="input"
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

      {/* Pilihan siap pakai untuk kedua tampilan — tetap boleh diketik bebas
          kalau jenis produknya belum ada di daftar. */}
      <datalist id="product-type-list">
        {PRODUCT_TYPES.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="unit-list">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

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
