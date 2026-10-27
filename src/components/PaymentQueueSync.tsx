"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { formatRupiah } from "@/lib/domain";
import { flushQueue, parseQueue, patchQueueItem, readRaw, removeFromQueue, subscribeQueue } from "@/lib/payment-queue";

/**
 * PENGIRIM ANTREAN PEMBAYARAN (dipasang sekali di layout)
 * - Mengirim antrean otomatis: saat aplikasi dibuka, saat kembali online, saat aplikasi aktif lagi, dan tiap 15 detik.
 * - Chip kecil muncul HANYA bila ada pembayaran yang menunggu / perlu ditinjau; klik untuk melihat daftarnya.
 */
export function PaymentQueueSync() {
  const router = useRouter();
  const raw = useSyncExternalStore(subscribeQueue, readRaw, () => "[]");
  const items = useMemo(() => parseQueue(raw), [raw]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);

  const pending = items.filter((x) => x.status === "pending").length;
  const failed = items.filter((x) => x.status === "failed").length;

  const tick = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    if (!parseQueue(readRaw()).some((x) => x.status === "pending")) return;
    setBusy(true);
    try {
      const r = await flushQueue();
      setNeedLogin(r.needLogin);
      if (r.sent > 0) router.refresh();
    } finally {
      setBusy(false);
    }
  }, [router]);

  useEffect(() => {
    const first = setTimeout(() => void tick(), 1200);
    const timer = setInterval(() => void tick(), 15_000);
    const onOnline = () => void tick();
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tick]);

  if (!items.length) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed bottom-24 left-3 z-[60] flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold shadow-lg md:bottom-5 ${
          failed ? "bg-rose-600 text-white" : "bg-amber-400 text-amber-950"
        }`}
        aria-label="Pembayaran menunggu dikirim"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <CloudOff size={14} />}
        {pending ? `${pending} pembayaran menunggu koneksi` : null}
        {pending && failed ? " · " : null}
        {failed ? `${failed} perlu ditinjau` : null}
      </button>

      {open ? (
        <div className="ppi-modal-back" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Antrean pembayaran">
          <div className="ppi-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold">Pembayaran di perangkat ini</p>
                <p className="text-[11px] text-slate-500">Disimpan di HP/komputer ini dan dikirim otomatis begitu ada internet. Tidak akan tercatat dobel.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="ppi-icon-btn" aria-label="Tutup"><X size={14} /></button>
            </div>
            {needLogin ? <p className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">Sesi login habis. Login ulang dulu, lalu pembayaran terkirim otomatis.</p> : null}
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.ref} className={`rounded-xl border p-2.5 text-xs ${it.status === "failed" ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">{it.label}</p>
                      <p className="text-slate-600">
                        {it.kind === "dp" ? "DP" : "Bayar"} {formatRupiah(it.amount)} · {it.method}
                      </p>
                      <p className="text-[10.5px] text-slate-400">{new Date(it.paidAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{it.note ? ` · ${it.note}` : ""}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${it.status === "failed" ? "bg-rose-600 text-white" : "bg-amber-200 text-amber-900"}`}>
                      {it.status === "failed" ? "Perlu ditinjau" : "Menunggu"}
                    </span>
                  </div>
                  {it.status === "failed" ? <p className="mt-1 break-words text-[11px] font-semibold text-rose-700">{it.error}</p> : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {it.status === "failed" && it.code === "KELEBIHAN_BAYAR" ? (
                      <button type="button" onClick={() => { patchQueueItem(it.ref, { status: "pending", confirmOverpay: true, error: undefined, code: undefined }); void tick(); }} className="min-h-10 rounded-lg bg-rose-600 px-3 text-[11px] font-bold text-white">
                        Kirim sebagai kelebihan bayar
                      </button>
                    ) : null}
                    {it.status === "failed" && it.code !== "KELEBIHAN_BAYAR" ? (
                      <button type="button" onClick={() => { patchQueueItem(it.ref, { status: "pending", error: undefined, code: undefined }); void tick(); }} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-300 px-3 text-[11px] font-bold text-slate-700">
                        <RefreshCw size={11} /> Coba lagi
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => { if (confirm(`Buang pembayaran ${formatRupiah(it.amount)} ini dari antrean? Pembayaran TIDAK akan tercatat.`)) removeFromQueue(it.ref); }}
                      /* ml-auto: tombol Buang (menghapus catatan pembayaran)
                         didorong ke kanan supaya tidak menempel di sebelah
                         "Coba lagi". Dulu keduanya berdempetan dengan tinggi
                         cuma ~24px - mudah salah ketuk, apalagi justru saat
                         jaringannya bermasalah. min-h-10 = 40px, di atas
                         batas bawah 44px yang disarankan untuk sentuhan. */
                      className="ml-auto inline-flex min-h-10 items-center gap-1 rounded-lg border border-rose-200 px-3 text-[11px] font-bold text-rose-600"
                    >
                      <Trash2 size={11} /> Buang
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => void tick()} disabled={busy || !pending} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Kirim sekarang
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-600">Tutup</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
