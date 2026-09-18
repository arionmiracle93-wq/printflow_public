"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { PRODUCT_TYPES, UNITS, formatNumber } from "@/lib/domain";
import { MAX_ITEMS_PER_ORDER, type OrderItemInput } from "@/lib/order-items";

// Samakan dengan class `max-h-52` (13rem) pada menu di bawah — dipakai buat
// menghitung apakah menu harus dibuka ke atas kalau ruang di bawah mepet.
const QUICKPICK_MENU_MAX_HEIGHT = 208;
const QUICKPICK_MENU_GAP = 4;

type QuickPickMenuPos = { left: number; width: number; top?: number; bottom?: number };

/**
 * Input teks + dropdown pilihan siap pakai.
 * ----------------------------------------------------------------
 * Sebelumnya field ini pakai `<input list="...">` (HTML datalist bawaan
 * browser). Datalist tidak konsisten muncul di WebView Android (dipakai
 * APK hasil PWA) — di beberapa perangkat dropdown-nya sama sekali tidak
 * tampil. Komponen ini menggantinya dengan dropdown kustom yang pasti
 * kelihatan & bisa di-tap di semua platform, tapi teksnya tetap bisa
 * diketik manual kalau pilihannya belum ada di daftar.
 *
 * REVISI: menu dropdown-nya di-render lewat React Portal ke `document.body`,
 * bukan lagi `position: absolute` di tempat. Dua alasan:
 *
 * 1. Tabel "Item pekerjaan" dibungkus `overflow-hidden` (biar sudut
 *    rounded-nya rapi) — dropdown yang cuma `absolute` di dalamnya jadi
 *    KEPOTONG begitu melewati batas kartu/tabel itu.
 * 2. Beberapa elemen di app ini (header, tab bar, sticky action bar) pakai
 *    `backdrop-blur`. Elemen ber-`backdrop-filter` jadi containing block
 *    baru buat turunan `position: fixed`/`absolute` di dalamnya — persis
 *    bug Chrome Android yang bikin posisinya meleset (lihat catatan yang
 *    sama di `globals.css` soal `.mobile-bottom-nav`, yang dibereskan
 *    dengan cara serupa: di-portal keluar + posisi dikunci manual).
 *
 * Portal ke `document.body` + posisi dihitung manual dari
 * `getBoundingClientRect()` (lalu di-refresh saat scroll/resize/keyboard
 * muncul) membereskan dua-duanya sekaligus: menunya keluar total dari
 * kartu yang `overflow-hidden`, dan tidak lagi jadi turunan elemen
 * ber-`backdrop-blur` manapun, jadi posisinya selalu dihitung relatif ke
 * viewport yang sebenarnya.
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
  const [menuPos, setMenuPos] = useState<QuickPickMenuPos | null>(null);
  // Portal cuma boleh dipakai setelah mount (butuh `document`), sama seperti
  // pola yang dipakai `MainNav` buat nge-portal nav bawah keluar dari header.
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Hitung ulang posisi menu tiap kali dibuka, dan tiap kali ada scroll/resize
  // selama menu masih terbuka — termasuk scroll di dalam kartu/tabel manapun
  // (bukan cuma window, makanya listener scroll pakai `capture: true`) dan
  // perubahan viewport karena keyboard HP muncul (`visualViewport`).
  useEffect(() => {
    if (!open) return;

    function reposition() {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportH = window.visualViewport?.height ?? window.innerHeight;
      const spaceBelow = viewportH - rect.bottom;
      const bukaKeAtas = spaceBelow < QUICKPICK_MENU_MAX_HEIGHT && rect.top > spaceBelow;
      setMenuPos(
        bukaKeAtas
          ? { left: rect.left, width: rect.width, bottom: viewportH - rect.top + QUICKPICK_MENU_GAP }
          : { left: rect.left, width: rect.width, top: rect.bottom + QUICKPICK_MENU_GAP },
      );
    }

    reposition();
    const vv = window.visualViewport;
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    vv?.addEventListener("resize", reposition);
    vv?.addEventListener("scroll", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      vv?.removeEventListener("resize", reposition);
      vv?.removeEventListener("scroll", reposition);
    };
  }, [open]);

  return (
    <div className="relative" ref={anchorRef}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        placeholder={placeholder}
        className="input pr-9"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-label="Pilih dari daftar"
        className="absolute inset-y-0 right-1 flex w-8 items-center justify-center text-slate-400 transition hover:text-teal-600 disabled:opacity-40 dark:text-slate-500 dark:hover:text-teal-300"
      >
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && !disabled && mounted && menuPos
        ? createPortal(
            <>
              {/* Lapisan transparan buat nutup dropdown pas klik di luar. */}
              <div className="fixed inset-0 z-[85]" onClick={() => setOpen(false)} />
              <div
                style={{
                  position: "fixed",
                  left: menuPos.left,
                  width: menuPos.width,
                  top: menuPos.top,
                  bottom: menuPos.bottom,
                  maxHeight: QUICKPICK_MENU_MAX_HEIGHT,
                }}
                className="z-[86] overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#101e29]"
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
              </div>
            </>,
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
