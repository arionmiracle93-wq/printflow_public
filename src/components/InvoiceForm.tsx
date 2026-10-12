"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { ComboInput } from "@/components/ComboInput";
import { DateFieldID } from "@/components/DateFieldID";
import { Select } from "@/components/Select";
import { formatRupiah } from "@/lib/domain";
import {
  PAY_METHODS,
  computeInvoiceTotals,
  computeRowPricing,
  normalizeTiers,
  parseLooseNumber,
  parseTierText,
  tiersToText,
  type TierConfig,
} from "@/lib/invoice-pricing";

/**
 * FORM INVOICE (buat baru & edit)
 *
 * Angka di layar ini hanya PRATINJAU. Saat disimpan, server menghitung ulang
 * semuanya dengan rumus yang sama (src/lib/invoice-pricing.ts), jadi angka resmi
 * selalu dari server.
 */

export type FormCustomer = { id: number; name: string; phone: string | null };

export type FormInitial = {
  id?: number;
  version?: number;
  status?: "draft" | "terbit" | "batal";
  customerName: string;
  customerPhone: string;
  issueDate: string;
  dueDate: string;
  payMethod: string;
  discountRate: number;
  taxRate: number;
  notes: string;
  terms: string[];
  items: {
    productName: string;
    description: string;
    unit: string;
    qty: number;
    areaM2: number;
    basePrice: number;
    tiers: TierConfig | null;
  }[];
};

type ItemState = {
  key: number;
  productName: string;
  description: string;
  unit: string;
  qty: string;
  areaM2: string;
  basePrice: string;
  tiersText: string;
  showTier: boolean;
};

function numText(n: number): string {
  return n ? String(n).replace(".", ",") : "";
}

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return date.toISOString().slice(0, 10);
}

let keyCounter = 1;
function blankItem(): ItemState {
  return {
    key: keyCounter++,
    productName: "",
    description: "",
    unit: "pcs",
    qty: "1",
    areaM2: "",
    basePrice: "",
    tiersText: "",
    showTier: false,
  };
}

export function InvoiceForm({
  customers,
  defaults,
  initial,
}: {
  customers: FormCustomer[];
  defaults: { terms: string[]; dueDays: number; today: string };
  initial?: FormInitial;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const editingIssued = isEdit && initial?.status === "terbit";

  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(initial?.customerPhone ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? defaults.today);
  const [dueDate, setDueDate] = useState(
    initial ? initial.dueDate : defaults.dueDays > 0 ? addDays(defaults.today, defaults.dueDays) : "",
  );
  const [payMethod, setPayMethod] = useState(initial?.payMethod ?? "Transfer");
  const [discountRate, setDiscountRate] = useState(initial ? numText(initial.discountRate) : "");
  const [taxRate, setTaxRate] = useState(initial ? numText(initial.taxRate) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [termsText, setTermsText] = useState((initial ? initial.terms : defaults.terms).join("\n"));
  const [items, setItems] = useState<ItemState[]>(() =>
    initial?.items.length
      ? initial.items.map((it) => ({
          key: keyCounter++,
          productName: it.productName,
          description: it.description,
          unit: it.unit,
          qty: numText(it.qty),
          areaM2: numText(it.areaM2),
          basePrice: it.basePrice ? String(it.basePrice) : "",
          tiersText: it.tiers ? tiersToText(it.tiers) : "",
          showTier: Boolean(it.tiers?.list.length),
        }))
      : [blankItem()],
  );
  const [dpAmount, setDpAmount] = useState("");
  const [dpMethod, setDpMethod] = useState("Cash");
  const [busy, setBusy] = useState<null | "draft" | "terbit" | "simpan">(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  // Kode unik form ini: kalau tombol tertekan dua kali / sinyal putus-nyambung, server tidak membuat invoice dobel.
  const clientRef = useRef(uuid());

  const customerNames = useMemo(() => customers.map((c) => c.name), [customers]);

  const priced = useMemo(() => {
    const rows = items.map((it) => {
      const cfg = it.tiersText.trim() ? parseTierText(it.tiersText) : null;
      const p = computeRowPricing({
        qty: parseLooseNumber(it.qty),
        areaM2: parseLooseNumber(it.areaM2),
        basePrice: parseLooseNumber(it.basePrice),
        tiers: cfg,
      });
      return { pricing: p, tierCount: cfg?.list.length ?? 0 };
    });
    const totals = computeInvoiceTotals(
      rows.map((r) => r.pricing.amount),
      parseLooseNumber(discountRate),
      parseLooseNumber(taxRate),
    );
    return { rows, totals };
  }, [items, discountRate, taxRate]);

  const dp = Math.round(parseLooseNumber(dpAmount));

  function patchItem(key: number, patch: Partial<ItemState>) {
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function pickCustomer(name: string) {
    setCustomerName(name);
    const found = customers.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
    if (found?.phone && !customerPhone.trim()) setCustomerPhone(found.phone);
  }

  function buildPayload() {
    return {
      customerName,
      customerPhone,
      issueDate,
      dueDate: dueDate || null,
      payMethod,
      discountRate: parseLooseNumber(discountRate),
      taxRate: parseLooseNumber(taxRate),
      notes,
      terms: termsText.split(/\r?\n/).map((t) => t.trim()).filter(Boolean),
      items: items.map((it) => ({
        productName: it.productName,
        description: it.description,
        unit: it.unit || "pcs",
        qty: parseLooseNumber(it.qty),
        areaM2: parseLooseNumber(it.areaM2),
        basePrice: Math.round(parseLooseNumber(it.basePrice)),
        tiers: it.tiersText.trim() ? normalizeTiers(parseTierText(it.tiersText)) : null,
      })),
    };
  }

  async function call(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      code?: string;
      penjelasan?: string;
      data?: { invoice?: { id: number } };
    };
    return { res, json };
  }

  function fail(json: { error?: string; code?: string; penjelasan?: string }) {
    setConflict(json.code === "VERSI_BERBEDA");
    setError(json.error ?? json.penjelasan ?? "Gagal menyimpan invoice. Coba lagi sebentar lagi.");
  }

  async function submit(mode: "draft" | "terbit" | "simpan") {
    setError(null);
    setConflict(false);
    if (!customerName.trim()) return setError("Nama pelanggan wajib diisi.");
    if (!items.some((it) => it.productName.trim())) return setError("Isi minimal satu baris item.");
    if (mode === "terbit" && priced.totals.total <= 0) {
      return setError("Total masih Rp 0. Isi harga dulu sebelum menerbitkan.");
    }
    if (!isEdit && mode === "terbit" && dp > priced.totals.total) {
      return setError("DP tidak boleh lebih besar dari total invoice.");
    }

    setBusy(mode);
    try {
      const payload = buildPayload();
      let id = initial?.id;

      if (!isEdit) {
        const body = {
          ...payload,
          clientRef: clientRef.current,
          issue: mode === "terbit",
          dp: mode === "terbit" && dp > 0 ? { amount: dp, method: dpMethod, kind: "dp", clientRef: `${clientRef.current}-dp` } : undefined,
        };
        const { json } = await call("/api/invoices", "POST", body);
        if (!json.ok) return fail(json);
        id = json.data?.invoice?.id;
      } else {
        const { json } = await call(`/api/invoices/${initial!.id}`, "PATCH", { ...payload, version: initial!.version });
        if (!json.ok) return fail(json);
        if (mode === "terbit") {
          const issued = await call(`/api/invoices/${initial!.id}/issue`, "POST");
          if (!issued.json.ok) return fail(issued.json);
        }
      }
      router.push(`/invoice/${id}`);
      router.refresh();
    } catch {
      setError("Koneksi terputus. Cek internet lalu tekan tombolnya lagi. Aman, invoice tidak akan tercatat dobel.");
    } finally {
      setBusy(null);
    }
  }

  const { totals } = priced;

  return (
    <div className="space-y-4">
      {editingIssued ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          Invoice ini sudah terbit. Mengubah isi akan menghitung ulang total dan status bayar. Nomor invoice tetap.
        </p>
      ) : null}

      {/* Pelanggan & tanggal */}
      <section className="card grid gap-3 p-4 sm:grid-cols-2">
        <label className="min-w-0 sm:col-span-1">
          <span className="label">Pelanggan *</span>
          <ComboInput value={customerName} onChange={pickCustomer} options={customerNames} placeholder="Ketik nama pelanggan" className="input min-w-0" />
          <span className="mt-1 block text-[11px] text-slate-400">Nama baru otomatis jadi pelanggan baru.</span>
        </label>
        <label className="min-w-0">
          <span className="label">No. HP / WhatsApp</span>
          <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} inputMode="tel" className="input min-w-0" placeholder="08xxxxxxxxxx" />
        </label>
        <label className="min-w-0">
          <span className="label">Tanggal invoice</span>
          <DateFieldID value={issueDate} onChange={setIssueDate} className="input min-w-0" />
        </label>
        <label className="min-w-0">
          <span className="label">Jatuh tempo (opsional)</span>
          <DateFieldID value={dueDate} onChange={setDueDate} className="input min-w-0" />
        </label>
      </section>

      {/* Item */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Item</h2>
          <button type="button" onClick={() => setItems((l) => [...l, blankItem()])} className="btn-secondary px-3 py-1.5 text-xs">
            <Plus size={14} /> Tambah baris
          </button>
        </div>

        {items.map((it, index) => {
          const row = priced.rows[index];
          const tierLabel = row?.pricing.hasTier && row.pricing.qty > 0 ? row.pricing.label : "";
          return (
            <div key={it.key} className="card min-w-0 space-y-3 p-4">
              <div className="flex items-start gap-2">
                <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[11px] font-bold text-teal-700">{index + 1}</span>
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                  <label className="min-w-0 sm:col-span-2">
                    <span className="label">Produk *</span>
                    <input value={it.productName} onChange={(e) => patchItem(it.key, { productName: e.target.value })} className="input min-w-0" placeholder="mis. Spanduk Flexi 280gr" />
                  </label>
                  <label className="min-w-0 sm:col-span-2">
                    <span className="label">Keterangan (opsional)</span>
                    <input value={it.description} onChange={(e) => patchItem(it.key, { description: e.target.value })} className="input min-w-0" placeholder="ukuran, finishing, dsb." />
                  </label>
                  <label className="min-w-0">
                    <span className="label">Jumlah (qty) *</span>
                    <input value={it.qty} onChange={(e) => patchItem(it.key, { qty: e.target.value })} inputMode="decimal" className="input min-w-0" />
                  </label>
                  <label className="min-w-0">
                    <span className="label">Satuan</span>
                    <input value={it.unit} onChange={(e) => patchItem(it.key, { unit: e.target.value })} className="input min-w-0" placeholder="pcs, lembar, m2" />
                  </label>
                  <label className="min-w-0">
                    <span className="label">Luas per unit, m² (kosongkan jika bukan produk luas)</span>
                    <input value={it.areaM2} onChange={(e) => patchItem(it.key, { areaM2: e.target.value })} inputMode="decimal" className="input min-w-0" placeholder="mis. 3 atau 1,5" />
                  </label>
                  <label className="min-w-0">
                    <span className="label">Harga dasar (Rp, per unit atau per m²)</span>
                    <input value={it.basePrice} onChange={(e) => patchItem(it.key, { basePrice: e.target.value })} inputMode="decimal" className="input min-w-0" placeholder="mis. 20.000" />
                  </label>
                </div>
                {items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}
                    className="btn-ghost mt-1 shrink-0 px-2 py-1.5 text-rose-600"
                    aria-label={`Hapus baris ${index + 1}`}
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/30">
                <button
                  type="button"
                  onClick={() => patchItem(it.key, { showTier: !it.showTier })}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-600"
                >
                  <span>
                    Harga bertingkat (tier){row && row.tierCount > 0 ? ` · ${row.tierCount} tingkat aktif` : ""}
                  </span>
                  {it.showTier ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {it.showTier ? (
                  <div className="space-y-2 border-t border-slate-200 p-3 dark:border-slate-700">
                    <textarea
                      value={it.tiersText}
                      onChange={(e) => patchItem(it.key, { tiersText: e.target.value })}
                      rows={4}
                      className="input min-w-0 font-mono text-xs"
                      placeholder={"Satu tingkat per baris: jumlah=harga\n10=4000\n50=3500\n\nOpsional:\nmode=progresif\nbasis=m2"}
                    />
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      <b>10=4000</b> artinya mulai 10 unit, harganya Rp 4.000 per unit. Biasa: seluruh jumlah memakai harga tingkat yang
                      tercapai. <b>mode=progresif</b>: tiap &quot;tangga&quot; dihitung dengan harganya sendiri. <b>basis=m2</b>: jumlah tingkat dihitung dari
                      total m², bukan qty.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-500">
                  {row && row.pricing.amount > 0
                    ? `@ ${formatRupiah(Math.round(row.pricing.unitPrice))}${tierLabel ? ` (${tierLabel})` : ""}`
                    : "Isi qty dan harga untuk melihat jumlah"}
                </span>
                <span className="text-sm font-bold text-[color:var(--pf-ink)]">{formatRupiah(row?.pricing.amount ?? 0)}</span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Diskon, pajak, total */}
      <section className="card grid gap-3 p-4 sm:grid-cols-2">
        <label className="min-w-0">
          <span className="label">Diskon (%)</span>
          <input value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} inputMode="decimal" className="input min-w-0" placeholder="0" />
        </label>
        <label className="min-w-0">
          <span className="label">Pajak / PPN (%)</span>
          <input value={taxRate} onChange={(e) => setTaxRate(e.target.value)} inputMode="decimal" className="input min-w-0" placeholder="0" />
        </label>
        <label className="min-w-0">
          <span className="label">Metode bayar</span>
          <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="input min-w-0">
            {PAY_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </label>
        <div className="min-w-0 space-y-1 rounded-xl bg-slate-50/80 p-3 text-sm dark:bg-slate-800/40">
          <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatRupiah(totals.subtotal)}</span></div>
          {totals.discountAmount > 0 ? (
            <div className="flex justify-between text-slate-600"><span>Diskon {totals.discountRate}%</span><span>- {formatRupiah(totals.discountAmount)}</span></div>
          ) : null}
          {totals.taxAmount > 0 ? (
            <div className="flex justify-between text-slate-600"><span>Pajak {totals.taxRate}%</span><span>{formatRupiah(totals.taxAmount)}</span></div>
          ) : null}
          <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold text-[color:var(--pf-ink)] dark:border-slate-700">
            <span>Total</span><span>{formatRupiah(totals.total)}</span>
          </div>
        </div>
      </section>

      {/* DP awal (hanya saat buat baru) */}
      {!isEdit ? (
        <section className="card grid gap-3 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">DP awal (opsional)</h2>
            <p className="text-xs text-slate-500">Dicatat sebagai pembayaran pertama saat invoice diterbitkan. Cicilan berikutnya dicatat dari halaman detail.</p>
          </div>
          <label className="min-w-0">
            <span className="label">Nominal DP (Rp)</span>
            <input value={dpAmount} onChange={(e) => setDpAmount(e.target.value)} inputMode="decimal" className="input min-w-0" placeholder="0" />
          </label>
          <label className="min-w-0">
            <span className="label">Metode DP</span>
            <Select value={dpMethod} onChange={(e) => setDpMethod(e.target.value)} className="input min-w-0">
              {PAY_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </label>
          {dp > 0 && totals.total > 0 ? (
            <p className="text-xs text-slate-500 sm:col-span-2">Sisa setelah DP: <b>{formatRupiah(Math.max(0, totals.total - dp))}</b></p>
          ) : null}
        </section>
      ) : null}

      {/* Catatan & syarat */}
      <section className="card grid gap-3 p-4 sm:grid-cols-2">
        <label className="min-w-0">
          <span className="label">Catatan untuk pelanggan</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="input min-w-0" />
        </label>
        <label className="min-w-0">
          <span className="label">Syarat &amp; ketentuan (satu per baris)</span>
          <textarea value={termsText} onChange={(e) => setTermsText(e.target.value)} rows={4} className="input min-w-0" />
        </label>
      </section>

      {error ? (
        <div className="flex items-start gap-2 break-words rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p>{error}</p>
            {conflict ? (
              <button type="button" onClick={() => window.location.reload()} className="btn-secondary mt-2 px-3 py-1.5 text-xs">
                Muat ulang halaman
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="sticky bottom-20 z-10 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between md:bottom-3 dark:border-slate-700 dark:bg-[#0b1c28]/95">
        <p className="text-sm text-slate-500">
          Total <b className="text-[color:var(--pf-ink)]">{formatRupiah(totals.total)}</b>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {editingIssued ? (
            <button type="button" disabled={busy !== null} onClick={() => void submit("simpan")} className="btn-primary">
              {busy === "simpan" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Perubahan
            </button>
          ) : (
            <>
              <button type="button" disabled={busy !== null} onClick={() => void submit("draft")} className="btn-secondary">
                {busy === "draft" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Draft
              </button>
              <button type="button" disabled={busy !== null} onClick={() => void submit("terbit")} className="btn-primary">
                {busy === "terbit" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {isEdit ? "Simpan & Terbitkan" : "Terbitkan"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
