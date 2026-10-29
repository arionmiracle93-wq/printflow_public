"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, RotateCcw } from "lucide-react";
import { Select } from "@/components/Select";
import { formatDateTimeID, formatRupiah } from "@/lib/domain";
import { PAY_METHODS, parseLooseNumber } from "@/lib/invoice-pricing";

export type RefundPanelRow = {
  id: number;
  amount: number;
  method: string;
  reason: string;
  reference: string | null;
  status: string;
  requestedBy: string;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  completedBy: string | null;
  completedAt: string | null;
  paidOutAt: string | null;
};

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/* Chip status mengikuti gaya lencana modul invoice; tiap verdict punya warna
   yang sama artinya dengan kartu riwayat: kuning menunggu, biru disetujui,
   hijau terlaksana, merah ditolak. */
const STATUS_CHIP: Record<string, { label: string; className: string }> = {
  pending: { label: "Menunggu", className: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-400/10 dark:text-amber-300" },
  approved: { label: "Disetujui", className: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-400/10 dark:text-sky-300" },
  completed: { label: "Terkirim", className: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-400/10 dark:text-emerald-300" },
  rejected: { label: "Ditolak", className: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-400/10 dark:text-rose-300" },
};

function RefundStatusChip({ status }: { status: string }) {
  const chip = STATUS_CHIP[status] ?? null;
  if (!chip) return null;
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${chip.className}`}>{chip.label}</span>;
}

/**
 * PANEL REFUND
 * Riwayat pengembalian uang + form pengajuan. Pasangan panel Pembayaran:
 * uang MASUK tidak pernah diubah oleh refund (Mode A) — refund baru
 * bernilai sebagai uang KELUAR setelah Owner menandainya terkirim.
 *
 * Alurnya dua pintu sesuai PRD:
 *  1. Siapa saja yang punya akses invoice boleh MENGAYUKNAN (nominal tidak
 *     boleh melebihi sisa uang; pemeriksaan diamankan di server).
 *  2. Hanya Owner yang menyetujui / menolak / menandai terkirim —
 *     pemeriksaan di backend, tombol di UI hanya sepanjang muncul bila
 *     isOwner (bukan lapisan keamanannya).
 */
export function InvoiceRefundPanel({
  invoiceId,
  status,
  refundable,
  refunds,
  isOwner,
}: {
  invoiceId: number;
  status: string;
  /** Sisa uang yang masih boleh direfund — dihitung server (uang aktif − refund terikat). */
  refundable: number;
  refunds: RefundPanelRow[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Transfer");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /* Kode unik per pengajuan: dipakai server untuk menangkap kirim ganda.
     Dregenerasi setelah berhasil supaya pengajuan berikutnya punya kode baru. */
  const clientRef = useRef(uuid());

  const canSubmit = status === "terbit" || status === "batal";
  const buffer = Math.max(0, refundable);
  const value = Math.round(parseLooseNumber(amount));

  async function submit() {
    setError(null);
    setNotice(null);
    if (value <= 0) return setError("Isi nominal refund dulu.");
    if (!reason.trim()) return setError("Alasan refund wajib diisi.");
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: value,
          method,
          reason: reason.trim(),
          reference: method === "Cash" ? "" : reference.trim(),
          clientRef: clientRef.current,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        duplicate?: boolean;
      };
      if (!json.ok) return setError(json.error ?? "Gagal mengajukan refund.");
      setNotice(
        json.duplicate
          ? "Pengajuan ini sudah tercatat sebelumnya (tidak diajukan dobel)."
          : "Refund diajukan. Menunggu persetujuan Owner.",
      );
      setAmount("");
      setReason("");
      setReference("");
      clientRef.current = uuid();
      router.refresh();
    } catch {
      setError("Terjadi gangguan. Coba lagi sebentar lagi — pengajuan tidak akan tercatat dobel.");
    } finally {
      setBusy(false);
    }
  }

  async function step(r: RefundPanelRow, action: "approve" | "reject" | "complete") {
    setError(null);
    setNotice(null);
    let note = "";
    if (action === "reject") {
      note = prompt(`Alasan ${r.status === "approved" ? "membatalkan approval refund" : "menolak refund"} ${formatRupiah(r.amount)} (wajib):`)?.trim() ?? "";
      if (!note) return;
    }
    const confirmText =
      action === "approve"
        ? `Setujui refund ${formatRupiah(r.amount)}? Setelah disetujui, uang bisa ditandai terkirim.`
        : action === "complete"
          ? `Tandai uang refund ${formatRupiah(r.amount)} sudah terkirim ke pelanggan? Nominal ini masuk laporan uang keluar per hari ini (WIB).`
          : `Batalkan/tolak refund ${formatRupiah(r.amount)}? Alasan akan tersimpan di riwayat.`;
    if (!confirm(confirmText)) return;
    setBusyRow(r.id);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/refunds/${r.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!json.ok) return setError(json.error ?? "Gagal memproses refund.");
      setNotice(
        action === "approve"
          ? "Refund disetujui."
          : action === "complete"
            ? "Refund ditandai terkirim — sudah masuk laporan uang keluar."
            : r.status === "approved"
              ? "Approval refund dibatalkan."
              : "Refund ditolak.",
      );
      router.refresh();
    } catch {
      setError("Koneksi terputus. Coba lagi.");
    } finally {
      setBusyRow(null);
    }
  }

  return (
    <section className="card space-y-4 p-4">
      <div className="flex items-center gap-2">
        <RotateCcw size={18} className="text-rose-600" />
        <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Refund</h2>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Uang yang sudah masuk tidak berubah. Refund adalah catatan <b>uang keluar</b> yang ikut laporan setelah Owner
        menandainya terkirim. Yang masih boleh direfund:{" "}
        <b className={buffer > 0 ? "text-rose-700 dark:text-rose-400" : "text-slate-500"}>{formatRupiah(buffer)}</b>
      </p>

      {refunds.length === 0 ? (
        <p className="text-xs text-slate-400">Belum ada pengajuan refund.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {refunds.map((r) => {
            const ownerActions = isOwner && (r.status === "pending" || r.status === "approved");
            return (
              <li key={r.id} className="flex items-start justify-between gap-2 py-2">
                <div className="min-w-0 text-xs">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-[color:var(--pf-ink)]">
                      Refund · {formatRupiah(r.amount)} · {r.method}
                    </span>
                    <RefundStatusChip status={r.status} />
                  </p>
                  <p className="text-slate-500">
                    Diajukan {formatDateTimeID(r.createdAt)} · oleh {r.requestedBy}
                  </p>
                  {r.reason ? <p className="break-words text-slate-500">Alasan: {r.reason}</p> : null}
                  {r.reference ? <p className="break-all text-slate-500">Ref: <span className="font-mono font-semibold">{r.reference}</span></p> : null}
                  {r.decidedBy ? (
                    <p className="text-slate-500">
                      {r.status === "rejected" ? "Ditolak" : "Disetujui"} {formatDateTimeID(r.decidedAt ?? "")} · oleh {r.decidedBy}
                    </p>
                  ) : null}
                  {r.decisionNote ? <p className="break-words font-semibold text-rose-600">Catatan: {r.decisionNote}</p> : null}
                  {r.status === "completed" ? (
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                      Terkirim{r.paidOutAt ? ` per ${r.paidOutAt}` : ""}{r.completedBy ? ` · diaktifkan ${r.completedBy}` : ""}
                    </p>
                  ) : null}
                  {isOwner && r.status === "approved" ? (
                    <p className="mt-0.5 text-[10.5px] text-slate-400">Setelah unggah bukti transfer keluar, tekan “Tandai Terkirim”.</p>
                  ) : null}
                </div>
                {ownerActions ? (
                  <span className="flex shrink-0 items-center gap-1">
                    {r.status === "pending" ? (
                      <button
                        type="button"
                        disabled={busyRow !== null}
                        onClick={() => void step(r, "approve")}
                        className="btn-ghost px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-400"
                      >
                        {busyRow === r.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Setujui
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyRow !== null}
                        onClick={() => void step(r, "complete")}
                        className="btn-ghost px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-400"
                      >
                        {busyRow === r.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Tandai Terkirim
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyRow !== null}
                      onClick={() => void step(r, "reject")}
                      className="btn-ghost shrink-0 px-2 py-1 text-[11px] text-rose-600"
                    >
                      Tolak
                    </button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {canSubmit && buffer > 0 ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/30">
          <p className="text-xs font-bold text-slate-600">Ajukan refund</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="min-w-0 sm:col-span-2">
              <span className="label">Nominal (Rp)</span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="input min-w-0 flex-1" placeholder="0" />
                <button type="button" onClick={() => setAmount(String(buffer))} className="btn-secondary min-h-11 shrink-0 px-3 text-xs sm:min-h-0">
                  Semua sisa
                </button>
              </div>
              {value > 0 && value <= buffer ? (
                <span className="mt-1 block text-[11px] text-slate-500">
                  Sisa setelah ini: {formatRupiah(buffer - value)}
                </span>
              ) : null}
            </label>
            <label className="min-w-0">
              <span className="label">Metode keluar</span>
              <Select value={method} onChange={(e) => setMethod(e.target.value)} className="input min-w-0">
                {PAY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </label>
            {method !== "Cash" ? (
              <label className="min-w-0">
                <span className="label">No. referensi keluar (opsional)</span>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={60}
                  autoComplete="off"
                  className="input min-w-0 font-mono"
                  placeholder="mis. RRN / ID transfer keluar"
                />
              </label>
            ) : null}
            <label className="min-w-0 sm:col-span-2">
              <span className="label">Alasan (wajib)</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={400}
                className="input min-w-0"
                placeholder="mis. invoice salah, batal 5 dari 15 lembar, kelebihan bayar"
              />
            </label>
          </div>
          <button type="button" disabled={busy} onClick={() => void submit()} className="btn-primary w-full sm:w-auto">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />} Ajukan Refund
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          {buffer <= 0
            ? "Tidak ada uang yang masih bisa direfund."
            : status === "draft"
              ? "Terbitkan invoice dulu sebelum mengajukan refund."
              : "Pengajuan refund ditutup."}
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
