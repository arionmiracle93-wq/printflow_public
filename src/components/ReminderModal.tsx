"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, MessageCircle, X } from "lucide-react";
import { formatRupiah } from "@/lib/domain";
import { TONES, buildReminderMessage, type ReminderCtx, type ReminderTone } from "@/lib/invoice-reminder";
import { formatWhatsAppNumber } from "@/lib/invoice-share";

/** Nama kejadian untuk membuka jendela Tagih dari tombol mana pun di halaman. */
export const OPEN_REMINDER_EVENT = "pf-open-reminder";

/**
 * JENDELA PENGINGAT TAGIHAN (diporting dari app lama)
 * Menyusun pesan penagihan (3 nada: Halus / Biasa / Tegas) dari data invoice, bisa diedit,
 * lalu dibuka di WhatsApp ke nomor pelanggan. Dipasang SATU kali per halaman dan dibuka lewat kejadian
 * OPEN_REMINDER_EVENT, jadi tombol di sidebar maupun di baris HP memakai jendela yang sama.
 */
export function ReminderModalHost({
  invoiceId,
  ctx,
  initialPhone,
  autoOpen = false,
}: {
  invoiceId: number;
  ctx: ReminderCtx;
  initialPhone: string;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [tone, setTone] = useState<ReminderTone>("halus");
  const [message, setMessage] = useState(() => buildReminderMessage(ctx, "halus"));
  const [phone, setPhone] = useState(initialPhone);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setNotice(null);
      setError(null);
    };
    window.addEventListener(OPEN_REMINDER_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_REMINDER_EVENT, onOpen);
  }, []);

  if (!open) return null;

  function chooseTone(next: ReminderTone) {
    setTone(next);
    setMessage(buildReminderMessage(ctx, next)); // ganti nada = pesan disusun ulang (aturan app lama)
  }

  async function copy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(message);
      setNotice("Pesan disalin.");
    } catch {
      window.prompt("Salin manual:", message);
    }
  }

  function send() {
    setError(null);
    setNotice(null);
    const number = formatWhatsAppNumber(phone);
    if (!number || number.length < 10) return setError("Nomor WhatsApp pelanggan belum valid.");
    // Buka WhatsApp DULU (di dalam sentuhan pengguna) supaya tidak diblokir browser.
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    setBusy(true);
    fetch(`/api/invoices/${invoiceId}/remind`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, tone }),
    })
      .then((r) => r.json().catch(() => ({})))
      .then((j: { ok?: boolean; error?: string }) => {
        if (j.ok) {
          setNotice("WhatsApp dibuka. Nomor pelanggan tersimpan untuk lain waktu.");
          setOpen(false);
        } else setError(j.error ?? "WhatsApp terbuka, tapi catatan pengingat gagal disimpan.");
      })
      .catch(() => setError("WhatsApp terbuka, tapi catatan pengingat gagal disimpan."))
      .finally(() => setBusy(false));
  }

  return (
    <div className="ppi-modal-back" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Pengingat tagihan">
      <div className="ppi-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-extrabold">Kirim Pengingat Tagihan</p>
            <p className="truncate text-xs font-bold text-slate-700">{ctx.customerName || "Tanpa nama customer"}</p>
            <p className="text-[11px] text-slate-500">
              {ctx.number} · Sisa {formatRupiah(ctx.base)}
              {ctx.due ? ` · ${ctx.due.label}` : ""}
            </p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="ppi-icon-btn" aria-label="Tutup">
            <X size={14} />
          </button>
        </div>

        <label className="block">
          <span className="ppi-label">No. WhatsApp pelanggan</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="08xx xxxx xxxx" className="ppi-in boxed" />
        </label>

        <p className="ppi-label mt-3">Nada pesan</p>
        <div className="ppi-seg">
          {TONES.map((t) => (
            <button key={t.key} type="button" className={tone === t.key ? "on" : ""} onClick={() => chooseTone(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        <label className="mt-3 block">
          <span className="ppi-label">Pesan (boleh diedit)</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={11} className="ppi-in boxed font-mono text-[11.5px]" />
        </label>

        {error ? <p className="mt-2 break-words rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700">{error}</p> : null}
        {notice ? <p className="mt-2 break-words rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700">{notice}</p> : null}

        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-600">
            <Copy size={13} /> Salin pesan
          </button>
          <button type="button" onClick={send} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />} Kirim lewat WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
