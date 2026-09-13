"use client";

import { useState } from "react";
import { formatDateID } from "@/lib/domain";

type HandoverShareData = {
  orderId: number;
  orderCode: string;
  orderTitle: string;
  customerName: string;
  fromOperator: string;
  toOperator: string;
  shiftLabel: string | null;
  lastPosition: string;
  nextAction: string;
  blocker: string | null;
  dueDate: string;
  dueTime: string;
};

function buildHandoverMessage(h: HandoverShareData, url: string): string {
  const lines = [
    `Halo ${h.toOperator} 👋`,
    "",
    `Ada serah terima pekerjaan dari *${h.fromOperator}* buat kamu. Ini kirim manual lewat WhatsApp — jaring pengaman aja kalau-kalau notifikasi di HP kamu belum masuk:`,
    "",
    `• No. pesanan : ${h.orderCode}`,
    `• Pekerjaan   : ${h.orderTitle}`,
    `• Pelanggan   : ${h.customerName}`,
    h.shiftLabel ? `• Shift       : ${h.shiftLabel}` : undefined,
    `• Posisi saat ini      : ${h.lastPosition}`,
    `• Yang perlu dilanjutkan: ${h.nextAction}`,
    h.blocker ? `⚠️ Kendala: ${h.blocker}` : undefined,
    `• Deadline    : ${formatDateID(h.dueDate)} pukul ${h.dueTime}`,
    "",
    "Buka & terima pekerjaannya di sini 👇",
    url,
    "",
    "Kalau udah lihat, tolong dibalas biar sama-sama tenang 🙏",
  ];
  return lines.filter((l) => l !== undefined).join("\n");
}

export function ShareHandoverWhatsApp({ handover }: { handover: HandoverShareData }) {
  const [copied, setCopied] = useState(false);

  function messageAndUrl() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/pesanan/${handover.orderId}`;
    return { url, text: buildHandoverMessage(handover, url) };
  }

  async function share() {
    const { text } = messageAndUrl();
    // Coba Web Share API dulu (bagus di HP: bisa langsung pilih kontak WhatsApp tujuan)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `Serah terima ${handover.orderCode}`, text });
        return;
      } catch {
        /* pengguna membatalkan → lanjut ke opsi WhatsApp biasa */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function copy() {
    const { text } = messageAndUrl();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* diamkan — tombol WhatsApp di atas tetap jadi jalur utama */
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={share} className="btn-ghost flex-1 border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800/50 dark:text-emerald-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40">
        📲 Kirim manual via WhatsApp
      </button>
      <button type="button" onClick={copy} className="btn-ghost px-3" title="Salin teks pesan">
        {copied ? "✅" : "📋"}
      </button>
    </div>
  );
}
