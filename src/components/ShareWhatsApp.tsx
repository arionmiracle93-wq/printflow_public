"use client";

import { Check, Copy, MessageCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildWhatsAppMessage, openWhatsAppShare, WHATSAPP_SHARE_WINDOW, type ShareOrder } from "@/lib/whatsapp-share";

export function ShareWhatsApp({ order, initialToken }: { order: ShareOrder; initialToken: string | null }) {
  const router = useRouter();
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function trackingUrl(): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return token ? `${origin}/lacak/${token}` : "";
  }

  async function prepare(): Promise<string | null> {
    setError(null);
    if (token) return token;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/share`, { method: "POST" });
      const json = (await res.json()) as { ok: boolean; token?: string; error?: string };
      if (!json.ok || !json.token) {
        setError(json.error ?? "Gagal membuat tautan lacak.");
        return null;
      }
      setToken(json.token);
      router.refresh();
      return json.token;
    } catch {
      setError("Tidak dapat menghubungi server.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    // Selalu siapkan (atau ambil kembali) tab WhatsApp yang sama, DULU — selagi
    // masih dalam konteks klik pengguna, sebelum ada `await` sama sekali.
    const popup = window.open("", WHATSAPP_SHARE_WINDOW);
    const t = await prepare();
    if (!t) return; // jangan tutup popup — bisa jadi itu tab WA yang sudah lama dipakai user
    const url = `${window.location.origin}/lacak/${t}`;
    const outcome = await openWhatsAppShare(order, url, popup);
    if (outcome === "copied") {
      setError("Pop-up diblokir browser. Pesannya sudah disalin — buka WhatsApp lalu tempel (paste) manual.");
    } else if (outcome === "failed") {
      setError("Tidak bisa membuka WhatsApp otomatis. Coba izinkan pop-up untuk situs ini di pengaturan browser.");
    }
  }

  async function copy() {
    const t = await prepare();
    if (!t) return;
    const url = `${window.location.origin}/lacak/${t}`;
    try {
      await navigator.clipboard.writeText(buildWhatsAppMessage(order, url));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Browser menolak akses clipboard. Silakan salin tautan secara manual.");
    }
  }

  return (
    <div className="card p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
        <MessageCircle size={16} /> Kabari Pelanggan via WhatsApp
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Membuat tautan lacak (berisi status + foto) lalu menyiapkan pesan WhatsApp-nya. Pelanggan tidak perlu
        bertanya “pesanan saya sampai mana?”.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={share} disabled={busy} className="btn-primary inline-flex items-center gap-1.5">
          {busy ? (
            "Menyiapkan…"
          ) : (
            <>
              <Send size={14} /> Kirim via WhatsApp
            </>
          )}
        </button>
        <button type="button" onClick={copy} disabled={busy} className="btn-ghost inline-flex items-center gap-1.5">
          {copied ? (
            <>
              <Check size={14} /> Pesan tersalin!
            </>
          ) : (
            <>
              <Copy size={14} /> Salin Teks Pesan
            </>
          )}
        </button>
      </div>

      {token ? (
        <p className="mt-2.5 break-all rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          Tautan lacak: <span className="font-semibold text-slate-700">{trackingUrl()}</span>
        </p>
      ) : (
        <p className="mt-2.5 text-[11px] text-slate-400">
          Tautan belum pernah dibuat. Nanti dibuat otomatis saat pertama kali menekan tombol di atas.
        </p>
      )}

      {error ? (
        <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
