import { statusMeta } from "@/lib/domain";

export type ShareOrder = {
  id: number;
  code: string;
  title: string;
  customerName: string;
  status: string;
  dueDate: string;
  dueTime: string;
};

/** Susun teks pesan WhatsApp untuk kabar status pekerjaan ke pelanggan. */
export function buildWhatsAppMessage(order: ShareOrder, url: string): string {
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

/** Minta (atau ambil) token lacak lewat endpoint idempoten, lalu susun URL publiknya. */
export async function ensureTrackingUrl(orderId: number, existingToken: string | null): Promise<{ token: string; url: string } | null> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (existingToken) return { token: existingToken, url: `${origin}/lacak/${existingToken}` };
  const res = await fetch(`/api/orders/${orderId}/share`, { method: "POST" });
  const json = (await res.json()) as { ok: boolean; token?: string; error?: string };
  if (!json.ok || !json.token) return null;
  return { token: json.token, url: `${origin}/lacak/${json.token}` };
}

/**
 * Nama tab tetap untuk semua pengiriman WA dari PrintFlow. Dipakai sebagai
 * target `window.open()` (ganti `"_blank"`) supaya klik berikutnya membuka
 * kembali TAB YANG SAMA (tinggal dialihkan ke pesan baru), bukan bikin tab
 * baru terus-menerus. Catatan: ini hanya bisa "mengenali" tab yang memang
 * dibuka lewat tombol ini sebelumnya di sesi browser yang sama — tab WhatsApp
 * Web yang dibuka manual (ketik sendiri di address bar) tidak akan otomatis
 * kesambung; baru klik BERIKUTNYA setelah itu yang akan reuse tab tersebut.
 */
export const WHATSAPP_SHARE_WINDOW = "printflow_whatsapp_share";

export type ShareOutcome = "opened" | "copied" | "failed";

/**
 * Arahkan ke wa.me dengan pesan yang sudah disusun.
 *
 * `preOpenedWindow`: tab yang HARUS sudah dibuka lewat
 * `window.open("", WHATSAPP_SHARE_WINDOW)` SAAT MASIH di dalam event klik
 * pengguna — sebelum ada proses async (fetch token) berjalan. Ini wajib:
 * kalau `window.open()` baru dipanggil setelah `await`, beberapa browser
 * (terutama Safari, dan kadang Chrome di kondisi tertentu) sudah tidak
 * menganggapnya sebagai hasil klik langsung pengguna lagi ("kehilangan user
 * activation"), jadi diam-diam diblokir. Pakai nama target yang konsisten
 * (bukan "_blank") juga membuat browser reuse tab yang sama tiap kali,
 * bukan membuka tab baru setiap klik.
 *
 * Sengaja TIDAK pakai Web Share API (`navigator.share`) di sini — selain
 * kena masalah "gesture" yang sama begitu dipanggil setelah `await`, tombolnya
 * memang spesifik "Kirim WA", jadi langsung ke WhatsApp lebih pasti daripada
 * memunculkan menu share umum OS yang belum tentu ada WhatsApp-nya / bisa
 * gagal senyap di sebagian browser desktop.
 *
 * Kalau ternyata tab yang disiapkan gagal dibuka sama sekali (popup benar-benar
 * diblokir), pesan otomatis disalin ke clipboard sebagai jalan terakhir supaya
 * pengguna masih bisa kirim manual.
 */
export async function openWhatsAppShare(order: ShareOrder, url: string, preOpenedWindow?: Window | null): Promise<ShareOutcome> {
  const waUrl = `https://wa.me/?text=${encodeURIComponent(buildWhatsAppMessage(order, url))}`;
  if (preOpenedWindow && !preOpenedWindow.closed) {
    preOpenedWindow.location.href = waUrl;
    preOpenedWindow.focus?.();
    return "opened";
  }
  // Tab tadi entah kenapa gagal/tertutup — coba sekali lagi langsung, siapa tahu diizinkan.
  const fallback = window.open(waUrl, WHATSAPP_SHARE_WINDOW);
  if (fallback) return "opened";
  try {
    await navigator.clipboard.writeText(buildWhatsAppMessage(order, url));
    return "copied";
  } catch {
    return "failed";
  }
}
