"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { ensureTrackingUrl, openWhatsAppShare, WHATSAPP_SHARE_WINDOW, type ShareOrder } from "@/lib/whatsapp-share";

/**
 * Tombol pintas "Kirim WA" untuk kartu pekerjaan di dashboard.
 * Membuat/ambil tautan lacak lalu langsung membuka WhatsApp — tanpa
 * pindah halaman. Versi ringkas dari kartu penuh `ShareWhatsApp`.
 */
export function ShareWhatsAppQuick({ order, className = "" }: { order: ShareOrder; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    // Selalu siapkan (atau ambil kembali) tab WhatsApp yang sama, DULU — selagi
    // masih dalam konteks klik pengguna, sebelum ada `await` sama sekali.
    const popup = window.open("", WHATSAPP_SHARE_WINDOW);
    try {
      const result = await ensureTrackingUrl(order.id, token);
      if (!result) {
        // Jangan tutup popup di sini — kalau ini tab WA yang sudah lama dipakai
        // user, jangan sampai ikut ketutup gara-gara request gagal.
        window.alert("Gagal membuat tautan lacak. Coba lagi.");
        return;
      }
      if (!token) {
        setToken(result.token);
        router.refresh();
      }
      const outcome = await openWhatsAppShare(order, result.url, popup);
      if (outcome === "copied") {
        window.alert("Pop-up diblokir browser. Pesannya sudah disalin — buka WhatsApp lalu tempel (paste) manual.");
      } else if (outcome === "failed") {
        window.alert("Tidak bisa membuka WhatsApp otomatis. Coba izinkan pop-up untuk situs ini di pengaturan browser, lalu klik lagi.");
      }
    } catch (err) {
      console.error("ShareWhatsAppQuick:", err);
      window.alert("Tidak dapat menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`${className} disabled:cursor-wait disabled:opacity-60`}
    >
      Kirim WA {busy ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
    </button>
  );
}
