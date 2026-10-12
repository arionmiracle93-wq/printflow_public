"use client";

import { useMemo, useState } from "react";
import { Calculator, X } from "lucide-react";
import { formatRupiah } from "@/lib/domain";
import {
  computeRowPricing,
  parseLooseNumber,
  parseTierText,
  type TierBasis,
  type TierConfig,
  type TierMode,
} from "@/lib/invoice-pricing";

/** Format angka gaya Indonesia untuk kolom angka (koma desimal, tanpa nol di belakang). */
export function fmtDec(n: number, digits = 4): string {
  if (!Number.isFinite(n) || n === 0) return "";
  return String(Number(n.toFixed(digits))).replace(".", ",");
}

/* ------------------------------------------------------------------ */
/* Kalkulator m² (diporting dari app lama)                              */
/* ------------------------------------------------------------------ */
export function M2CalcModal({
  rowLabel,
  onApply,
  onClose,
}: {
  rowLabel: string;
  onApply: (m2: number) => void;
  onClose: () => void;
}) {
  const [unit, setUnit] = useState<"cm" | "m">("cm");
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const factor = unit === "cm" ? 1 / 10000 : 1;
  const result = parseLooseNumber(w) * parseLooseNumber(h) * factor;

  return (
    <div className="ppi-modal-back" onClick={onClose} role="dialog" aria-modal="true" aria-label="Kalkulator meter persegi">
      <div className="ppi-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-extrabold"><Calculator size={16} className="text-teal-600" /> Kalkulator m²</p>
            <p className="text-[11px] text-slate-500">Untuk: {rowLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="ppi-icon-btn" aria-label="Tutup"><X size={14} /></button>
        </div>
        <div className="ppi-seg mb-3">
          {(["cm", "m"] as const).map((u) => (
            <button key={u} type="button" className={unit === u ? "on" : ""} onClick={() => setUnit(u)}>{u}</button>
          ))}
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold">
            <span className="w-16 shrink-0">Lebar</span>
            <input autoFocus value={w} onChange={(e) => setW(e.target.value)} inputMode="decimal" placeholder="0" className="ppi-in boxed ppi-num" />
            <span className="w-6 text-slate-500">{unit}</span>
          </label>
          <label className="flex items-center gap-2 text-xs font-bold">
            <span className="w-16 shrink-0">Panjang</span>
            <input value={h} onChange={(e) => setH(e.target.value)} inputMode="decimal" placeholder="0" className="ppi-in boxed ppi-num" />
            <span className="w-6 text-slate-500">{unit}</span>
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-teal-50 px-3 py-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-700">Hasil</span>
          <span className="text-base font-extrabold text-teal-800">{(fmtDec(result, 4) || "0,00")} m²</span>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600">Batal</button>
          <button
            type="button"
            disabled={result <= 0}
            onClick={() => onApply(result)}
            className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            Terapkan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor harga bertingkat + simulasi (diporting dari app lama)         */
/* ------------------------------------------------------------------ */
export function TierModal({
  initial,
  basePrice,
  areaM2,
  qty,
  onSave,
  onClear,
  onClose,
}: {
  initial: TierConfig | null;
  basePrice: number;
  areaM2: number;
  qty: number;
  onSave: (cfg: TierConfig | null) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial ? initial.list.map((t) => `${t.min}=${t.price}`).join("\n") : "");
  const [mode, setMode] = useState<TierMode>(initial?.mode ?? "flat");
  const [basis, setBasis] = useState<TierBasis>(initial?.basis ?? "qty");

  const cfg: TierConfig = useMemo(() => ({ mode, basis, list: parseTierText(text).list }), [text, mode, basis]);

  const sims = useMemo(() => {
    if (!cfg.list.length) return [];
    const area = areaM2 > 0 ? areaM2 : 1;
    const toQty = (units: number) => (basis === "m2" ? Math.max(1, Math.ceil(units / area)) : units);
    const samples = new Set<number>([1, toQty(cfg.list[0].min) - 1, ...cfg.list.map((t) => toQty(t.min))]);
    if (qty > 0) samples.add(qty);
    return Array.from(samples)
      .filter((q) => q >= 1)
      .sort((a, b) => a - b)
      .slice(0, 7)
      .map((q) => {
        const p = computeRowPricing({ qty: q, areaM2, basePrice, tiers: cfg });
        return { q, unit: p.unitPrice, amount: p.amount, label: p.label };
      });
  }, [cfg, areaM2, basePrice, qty, basis]);

  return (
    <div className="ppi-modal-back" onClick={onClose} role="dialog" aria-modal="true" aria-label="Harga bertingkat">
      <div className="ppi-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="text-sm font-extrabold">Harga Bertingkat</p>
          <button type="button" onClick={onClose} className="ppi-icon-btn" aria-label="Tutup"><X size={14} /></button>
        </div>
        <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
          Satu baris per tier: <b>minimal = harga</b>. Contoh: <b>2=8000</b>, <b>11=7000</b>. Kolom HARGA tetap jadi harga dasar dan tidak tertimpa.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={"2=8000\n11=7000\n51=6500"}
          className="ppi-in boxed font-mono text-xs"
        />
        <p className="ppi-label mt-3">Mode perhitungan</p>
        <div className="ppi-seg">
          <button type="button" className={mode === "flat" ? "on" : ""} onClick={() => setMode("flat")}>Seragam</button>
          <button type="button" className={mode === "graduated" ? "on" : ""} onClick={() => setMode("graduated")}>Progresif</button>
        </div>
        <p className="mt-1 text-[10.5px] text-slate-500">
          {mode === "flat" ? "Seluruh jumlah memakai harga tier yang tercapai." : "Tiap \"tangga\" dihitung dengan harganya sendiri."}
        </p>
        <p className="ppi-label mt-3">Basis tingkatan</p>
        <div className="ppi-seg">
          <button type="button" className={basis === "qty" ? "on" : ""} onClick={() => setBasis("qty")}>Qty (pcs)</button>
          <button type="button" className={basis === "m2" ? "on" : ""} onClick={() => setBasis("m2")}>Total m²</button>
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-600">
          {sims.length === 0 ? (
            "Masukkan tier untuk melihat simulasi."
          ) : (
            <ul className="space-y-0.5">
              {sims.map((s) => (
                <li key={s.q} className="flex justify-between gap-2">
                  <span>qty {s.q} · @ {formatRupiah(Math.round(s.unit))}{s.label ? ` (${s.label})` : ""}</span>
                  <b className="shrink-0">{formatRupiah(s.amount)}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClear} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600">Hapus</button>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600">Batal</button>
          <button type="button" onClick={() => onSave(cfg.list.length ? cfg : null)} className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white">Simpan</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Jendela Data Customer                                               */
/* ------------------------------------------------------------------ */
export function CustomerModal({
  names,
  phones,
  name,
  phone,
  onSave,
  onClose,
}: {
  names: string[];
  phones: Record<string, string>;
  name: string;
  phone: string;
  onSave: (name: string, phone: string) => void;
  onClose: () => void;
}) {
  const [n, setN] = useState(name);
  const [p, setP] = useState(phone);
  const q = n.trim().toLowerCase();
  const suggestions = q ? names.filter((x) => x.toLowerCase().includes(q) && x.toLowerCase() !== q).slice(0, 6) : [];

  function pick(value: string) {
    setN(value);
    const known = phones[value.toLowerCase()];
    if (known && !p.trim()) setP(known);
  }

  return (
    <div className="ppi-modal-back" onClick={onClose} role="dialog" aria-modal="true" aria-label="Data customer">
      <div className="ppi-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <p className="text-sm font-extrabold">Data Customer</p>
          <button type="button" onClick={onClose} className="ppi-icon-btn" aria-label="Tutup"><X size={14} /></button>
        </div>
        <label className="block">
          <span className="ppi-label">Nama customer</span>
          <input autoFocus value={n} onChange={(e) => setN(e.target.value)} placeholder="Nama customer" autoComplete="off" className="ppi-in boxed" />
        </label>
        {suggestions.length ? (
          <ul className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-sm">
            {suggestions.map((s) => (
              <li key={s}>
                <button type="button" onClick={() => pick(s)} className="block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-teal-50">{s}</button>
              </li>
            ))}
          </ul>
        ) : null}
        <label className="mt-3 block">
          <span className="ppi-label">No. WhatsApp (opsional)</span>
          <input value={p} onChange={(e) => setP(e.target.value)} inputMode="tel" placeholder="08xx xxxx xxxx" autoComplete="off" className="ppi-in boxed" />
        </label>
        <p className="mt-2 text-[11px] text-slate-500">Nama baru otomatis jadi pelanggan baru di daftar Pelanggan PrintFlow.</p>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600">Batal</button>
          <button type="button" onClick={() => onSave(n.trim(), p.trim())} className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white">Simpan</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tanya "Pembayaran sudah diterima?" saat Terbitkan                    */
/* ------------------------------------------------------------------ */
export function AskPaidModal({
  total,
  onFull,
  onLater,
  onClose,
}: {
  total: number;
  onFull: () => void;
  onLater: () => void;
  onClose: () => void;
}) {
  return (
    <div className="ppi-modal-back" onClick={onClose} role="dialog" aria-modal="true" aria-label="Konfirmasi pembayaran">
      <div className="ppi-modal" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-extrabold">Pembayaran sudah diterima?</p>
        <p className="mt-1 text-xs text-slate-500">Total {formatRupiah(total)}. Kalau sudah dibayar penuh, invoice langsung dicatat LUNAS.</p>
        <div className="mt-4 grid gap-2">
          <button type="button" onClick={onFull} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white">Sudah dibayar penuh</button>
          <button type="button" onClick={onLater} className="rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white">Belum / bayar nanti</button>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-600">Batal</button>
        </div>
      </div>
    </div>
  );
}
