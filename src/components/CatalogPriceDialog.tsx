"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Wallet, X } from "lucide-react";
import type { PricePreset } from "@/db/schema";
import { MAX_RUPIAH } from "@/lib/invoice-pricing";

/** Satu baris riwayat dari /api/invoice-products/[id]/price-history. */
type HistRow = { date: string; number: string | null; customer: string; invoiceId: number; unitPrice: number; qty: number; amount: number };

/** Maksimum baris riwayat yang ditampilkan di dialog (server membatasi 6). */
const HISTORY_LIMIT = 6;

function thousands(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d ? Number(d).toLocaleString("id-ID") : "";
}

function tgl(s: string): string {
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" });
}

/**
 * Dialog "Set Harga" untuk produk dengan HARGA FLEKSIBEL (mis. jasa desain/setting yang
 * harganya tergantung kondisi). Dipanggil dari CatalogPicker saat kartu produk fleksibel
 * diklik, menggantikan penambahan baris langsung. Isinya:
 *  - preset harga dari owner (klik = harga terisi),
 *  - input harga manual (selalu boleh berubah per transaksi),
 *  - catatan opsional yang menggantikan keterangan produk di baris invoice,
 *  - riwayat harga terakhir dari invoice terbit sebagai acuan operator.
 */
export function CatalogSetPriceDialog({
  productId,
  name,
  baseDescription,
  presets,
  onClose,
  onConfirm,
}: {
  productId: number;
  /** Nama lengkap yang ditulis ke invoice (induk + varian). */
  name: string;
  baseDescription: string | null;
  presets: PricePreset[];
  onClose: () => void;
  onConfirm: (price: number, note: string | null) => void;
}) {
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [presetOn, setPresetOn] = useState<number | null>(null);
  const [hist, setHist] = useState<{ loading: boolean; rows: HistRow[]; failed: boolean }>({ loading: true, rows: [], failed: false });
  /* Prefill harga dari riwayat terbaru hanya sampai operator mulai mengetik sendiri. */
  const touched = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/invoice-products/${productId}/price-history?name=${encodeURIComponent(name)}`);
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: { rows?: HistRow[] } };
        if (alive) setHist({ loading: false, failed: !json.ok, rows: json.data?.rows ?? [] });
      } catch {
        if (alive) setHist({ loading: false, failed: true, rows: [] });
      }
    })();
    return () => {
      alive = false;
    };
  }, [productId, name]);

  useEffect(() => {
    if (!hist.loading && hist.rows.length && !touched.current && price === "") {
      setPrice(thousands(String(Math.round(hist.rows[0].unitPrice))));
    }
  }, [hist, price]);

  const priceNum = Number(price.replace(/\D/g, ""));
  const ready = priceNum > 0 && priceNum <= MAX_RUPIAH;
  const seen = hist.rows.slice(0, HISTORY_LIMIT);

  return (
    <div className="ppi-modal-back" onClick={onClose} role="dialog" aria-modal="true" aria-label="Set harga produk fleksibel">
      <div className="ppi-modal" style={{ maxWidth: 430 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-extrabold">
            <Wallet size={15} className="text-indigo-600" /> Set Harga
          </p>
          <button type="button" onClick={onClose} className="ppi-icon-btn" aria-label="Tutup"><X size={14} /></button>
        </div>
        <p className="mb-1 break-words text-[12.5px] font-bold text-[color:var(--pf-ink)]">{name}</p>
        <p className="mb-3 text-[11px] text-slate-500">
          Produk ini tanpa harga baku — ketik harga sesuai kondisi sekarang, atau pakai preset di bawah.
        </p>

        {presets.length ? (
          <div className="mb-2" role="group" aria-label="Preset harga">
            <span className="ppi-label">Preset harga owner</span>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p, i) => {
                const on = presetOn === i;
                return (
                  <button
                    key={`${p.label}-${i}`}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setPrice(thousands(String(p.price)));
                      setPresetOn(i);
                      touched.current = true;
                    }}
                    className={`chip px-2.5 py-1.5 text-[11px] font-semibold transition ${
                      on
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 text-[color:var(--pf-ink-2)] hover:border-indigo-400 hover:text-indigo-700"
                    }`}
                  >
                    {p.label}
                    <span className={on ? "ml-1 font-bold" : "ml-1 font-bold text-teal-700 dark:text-teal-300"}>{thousands(String(p.price))}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <label className="block"><span className="ppi-label">Harga untuk transaksi ini (Rp) *</span>
          <input
            value={price}
            onChange={(e) => {
              setPrice(thousands(e.target.value));
              setPresetOn(null);
              touched.current = true;
            }}
            inputMode="numeric"
            className="ppi-in boxed ppi-num"
            style={{ fontSize: 15, fontWeight: 700 }}
            placeholder="0"
            autoFocus
          />
        </label>

        <label className="mt-2 block"><span className="ppi-label">Catatan (opsional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            className="ppi-in boxed"
            placeholder={baseDescription ? `Kosong = pakai keterangan produk: "${baseDescription}"` : "mis. desain ulang, burn, dsb."}
          />
        </label>
        <p className="mt-1 text-[11px] text-slate-500">Catatan ini ditulis di baris invoice (menggantikan keterangan produk) — berguna untuk mencatat kondisi harga.</p>

        <div className="mt-3">
          <span className="ppi-label">Riwayat harga terakhir</span>
          {hist.loading ? (
            <p className="flex items-center gap-1.5 py-2 text-[11px] text-slate-500"><Loader2 size={12} className="animate-spin" /> Memuat riwayat…</p>
          ) : seen.length ? (
            <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                    <th className="py-1.5 pl-2.5 pr-2 font-semibold">Tgl</th>
                    <th className="py-1.5 pr-2 font-semibold">Invoice</th>
                    <th className="py-1.5 pr-2.5 text-right font-semibold">Harga satuan</th>
                  </tr>
                </thead>
                <tbody>
                  {seen.map((r, i) => (
                    <tr key={`${r.invoiceId}-${r.number ?? ""}-${i}`} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="py-1.5 pl-2.5 pr-2 whitespace-nowrap text-slate-500">{tgl(r.date)}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap font-semibold text-[color:var(--pf-ink-2)]" title={`${r.customer} · qty ${r.qty}`}>
                        {r.number ?? "—"}
                      </td>
                      <td className="py-1.5 pr-2.5 text-right whitespace-nowrap font-bold text-teal-700 dark:text-teal-300">
                        {thousands(String(Math.round(r.unitPrice)))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-1.5 text-[11px] text-slate-500">{hist.failed ? "Riwayat tidak bisa dimuat saat ini." : "Belum ada transaksi sebelumnya untuk produk ini."}</p>
          )}
        </div>

        {price.trim() && !ready ? <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">Isi harga (di atas 0) dulu ya.</p> : null}

        <div className="mt-3 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600">Batal</button>
          <button
            type="button"
            onClick={() => ready && onConfirm(priceNum, note.trim() || null)}
            disabled={!ready}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            <Wallet size={13} /> Tambah ke Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
