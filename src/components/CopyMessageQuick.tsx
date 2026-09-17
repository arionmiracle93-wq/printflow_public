"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";
import { buildWhatsAppMessage, ensureTrackingUrl, type ShareOrder } from "@/lib/whatsapp-share";

/**
 * Tombol pintas "Salin teks pesan" untuk kartu pekerjaan di dashboard.
 *
 * Menyusun teks yang PERSIS sama dengan tombol "Kirim WA" (termasuk tautan
 * lacak), tapi hanya menyalinnya ke clipboard — buat dipaste ke mana saja:
 * WhatsApp Web, grup karyawan, Telegram, catatan, dsb. Berguna juga kalau
 * pop-up WhatsApp diblokir browser.
 */
export function CopyMessageQuick({ order, className = "" }: { order: ShareOrder; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const result = await ensureTrackingUrl(order.id, token);
      if (!result) {
        window.alert("Gagal membuat tautan lacak. Coba lagi.");
        return;
      }
      if (!token) {
        setToken(result.token);
        router.refresh();
      }
      const text = buildWhatsAppMessage(order, result.url);
      const ok = await copyText(text);
      if (ok) {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 2200);
      } else {
        // Jalan terakhir: tampilkan teksnya supaya masih bisa diblok & disalin manual.
        window.prompt("Browser menolak akses clipboard. Salin teks di bawah ini secara manual:", text);
      }
    } catch (err) {
      console.error("CopyMessageQuick:", err);
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
      title="Salin teks pesan status (termasuk tautan lacak) ke clipboard"
      className={`inline-flex items-center gap-1 disabled:cursor-wait disabled:opacity-60 ${
        copied ? "text-teal-600 dark:text-teal-300" : ""
      } ${className}`}
    >
      {copied ? "Tersalin!" : "Salin teks pesan"}{" "}
      {busy ? <Loader2 size={13} className="animate-spin" /> : copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

/**
 * Clipboard API hanya tersedia di secure context (https / localhost). Di WebView
 * APK atau http lokal bisa tidak ada, jadi disiapkan fallback textarea+execCommand.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // lanjut ke fallback
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
