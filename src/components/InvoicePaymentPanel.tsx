"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Banknote, Loader2, Plus, Undo2 } from "lucide-react";
import { DateFieldID } from "@/components/DateFieldID";
import { Select } from "@/components/Select";
import { formatDateTimeID, formatRupiah } from "@/lib/domain";
import { PAY_METHODS, parseLooseNumber } from "@/lib/invoice-pricing";

export type PanelPayment = {
  id: number;
  kind: string;
  amount: number;
  method: string;
  paidAt: string;
  note: string | null;
  createdBy: string;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
};

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/**
 * PANEL PEMBAYARAN
 * Riwayat DP/cicilan + form "Catat Pembayaran".
 * Setiap percobaan punya kode unik (clientRef). Kalau tombol tertekan dua kali atau
 * sinyal putus lalu dicoba lagi, server mengenali kode yang sama dan TIDAK mencatat
 * dobel. Kode baru dibuat hanya setelah pembayaran benar-benar tercatat.
 */
export function InvoicePaymentPanel({
  invoiceId,
  status,
  total,
  paid,
  remaining,
  payments,
  isOwner,
  today,
  defaultMethod,
}: {
  invoiceId: number;
  status: string;
  total: number;
  paid: number;
  remaining: number;
  payments: PanelPayment[];
  isOwner: boolean;
  today: string;
  defaultMethod: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(PAY_METHODS.includes(defaultMethod as (typeof PAY_METHODS)[number]) ? defaultMethod : "Transfer");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiding, setVoiding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const clientRef = useRef(uuid());

  const canPay = status === "terbit";
  const value = Math.round(parseLooseNumber(amount));

  async function submit() {
    setError(null);
    setNotice(null);
    if (value <= 0) return setError("Isi nominal pembayaran dulu.");
    setBusy(true);
    try {
      const send = async (confirmOverpay: boolean) => {
        const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: value,
            method,
            note,
            // Tanggal hari ini = pakai jam server saat ini; tanggal lain = tengah hari WIB pada tanggal itu.
            paidAt: date && date !== today ? `${date}T12:00:00+07:00` : undefined,
            clientRef: clientRef.current,
            confirmOverpay,
          }),
        });
        return (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          code?: string;
          duplicate?: boolean;
        };
      };

      let json = await send(false);
      if (!json.ok && json.code === "KELEBIHAN_BAYAR") {
        if (!confirm(`${json.error}\n\nTetap catat sebagai kelebihan bayar?`)) return;
        json = await send(true);
      }
      if (!json.ok) {
        setError(json.error ?? "Gagal mencatat pembayaran. Coba lagi.");
        return;
      }
      setNotice(json.duplicate ? "Pembayaran ini sudah tercatat sebelumnya (tidak dicatat dobel)." : "Pembayaran tercatat.");
      setAmount("");
      setNote("");
      setDate(today);
      clientRef.current = uuid();
      router.refresh();
    } catch {
      setError("Koneksi terputus. Cek internet lalu tekan Catat lagi. Aman, pembayaran tidak akan tercatat dobel.");
    } finally {
      setBusy(false);
    }
  }

  async function voidPayment(p: PanelPayment) {
    const reason = prompt(`Alasan membatalkan pembayaran ${formatRupiah(p.amount)} (wajib):`)?.trim();
    if (!reason) return;
    if (!confirm(`Batalkan pembayaran ${formatRupiah(p.amount)} (${p.method})? Catatannya tetap tersimpan sebagai riwayat.`)) return;
    setVoiding(p.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments/${p.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!json.ok) return setError(json.error ?? "Gagal membatalkan pembayaran.");
      setNotice("Pembayaran dibatalkan.");
      router.refresh();
    } catch {
      setError("Koneksi terputus. Coba lagi.");
    } finally {
      setVoiding(null);
    }
  }

  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  return (
    <section className="card space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Banknote size={18} className="text-teal-600" />
        <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Pembayaran</h2>
      </div>

      <div>
        <div className="flex items-end justify-between gap-2 text-sm">
          <span className="text-slate-500">Terbayar <b className="text-emerald-700">{formatRupiah(paid)}</b> dari {formatRupiah(total)}</span>
          <span className={`font-bold ${remaining > 0 ? "text-rose-600" : "text-emerald-700"}`}>
            {remaining > 0 ? `Sisa ${formatRupiah(remaining)}` : "Lunas"}
          </span>
        </div>
        <div className="progress-track mt-1.5">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {payments.length === 0 ? (
        <p className="text-xs text-slate-400">Belum ada pembayaran.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {payments.map((p) => (
            <li key={p.id} className={`flex items-start justify-between gap-2 py-2 ${p.voidedAt ? "opacity-60" : ""}`}>
              <div className="min-w-0 text-xs">
                <p className={`font-semibold text-[color:var(--pf-ink)] ${p.voidedAt ? "line-through" : ""}`}>
                  {p.kind === "dp" ? "DP" : "Bayar"} · {formatRupiah(p.amount)} · {p.method}
                </p>
                <p className="text-slate-500">{formatDateTimeID(p.paidAt)} · dicatat {p.createdBy}</p>
                {p.note ? <p className="break-words text-slate-500">{p.note}</p> : null}
                {p.voidedAt ? <p className="break-words font-semibold text-rose-600">Dibatalkan {p.voidedBy ? `oleh ${p.voidedBy}` : ""}: {p.voidReason}</p> : null}
              </div>
              {isOwner && !p.voidedAt && status !== "batal" ? (
                <button
                  type="button"
                  disabled={voiding !== null}
                  onClick={() => void voidPayment(p)}
                  className="btn-ghost shrink-0 px-2 py-1 text-[11px] text-rose-600"
                >
                  {voiding === p.id ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />} Batalkan
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canPay ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/30">
          <p className="text-xs font-bold text-slate-600">Catat pembayaran</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="min-w-0 sm:col-span-2">
              <span className="label">Nominal (Rp)</span>
              <div className="flex gap-2">
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="input min-w-0 flex-1" placeholder="0" />
                {remaining > 0 ? (
                  <button type="button" onClick={() => setAmount(String(remaining))} className="btn-secondary shrink-0 px-3 text-xs">
                    Lunasi sisa
                  </button>
                ) : null}
              </div>
              {remaining > 0 && value > 0 && value < remaining ? (
                <span className="mt-1 block text-[11px] text-slate-500">Sisa setelah ini: {formatRupiah(remaining - value)}</span>
              ) : null}
            </label>
            <label className="min-w-0">
              <span className="label">Metode</span>
              <Select value={method} onChange={(e) => setMethod(e.target.value)} className="input min-w-0">
                {PAY_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </label>
            <label className="min-w-0">
              <span className="label">Tanggal bayar</span>
              <DateFieldID value={date} onChange={setDate} className="input min-w-0" />
            </label>
            <label className="min-w-0 sm:col-span-2">
              <span className="label">Catatan (opsional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="input min-w-0" placeholder="mis. cicilan ke-2, transfer BCA" />
            </label>
          </div>
          <button type="button" disabled={busy} onClick={() => void submit()} className="btn-primary w-full sm:w-auto">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Catat Pembayaran
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          {status === "draft" ? "Terbitkan invoice dulu sebelum mencatat pembayaran." : "Invoice dibatalkan, pembayaran tidak bisa ditambah."}
        </p>
      )}

      {error ? (
        <p className="flex items-start gap-2 break-words rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : null}
      {notice ? <p className="break-words rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{notice}</p> : null}
    </section>
  );
}
