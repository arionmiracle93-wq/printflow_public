"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { statusMeta } from "@/lib/domain";

type ShareOrder = {
  id: number;
  code: string;
  title: string;
  customerName: string;
  status: string;
  dueDate: string;
  dueTime: string;
};

function buildMessage(order: ShareOrder, url: string): string {
  const meta = statusMeta(order.status);
  const selesai = order.status === "selesai";
  const lines = [
    `Halo ${order.customerName} 👋`,
    "",
    selesai
      ? `Pesanan Anda *${order.title}* sudah *SELESAI* ✅ dan siap diambil / dikirim.`
      : `Berikut kabar terbaru pesanan Anda di percetakan kami:`,
    "",
    `• No. pesanan : ${order.code}`,
    `• Pekerjaan   : ${order.title}`,
    `• Status      : ${meta.emoji} ${meta.label}`,
    selesai ? "" : `• Perkiraan selesai: ${order.dueDate} pukul ${order.dueTime}`,
    "",
    selesai
      ? "Silakan lihat foto hasilnya di tautan ini 👇"
      : "Anda bisa memantau progres & foto pesanan lewat tautan ini 👇",
    url,
    "",
    "Terima kasih sudah memesan 🙏",
  ];
  return lines.filter((l) => l !== undefined).join("\n");
}

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
    const t = await prepare();
    if (!t) return;
    const url = `${window.location.origin}/lacak/${t}`;
    const text = buildMessage(order, url);
    // Coba Web Share API dulu (bagus di HP Android: bisa pilih WhatsApp langsung)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `Pesanan ${order.code}`, text });
        return;
      } catch {
        /* pengguna membatalkan → lanjut ke opsi WhatsApp */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function copy() {
    const t = await prepare();
    if (!t) return;
    const url = `${window.location.origin}/lacak/${t}`;
    try {
      await navigator.clipboard.writeText(buildMessage(order, url));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Browser menolak akses clipboard. Silakan salin tautan secara manual.");
    }
  }

  return (
    <div className="card p-4">
      <h3 className="text-sm font-bold text-slate-900">💬 Kabari Pelanggan via WhatsApp</h3>
      <p className="mt-1 text-xs text-slate-500">
        Membuat tautan lacak (berisi status + foto) lalu menyiapkan pesan WhatsApp-nya. Pelanggan tidak perlu
        bertanya “pesanan saya sampai mana?”.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={share} disabled={busy} className="btn-primary">
          {busy ? "Menyiapkan…" : "📲 Kirim via WhatsApp"}
        </button>
        <button type="button" onClick={copy} disabled={busy} className="btn-ghost">
          {copied ? "✅ Pesan tersalin!" : "📋 Salin Teks Pesan"}
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
