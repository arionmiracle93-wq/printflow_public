"use client";

import { useMemo, useState } from "react";
import { Calculator, Check, Download, Info, Layers, Loader2, Percent, Sparkles, X } from "lucide-react";
import { Select } from "@/components/Select";
import { TextTile } from "@/components/CatalogParts";
import { buildCsv } from "@/lib/csv-parse";
import { formatRupiah } from "@/lib/domain";
import { groupPath, indexById } from "@/lib/catalog-variants";
import type { CatalogItem } from "@/lib/invoice-catalog-match";
import {
  buildQuickNota,
  quickNotaConflicts,
  quickNumberInput,
  quickPriceKey,
  quickYieldFor,
  type QuickExtraInput,
  type QuickImportItem,
  type QuickNotaInput,
  type QuickParentMode,
  type QuickProduct,
} from "@/lib/catalog-quick-nota";

/**
 * MODE CEPAT — CETAK NOTA NCR
 * ===================================================================
 * Jendela bantu untuk membuat struktur produk nota lengkap tanpa
 * mengetik satu-satu: induk (baru atau yang sudah ada), varian rangkap ×
 * warna, numerator, dan perforasi. Semua hasil dikirim lewat endpoint
 * impor katalog yang sudah ada, jadi tidak ada perubahan database.
 *
 * Prinsip penting:
 * - Induk umum seperti "NOTA" bisa dipakai ulang sebagai wadah varian.
 * - Sub-induk seperti "NOTA > NCR A5" bisa dipilih langsung lewat id/path;
 *   varian lalu masuk ke sub-induk itu.
 * - Harga di sini adalah harga PER RIM, bukan per buku.
 * - Data lama tidak ditimpa. Nama yang sudah ada ditolak di pratinjau.
 * - Pemilik bisa mengunduh CSV sebelum membuat produk.
 */

type Props = {
  products: CatalogItem[];
  categories: string[];
  onClose: () => void;
  /** Kembalikan teks error bila gagal; null bila berhasil. */
  onSubmit: (items: QuickImportItem[]) => Promise<string | null>;
};

const RANGKAP_VALUES = [1, 2, 3, 4, 5];
const COLOR_VALUES = [1, 2, 3, 4];

function initialInput(products: CatalogItem[]): QuickNotaInput {
  /* Kalau sudah ada induk umum bernama NOTA, langsung tawarkan induk itu.
     Pemilik tetap bisa pindah ke "Buat induk baru" kapan saja. */
  const byId = indexById(products);
  const nota = products.find((product) => product.isGroup && product.parentId == null && product.name.trim().toLowerCase() === "nota");
  /* Bila NOTA sudah punya sub-induk NCR A5, langsung pilih sub-induk itu supaya varian masuk ke
     struktur NOTA > NCR A5. Kalau belum ada, tetap pilih NOTA dengan label NCR A5 (mode satu tingkat). */
  const notaNcr = nota
    ? products.find(
        (product) =>
          product.isGroup &&
          product.parentId === nota.id &&
          product.name.trim().toLowerCase() === "ncr a5",
      )
    : undefined;
  const chosen = notaNcr ?? nota;
  return {
    parentMode: chosen ? "existing" : "new",
    parentName: "Cetak Nota NCR A5",
    existingParentId: chosen?.id ?? null,
    existingParentPath: chosen ? groupPath(chosen, byId) : "",
    variantPrefix: chosen && chosen.parentId == null ? "NCR A5" : "",
    category: chosen ? chosen.category ?? "" : "Nota",
    size: "A5",
    material: "NCR F4",
    rangkap: [2, 3],
    colors: [1, 2],
    prices: {},
    autoYield: true,
    sheetsPerRim: "500",
    upsPerSheet: "2",
    sheetsPerBook: "50",
    booksPerRim: "20",
    minRim: "1",
    numerator: { enabled: true, price: "", setup: "" },
    perforasi: { enabled: true, price: "", setup: "" },
    discounts: "",
    tile: { mode: "inherit", pattern: "{r} Rangkap / {w} Warna" },
    desc: { mode: "auto", text: "" },
  };
}

function toNumber(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function money(raw: string): string {
  return quickNumberInput(raw);
}

function toggleValue(values: number[], value: number): number[] {
  if (values.includes(value)) {
    if (values.length === 1) return values;
    return values.filter((item) => item !== value);
  }
  return [...values, value].sort((a, b) => a - b);
}

export function CatalogQuickCreate({ products, categories, onClose, onSubmit }: Props) {
  const [input, setInput] = useState<QuickNotaInput>(() => initialInput(products));
  const [fill, setFill] = useState({ base: "", perRangkap: "", perWarna: "" });
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const byId = useMemo(() => indexById(products), [products]);
  const groups = useMemo(
    () => products.filter((product) => product.isGroup).sort((a, b) => groupPath(a, byId).localeCompare(groupPath(b, byId), "id")),
    [products, byId],
  );
  const selectedGroup = input.parentMode === "existing" && input.existingParentId != null
    ? groups.find((group) => group.id === input.existingParentId) ?? null
    : null;
  const existingVariantCount = selectedGroup
    ? products.filter((product) => product.parentId === selectedGroup.id && !product.isGroup).length
    : 0;
  const selectedGroupPath = selectedGroup ? groupPath(selectedGroup, byId) : "";

  const build = useMemo(() => buildQuickNota(input), [input]);
  /* Pratinjau kartu teks mode cepat: ambil pola yang sudah diikanisasi dari varian pertama. */
  const tileSample = build.variants.find((product) => product.imageText)?.imageText ?? null;
  const conflicts = useMemo(() => quickNotaConflicts(build, products), [build, products]);
  const errors = useMemo(() => [...build.errors, ...conflicts.errors], [build, conflicts]);
  const warnings = useMemo(() => [...build.warnings, ...conflicts.warnings], [build, conflicts]);
  const hasConflict = conflicts.errors.length > 0;
  const canCreate = !busy && errors.length === 0 && build.items.length > 0;
  const submitLabel = busy
    ? "Membuat..."
    : hasConflict
      ? "Perbaiki Bentrok"
      : build.items.length
        ? `Buat ${conflicts.fresh} Produk`
        : "Buat Produk";

  const patch = (next: Partial<QuickNotaInput>) => {
    setSubmitError(null);
    setInput((current) => ({ ...current, ...next }));
  };
  const patchExtra = (key: "numerator" | "perforasi", next: Partial<QuickExtraInput>) => {
    setSubmitError(null);
    setInput((current) => ({ ...current, [key]: { ...current[key], ...next } }));
  };

  function chooseParentMode(mode: QuickParentMode) {
    if (mode === "new") return patch({ parentMode: "new" });
    const nota = groups.find((group) => group.parentId == null && group.name.trim().toLowerCase() === "nota");
    const current = groups.find((group) => group.id === input.existingParentId)
      ?? groups.find((group) => !!nota && group.parentId === nota.id && group.name.trim().toLowerCase() === "ncr a5")
      ?? nota
      ?? groups[0];
    const isRootNota = !!current && current.parentId == null && current.name.trim().toLowerCase() === "nota";
    patch({
      parentMode: "existing",
      existingParentId: current?.id ?? null,
      existingParentPath: current ? groupPath(current, byId) : "",
      variantPrefix: isRootNota ? "NCR A5" : "",
      category: current?.category ?? "",
    });
  }

  function chooseExistingParent(id: string) {
    const group = groups.find((item) => String(item.id) === id);
    const isRootNota = !!group && group.parentId == null && group.name.trim().toLowerCase() === "nota";
    patch({
      parentMode: "existing",
      existingParentId: group?.id ?? null,
      existingParentPath: group ? groupPath(group, byId) : "",
      variantPrefix: isRootNota ? "NCR A5" : "",
      category: group?.category ?? "",
    });
  }

  function setPrice(rangkap: number, warna: number, raw: string) {
    const key = quickPriceKey(rangkap, warna);
    setSubmitError(null);
    setInput((current) => ({ ...current, prices: { ...current.prices, [key]: money(raw) } }));
  }

  function fillPrices() {
    const base = toNumber(fill.base);
    if (!base || !input.rangkap.length || !input.colors.length) return;
    setSubmitError(null);
    const minRangkap = Math.min(...input.rangkap);
    const minWarna = Math.min(...input.colors);
    const perRangkap = toNumber(fill.perRangkap);
    const perWarna = toNumber(fill.perWarna);
    const next = { ...input.prices };
    for (const r of input.rangkap) {
      for (const c of input.colors) {
        const price = base + (r - minRangkap) * perRangkap + (c - minWarna) * perWarna;
        next[quickPriceKey(r, c)] = quickNumberInput(String(Math.max(1, price)));
      }
    }
    setInput((current) => ({ ...current, prices: next }));
  }

  function downloadCsv() {
    if (!build.items.length) return;
    const rows: unknown[][] = [
      ["Nama Produk", "Keterangan", "Harga", "Harga Bertingkat", "Kategori", "Induk"],
      ...build.items.map((item) => [item.name, item.description, item.price, item.tiers, item.category, item.parent]),
    ];
    const url = URL.createObjectURL(new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "mode-cepat-nota.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function submit() {
    if (!canCreate) return;
    setSubmitError(null);
    setBusy(true);
    try {
      const message = await onSubmit(build.items);
      if (message) {
        setSubmitError(message);
        setBusy(false);
        return;
      }
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Gagal membuat produk.");
      setBusy(false);
    }
  }

  return (
    <div className="ppi-modal-back" role="dialog" aria-modal="true" aria-label="Mode Cepat Cetak Nota">
      <div className="ppi-modal" style={{ maxWidth: 980 }} onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-base font-extrabold">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[color:var(--ppi-accent-tint-strong)] text-[color:var(--ppi-accent)]">
                <Sparkles size={17} />
              </span>
              Mode Cepat
              <span className="hidden rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-teal-700 sm:inline dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200">
                Cetak Nota NCR
              </span>
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[color:var(--ppi-muted)]">
              {input.parentMode === "existing"
                ? "Varian nota akan dimasukkan ke induk/sub-induk yang sudah ada. Harga yang diisi adalah "
                : "Isi sekali, lalu induk + varian + numerator/perforasi dibuat otomatis. Harga yang diisi adalah "}
              <b className="text-[color:var(--ppi-fg)]">harga per rim</b>, bukan per buku.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="ppi-icon-btn disabled:cursor-not-allowed disabled:opacity-50" aria-label="Tutup Mode Cepat">
            <X size={15} />
          </button>
        </div>

        <div className="grid gap-4 min-[900px]:grid-cols-[minmax(0,1.12fr)_minmax(300px,0.88fr)]">
          <div className="min-w-0 space-y-3">
            <Section step="1" title="Induk tujuan" desc="Pilih induk/sub-induk yang sudah ada (mis. NOTA > NCR A5) atau buat induk baru.">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mode induk">
                <button
                  type="button"
                  aria-pressed={input.parentMode === "new"}
                  onClick={() => chooseParentMode("new")}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition ${input.parentMode === "new" ? "border-teal-600 bg-teal-600 text-white" : "border-[color:var(--ppi-line)] text-[color:var(--ppi-fg)]"}`}
                >
                  Buat induk baru
                </button>
                <button
                  type="button"
                  aria-pressed={input.parentMode === "existing"}
                  onClick={() => chooseParentMode("existing")}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition ${input.parentMode === "existing" ? "border-teal-600 bg-teal-600 text-white" : "border-[color:var(--ppi-line)] text-[color:var(--ppi-fg)]"}`}
                >
                  Pakai induk yang ada
                </button>
              </div>

              {input.parentMode === "new" ? (
                <>
                  <label className="mt-2 block">
                    <span className="ppi-label">Nama induk *</span>
                    <input
                      value={input.parentName}
                      onChange={(event) => patch({ parentName: event.target.value })}
                      className="ppi-in boxed"
                      placeholder="mis. Cetak Nota NCR A5"
                      autoFocus
                    />
                  </label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <label className="block">
                      <span className="ppi-label">Kategori</span>
                      <input
                        value={input.category}
                        onChange={(event) => patch({ category: event.target.value })}
                        className="ppi-in boxed"
                        placeholder="mis. Nota"
                      />
                    </label>
                    <label className="block">
                      <span className="ppi-label">Ukuran jadi</span>
                      <input value={input.size} onChange={(event) => patch({ size: event.target.value })} className="ppi-in boxed" placeholder="A5" />
                    </label>
                    <label className="block">
                      <span className="ppi-label">Bahan</span>
                      <input value={input.material} onChange={(event) => patch({ material: event.target.value })} className="ppi-in boxed" placeholder="NCR F4" />
                    </label>
                  </div>
                  <div className="mt-1.5 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto" role="group" aria-label="Pilih kategori">
                    {[{ label: "Tanpa kategori", value: "" }, ...categories.filter((category) => category !== "").map((category) => ({ label: category, value: category }))].map((option) => {
                      const active = input.category.trim().toLowerCase() === option.value.toLowerCase();
                      return (
                        <button
                          key={option.value || "__none"}
                          type="button"
                          aria-pressed={active}
                          onClick={() => patch({ category: option.value })}
                          className={`chip px-2.5 py-1 text-[11px] transition ${active ? "border-teal-600 bg-teal-600 text-white" : "border-[color:var(--ppi-line)] text-[color:var(--ppi-fg)] hover:border-teal-400"}`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="mt-2 space-y-2">
                  <label className="block">
                    <span className="ppi-label">Induk yang sudah ada *</span>
                    <Select
                      value={input.existingParentId != null ? String(input.existingParentId) : ""}
                      onChange={(event) => chooseExistingParent(event.target.value)}
                      className="ppi-in boxed w-full"
                      placeholder={groups.length ? "Pilih induk..." : "Belum ada induk"}
                      aria-label="Pilih induk atau sub-induk yang sudah ada"
                    >
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {groupPath(group, byId)}{group.category ? ` · ${group.category}` : ""}
                        </option>
                      ))}
                    </Select>
                    <span className="mt-1 block text-[10px] leading-snug text-[color:var(--ppi-muted)]">
                      Pilih induk utama (mis. NOTA) atau sub-induk (mis. NOTA &gt; NCR A5). Varian masuk ke wadah yang dipilih.
                      Untuk struktur NOTA &gt; NCR A5, buat sub-induk NCR A5 dulu dari halaman induk NOTA.
                    </span>
                  </label>
                  {!groups.length ? (
                    <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[10.5px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                      Belum ada induk. Pilih <b>Buat induk baru</b> untuk membuat wadahnya.
                    </p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="block">
                      <span className="ppi-label">Label varian</span>
                      <input
                        value={input.variantPrefix}
                        onChange={(event) => patch({ variantPrefix: event.target.value })}
                        className="ppi-in boxed"
                        placeholder="mis. NCR A5 (opsional)"
                      />
                    </label>
                    <label className="block">
                      <span className="ppi-label">Ukuran jadi</span>
                      <input value={input.size} onChange={(event) => patch({ size: event.target.value })} className="ppi-in boxed" placeholder="A5" />
                    </label>
                    <label className="block">
                      <span className="ppi-label">Bahan</span>
                      <input value={input.material} onChange={(event) => patch({ material: event.target.value })} className="ppi-in boxed" placeholder="NCR F4" />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] leading-snug text-[color:var(--ppi-muted)]">
                    <span>Label varian menjadi awalan nama. Isi untuk induk umum seperti NOTA; kosongkan kalau nama induk sudah menyebut produk.</span>
                    <button
                      type="button"
                      onClick={() => patch({ variantPrefix: `${input.material} ${input.size}`.trim() })}
                      className="shrink-0 font-bold text-teal-700 underline dark:text-teal-300"
                    >
                      Salin bahan + ukuran
                    </button>
                  </div>
                  <p className="rounded-lg bg-[color:var(--ppi-fill)] px-2.5 py-2 text-[10.5px] leading-snug text-[color:var(--ppi-muted)]">
                    Kategori mengikuti induk: <b className="text-[color:var(--ppi-fg)]">{selectedGroup?.category || "Tanpa kategori"}</b>
                    {selectedGroup ? ` · ${existingVariantCount} varian langsung sudah ada` : ""}
                    {selectedGroupPath ? <><br />Path: <b className="text-[color:var(--ppi-fg)]">{selectedGroupPath}</b></> : null}
                  </p>
                </div>
              )}
            </Section>

            <Section step="2" title="Varian & harga per rim" desc="Centang kombinasi yang dijual, lalu isi harga per rim.">
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberPills
                  label="Rangkap"
                  hint="minimal 1"
                  values={RANGKAP_VALUES}
                  selected={input.rangkap}
                  onToggle={(value) => patch({ rangkap: toggleValue(input.rangkap, value) })}
                />
                <NumberPills
                  label="Warna"
                  hint="minimal 1"
                  values={COLOR_VALUES}
                  selected={input.colors}
                  onToggle={(value) => patch({ colors: toggleValue(input.colors, value) })}
                />
              </div>

              <div className="mt-3 rounded-xl border border-dashed border-[color:var(--ppi-dashed)] bg-[color:var(--ppi-accent-tint)] p-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-[color:var(--ppi-fg)]">
                  <Calculator size={13} className="text-[color:var(--ppi-accent)]" /> Isi cepat harga
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <label className="block">
                    <span className="ppi-label">Harga dasar / rim</span>
                    <input value={fill.base} onChange={(event) => setFill((current) => ({ ...current, base: money(event.target.value) }))} inputMode="numeric" className="ppi-in boxed ppi-num" placeholder="0" />
                  </label>
                  <label className="block">
                    <span className="ppi-label">Tambah / rangkap</span>
                    <input value={fill.perRangkap} onChange={(event) => setFill((current) => ({ ...current, perRangkap: money(event.target.value) }))} inputMode="numeric" className="ppi-in boxed ppi-num" placeholder="0" />
                  </label>
                  <label className="block">
                    <span className="ppi-label">Tambah / warna</span>
                    <input value={fill.perWarna} onChange={(event) => setFill((current) => ({ ...current, perWarna: money(event.target.value) }))} inputMode="numeric" className="ppi-in boxed ppi-num" placeholder="0" />
                  </label>
                  <div className="flex items-end">
                    <button type="button" onClick={fillPrices} disabled={!toNumber(fill.base)} className="btn-secondary min-h-[34px] w-full px-2 py-1.5 text-[11px]">
                      Isi tabel
                    </button>
                  </div>
                </div>
                <p className="mt-1.5 text-[10px] leading-snug text-[color:var(--ppi-muted)]">
                  Harga dasar dipakai untuk rangkap terkecil + warna terkecil. Setelah terisi, tiap sel masih bisa diubah sendiri.
                </p>
              </div>

              <div className="mt-3 overflow-x-auto rounded-xl border border-[color:var(--ppi-line)]">
                <table className="w-full min-w-[430px] border-collapse text-xs">
                  <thead>
                    <tr className="bg-[color:var(--ppi-fill)]">
                      <th className="px-2 py-1.5 text-left text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--ppi-muted)]">Rangkap</th>
                      {input.colors.map((color) => (
                        <th key={color} className="px-2 py-1.5 text-left text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--ppi-muted)]">{color} warna</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {input.rangkap.map((r) => (
                      <tr key={r} className="border-t border-[color:var(--ppi-line-soft)]">
                        <th className="px-2 py-1.5 text-left text-[11px] font-extrabold">{r} rangkap</th>
                        {input.colors.map((c) => (
                          <td key={c} className="px-1.5 py-1.5">
                            <input
                              value={input.prices[quickPriceKey(r, c)] ?? ""}
                              onChange={(event) => setPrice(r, c, event.target.value)}
                              inputMode="numeric"
                              aria-label={`Harga ${r} rangkap ${c} warna per rim`}
                              className="ppi-in boxed ppi-num w-full min-w-[86px] !py-1.5 text-right text-[11px] font-bold"
                              placeholder="0"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <label className="mt-2 block">
                <span className="ppi-label">Diskon grosir otomatis (opsional)</span>
                <input
                  value={input.discounts}
                  onChange={(event) => patch({ discounts: event.target.value })}
                  className="ppi-in boxed font-mono text-xs"
                  placeholder="5=5%; 10=10%"
                />
                <span className="mt-1 block text-[10px] leading-snug text-[color:var(--ppi-muted)]">
                  Format: minimal qty = persen. Harga tier dihitung dari harga tiap varian dan produk tambahan. Kosongkan bila belum ada diskon.
                </span>
              </label>

              {/* RUANG GAMBAR VARIAN BARU: bawaan = gambar induk (seperti biasa); TEKS = kartu teks
                  dari pola — tanpa file gambar sama sekali, jadi nol upload dan nol permintaan jaringan. */}
              <div className="mt-2 rounded-xl border border-[color:var(--ppi-line)] p-2.5">
                <span className="ppi-label">Ruang gambar varian baru</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Ruang gambar varian baru">
                  <button
                    type="button"
                    aria-pressed={input.tile.mode === "inherit"}
                    onClick={() => patch({ tile: { ...input.tile, mode: "inherit" } })}
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition ${input.tile.mode === "inherit" ? "border-teal-600 bg-teal-600 text-white" : "border-[color:var(--ppi-line)] text-[color:var(--ppi-fg)]"}`}
                  >
                    Gambar induk
                  </button>
                  <button
                    type="button"
                    aria-pressed={input.tile.mode === "text"}
                    onClick={() => patch({ tile: { ...input.tile, mode: "text" } })}
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition ${input.tile.mode === "text" ? "border-teal-600 bg-teal-600 text-white" : "border-[color:var(--ppi-line)] text-[color:var(--ppi-fg)]"}`}
                  >
                    Teks
                  </button>
                </div>
                {input.tile.mode === "text" ? (
                  <div className="mt-2 flex items-start gap-2.5">
                    <label className="min-w-0 flex-1 block">
                      <span className="ppi-label">Pola teks kartu</span>
                      <input
                        value={input.tile.pattern}
                        onChange={(event) => patch({ tile: { mode: "text", pattern: event.target.value } })}
                        maxLength={60}
                        className="ppi-in boxed font-mono text-xs"
                        placeholder="{r} Rangkap / {w} Warna"
                      />
                      <span className="mt-1 block text-[10px] leading-snug text-[color:var(--ppi-muted)]">
                        {"{r}"} rangkap · {"{w}"} warna · {"{s}"} ukuran · {"{m}"} bahan · {"{p}"} label. Sampel pola kosong diabaikan.
                        Kartu teks berlaku di varian yang belum punya gambar sendiri — bila nanti diberi gambar, gambar yang tampil.
                      </span>
                    </label>
                    {tileSample ? (
                      <div className="shrink-0 text-center">
                        <TextTile text={tileSample} className="h-14 w-20 rounded-lg border border-teal-300" />
                        <span className="mt-1 block text-[9px] font-bold text-[color:var(--ppi-muted)]">Contoh kartu</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* KETERANGAN PRODUK: bawaan otomatis (lengkap per varian: rangkap, hasil per rim, finishing,
                  minimal order). Manual = SATU pola untuk semua baris baru, dengan kata kunci yang sama
                  seperti kartu teks — baris induk/tambahan memperlakukan {r}/{w} sebagai kosong. */}
              <div className="mt-2 rounded-xl border border-[color:var(--ppi-line)] p-2.5">
                <span className="ppi-label">Keterangan produk</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Keterangan produk">
                  <button
                    type="button"
                    aria-pressed={input.desc.mode === "auto"}
                    onClick={() => patch({ desc: { ...input.desc, mode: "auto" } })}
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition ${input.desc.mode === "auto" ? "border-teal-600 bg-teal-600 text-white" : "border-[color:var(--ppi-line)] text-[color:var(--ppi-fg)]"}`}
                  >
                    Otomatis
                  </button>
                  <button
                    type="button"
                    aria-pressed={input.desc.mode === "manual"}
                    onClick={() => patch({ desc: { ...input.desc, mode: "manual" } })}
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition ${input.desc.mode === "manual" ? "border-teal-600 bg-teal-600 text-white" : "border-[color:var(--ppi-line)] text-[color:var(--ppi-fg)]"}`}
                  >
                    Manual
                  </button>
                </div>
                {input.desc.mode === "manual" ? (
                  <label className="mt-2 block">
                    <span className="ppi-label">Pola keterangan</span>
                    <textarea
                      value={input.desc.text}
                      onChange={(event) => patch({ desc: { mode: "manual", text: event.target.value } })}
                      rows={3}
                      maxLength={500}
                      className="ppi-in boxed text-xs"
                      placeholder={'Harga per rim · {r} rangkap {w} warna. {m} ukuran {s}. {y}'}
                    />
                    <span className="mt-1 block text-[10px] leading-snug text-[color:var(--ppi-muted)]">
                      {"{r}"} rangkap · {"{w}"} warna · {"{s}"} ukuran · {"{m}"} bahan · {"{p}"} label · {"{y}"} hasil per rim.
                      Pola ini dipakai SEMUA baris baru; pada induk & tambahan, kata kunci {"{r}"}/{"{w}"} dibuang (rapi, tanpa spasi ganda).
                    </span>
                  </label>
                ) : (
                  <span className="mt-1 block text-[10px] leading-snug text-[color:var(--ppi-muted)]">
                    Keterangan dibuat lengkap otomatis per varian: jumlah rangkap &amp; warna, hasil per rim, finishing, dan minimal order.
                  </span>
                )}
              </div>
            </Section>

            <Section step="3" title="Hasil per rim" desc="Dipakai untuk keterangan produk. Bisa otomatis dari lembar, atau isi manual.">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={input.autoYield}
                  onClick={() => patch({ autoYield: true })}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition ${input.autoYield ? "border-teal-600 bg-teal-600 text-white" : "border-[color:var(--ppi-line)] text-[color:var(--ppi-fg)]"}`}
                >
                  Hitung otomatis
                </button>
                <button
                  type="button"
                  aria-pressed={!input.autoYield}
                  onClick={() => patch({ autoYield: false })}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition ${!input.autoYield ? "border-teal-600 bg-teal-600 text-white" : "border-[color:var(--ppi-line)] text-[color:var(--ppi-fg)]"}`}
                >
                  Isi manual
                </button>
              </div>

              {input.autoYield ? (
                <>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <label className="block">
                      <span className="ppi-label">Lembar per rim</span>
                      <input value={input.sheetsPerRim} onChange={(event) => patch({ sheetsPerRim: money(event.target.value) })} inputMode="numeric" className="ppi-in boxed ppi-num" placeholder="500" />
                    </label>
                    <label className="block">
                      <span className="ppi-label">Potong per lembar</span>
                      <input value={input.upsPerSheet} onChange={(event) => patch({ upsPerSheet: money(event.target.value) })} inputMode="numeric" className="ppi-in boxed ppi-num" placeholder="2" />
                    </label>
                    <label className="block">
                      <span className="ppi-label">Isi lembar / buku</span>
                      <input value={input.sheetsPerBook} onChange={(event) => patch({ sheetsPerBook: money(event.target.value) })} inputMode="numeric" className="ppi-in boxed ppi-num" placeholder="50" />
                    </label>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-snug text-[color:var(--ppi-muted)]">
                    Contoh F4 2-up A5: 500 lembar × 2 potong = 1.000 lembar A5. Dibagi 50 lembar/buku × rangkap.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {input.rangkap.map((r) => (
                      <span key={r} className="chip border-[color:var(--ppi-line)] px-2.5 py-1 text-[10.5px] text-[color:var(--ppi-fg)]">
                        {r} rangkap: {quickYieldFor(input, r).label}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="ppi-label">Hasil per rim (buku)</span>
                    <input value={input.booksPerRim} onChange={(event) => patch({ booksPerRim: money(event.target.value) })} inputMode="numeric" className="ppi-in boxed ppi-num" placeholder="20" />
                  </label>
                  <label className="block">
                    <span className="ppi-label">Isi lembar / buku</span>
                    <input value={input.sheetsPerBook} onChange={(event) => patch({ sheetsPerBook: money(event.target.value) })} inputMode="numeric" className="ppi-in boxed ppi-num" placeholder="50" />
                  </label>
                </div>
              )}

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="ppi-label">Minimal order (rim)</span>
                  <input value={input.minRim} onChange={(event) => patch({ minRim: money(event.target.value) })} inputMode="numeric" className="ppi-in boxed ppi-num" placeholder="1" />
                </label>
                <p className="self-end rounded-lg bg-[color:var(--ppi-fill)] px-2.5 py-2 text-[10px] leading-snug text-[color:var(--ppi-muted)]">
                  Kalau NCR sudah collated (1 rim = 500 set), pakai <b>Isi manual</b> dan tulis hasil buku per rim sesuai produksi.
                </p>
              </div>
            </Section>

            <Section step="4" title="Produk tambahan" desc="Dibuat sebagai produk terpisah; kasir menambahkannya saat invoice.">
              <div className="grid gap-2 sm:grid-cols-2">
                <ExtraCard
                  title="Numerator"
                  description="Harga per rim, bukan per buku. Bisa ditambah setting sekali per order."
                  value={input.numerator}
                  onChange={(next) => patchExtra("numerator", next)}
                />
                <ExtraCard
                  title="Perforasi"
                  description="Harga per rim. Bisa ditambah setting sekali per order."
                  value={input.perforasi}
                  onChange={(next) => patchExtra("perforasi", next)}
                />
              </div>
            </Section>
          </div>

          <aside className="min-w-0">
            <div className="rounded-2xl border border-[color:var(--ppi-line)] bg-[color:var(--ppi-panel-bg)] p-3 min-[900px]:sticky min-[900px]:top-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-extrabold"><Layers size={14} className="text-[color:var(--ppi-accent)]" /> Pratinjau</p>
                <span className="chip border-[color:var(--ppi-line)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--ppi-fg)]">
                  {build.products.length + (selectedGroup ? 1 : 0)} produk · {conflicts.fresh} baru
                </span>
              </div>
              <p className="mt-1 text-[10.5px] leading-snug text-[color:var(--ppi-muted)]">
                Data lama tidak ditimpa. Produk dengan nama yang sudah ada akan ditolak agar harga lama tidak tertukar.
              </p>

              <div className="mt-2 max-h-[46vh] space-y-1.5 overflow-y-auto pr-0.5">
                {!build.parent && !selectedGroup ? (
                  <p className="rounded-xl border border-dashed border-[color:var(--ppi-line)] px-3 py-5 text-center text-[11px] text-[color:var(--ppi-muted)]">
                    {input.parentMode === "existing" ? "Pilih induk yang sudah ada untuk melihat pratinjau." : "Isi nama induk untuk melihat pratinjau."}
                  </p>
                ) : (
                  <>
                    {selectedGroup ? (
                      <ExistingGroupPreview name={selectedGroupPath || selectedGroup.name} category={selectedGroup.category} count={existingVariantCount} />
                    ) : build.parent ? (
                      <PreviewRow product={build.parent} />
                    ) : null}
                    {build.variants.length ? <PreviewLabel text={`${build.variants.length} varian baru`} /> : null}
                    {build.variants.map((product) => <PreviewRow key={product.key} product={product} />)}
                    {build.extras.length ? <PreviewLabel text={`${build.extras.length} produk tambahan`} /> : null}
                    {build.extras.map((product) => <PreviewRow key={product.key} product={product} />)}
                  </>
                )}
              </div>

              {errors.length ? (
                <div className="mt-2 rounded-xl bg-rose-50 px-2.5 py-2 text-[10.5px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                  <p className="font-extrabold">Belum bisa dibuat</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {errors.slice(0, 6).map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
                  </ul>
                  {errors.length > 6 ? <p className="mt-1 font-semibold">+{errors.length - 6} peringatan lain</p> : null}
                </div>
              ) : (
                <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 py-2 text-[10.5px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                  <Check size={12} /> Siap dibuat. Periksa kembali harga per rim sebelum menyimpan.
                </p>
              )}

              {warnings.length ? (
                <div className="mt-2 rounded-xl bg-amber-50 px-2.5 py-2 text-[10.5px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  <p className="flex items-center gap-1 font-extrabold"><Info size={12} /> Catatan</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {warnings.slice(0, 4).map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
                  </ul>
                </div>
              ) : null}

              {input.discounts.trim() && build.variants.length ? (
                <p className="mt-2 flex items-start gap-1 text-[10px] leading-snug text-[color:var(--ppi-muted)]">
                  <Percent size={11} className="mt-0.5 shrink-0" /> Diskon grosir ikut dihitung ke varian dan produk tambahan.
                </p>
              ) : null}
            </div>
          </aside>
        </div>

        {submitError ? (
          <p className="mt-3 break-words rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
            {submitError}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--ppi-line)] pt-3">
          <button type="button" onClick={downloadCsv} disabled={!build.items.length} className="btn-ghost min-h-[34px] px-3 py-1.5 text-xs">
            <Download size={13} /> Unduh CSV
          </button>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-[color:var(--ppi-line)] px-4 py-2 text-xs font-bold text-[color:var(--ppi-fg)] disabled:opacity-50">
              Batal
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ step, title, desc, children }: { step: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[color:var(--ppi-line)] bg-[color:var(--ppi-panel-bg)] p-3">
      <div className="mb-2 flex items-start gap-2">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--ppi-accent-tint-strong)] text-[10px] font-extrabold text-[color:var(--ppi-accent)]">{step}</span>
        <div className="min-w-0">
          <p className="text-xs font-extrabold">{title}</p>
          <p className="mt-0.5 text-[10.5px] leading-snug text-[color:var(--ppi-muted)]">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function NumberPills({
  label,
  hint,
  values,
  selected,
  onToggle,
}: {
  label: string;
  hint: string;
  values: number[];
  selected: number[];
  onToggle: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="ppi-label">{label}</span>
        <span className="text-[9.5px] text-[color:var(--ppi-muted)]">{hint}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => {
          const active = selected.includes(value);
          const only = active && selected.length === 1;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              aria-disabled={only}
              title={only ? "Minimal satu pilihan" : `Pilih ${value} ${label.toLowerCase()}`}
              onClick={() => onToggle(value)}
              className={`chip min-h-8 px-3 py-1 text-xs transition ${active ? "border-teal-600 bg-teal-600 text-white" : "border-[color:var(--ppi-line)] text-[color:var(--ppi-fg)] hover:border-teal-400"}`}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExtraCard({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: QuickExtraInput;
  onChange: (next: Partial<QuickExtraInput>) => void;
}) {
  return (
    <div className={`rounded-xl border p-2.5 transition ${value.enabled ? "border-teal-300 bg-[color:var(--ppi-accent-tint)] dark:border-teal-500/40" : "border-[color:var(--ppi-line)]"}`}>
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600"
        />
        <span className="min-w-0">
          <span className="block text-xs font-extrabold">{title}</span>
          <span className="mt-0.5 block text-[10px] leading-snug text-[color:var(--ppi-muted)]">{description}</span>
        </span>
      </label>
      {value.enabled ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="ppi-label">Harga / rim</span>
            <input value={value.price} onChange={(event) => onChange({ price: money(event.target.value) })} inputMode="numeric" className="ppi-in boxed ppi-num" placeholder="0" />
          </label>
          <label className="block">
            <span className="ppi-label">Setting / order</span>
            <input value={value.setup} onChange={(event) => onChange({ setup: money(event.target.value) })} inputMode="numeric" className="ppi-in boxed ppi-num" placeholder="Opsional" />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function PreviewLabel({ text }: { text: string }) {
  return <p className="pt-1 text-[9.5px] font-extrabold uppercase tracking-wide text-[color:var(--ppi-muted)]">{text}</p>;
}

function tierSummary(tiers: string): string {
  return tiers
    .split(";")
    .map((part) => part.split("="))
    .filter(([min, price]) => min && price && Number(price) > 0)
    .map(([min, price]) => `${min}+ ${formatRupiah(Number(price))}`)
    .join(" · ");
}

function ExistingGroupPreview({ name, category, count }: { name: string; category: string | null; count: number }) {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-2.5 py-2 dark:border-sky-500/30 dark:bg-sky-500/10">
      <div className="flex items-start justify-between gap-2">
        <span className="chip shrink-0 border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">Induk</span>
        <span className="shrink-0 text-[10px] font-extrabold text-sky-700 dark:text-sky-200">sudah ada</span>
      </div>
      <p className="mt-1 break-words text-[11.5px] font-bold leading-snug text-[color:var(--ppi-fg)]">{name}</p>
      <p className="mt-0.5 text-[10px] leading-snug text-[color:var(--ppi-muted)]">
        {category || "Tanpa kategori"} · {count} varian lama
      </p>
    </div>
  );
}

function PreviewRow({ product }: { product: QuickProduct }) {
  const tierLabel = product.tiers ? tierSummary(product.tiers) : "";
  const badge = product.kind === "induk"
    ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200"
    : product.kind === "varian"
      ? "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200"
      : product.kind === "setting"
        ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200"
        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200";
  const label = product.kind === "induk" ? "Induk" : product.kind === "varian" ? "Varian" : product.kind === "setting" ? "Setting" : "Tambahan";
  return (
    <div className="rounded-xl border border-[color:var(--ppi-line)] bg-[color:var(--ppi-bg)] px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <span className={`chip shrink-0 px-1.5 py-0.5 text-[9px] ${badge}`}>{label}</span>
        <span className="shrink-0 text-[10px] font-extrabold text-[color:var(--ppi-fg)]">
          {product.kind === "induk" ? "tanpa harga" : product.kind === "setting" ? `${formatRupiah(product.price)} / order` : `${formatRupiah(product.price)} / rim`}
        </span>
      </div>
      <p className="mt-1 break-words text-[11.5px] font-bold leading-snug text-[color:var(--ppi-fg)]">{product.displayName}</p>
      <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[color:var(--ppi-muted)]" title={product.description}>{product.description}</p>
      {product.yieldLabel ? <p className="mt-1 text-[10px] font-semibold text-[color:var(--ppi-accent)]">Hasil: {product.yieldLabel} / rim</p> : null}
      {tierLabel ? <p className="mt-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-200">Grosir: {tierLabel} / rim</p> : null}
    </div>
  );
}
