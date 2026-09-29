/**
 * STATUS PER PRODUK
 * ---------------------------------------------------------------
 * Satu pekerjaan bisa berisi beberapa produk. Tiap produk boleh punya
 * tahap sendiri, tetapi pekerjaan tetap punya SATU status resmi yang
 * dipakai di mana-mana (dashboard, skor risiko AI, halaman lacak,
 * pesan WhatsApp, notifikasi, serah terima shift).
 *
 * Aturannya:
 *   - order_items.status = null artinya "ikut status pekerjaan".
 *     Semua data lama otomatis berada di keadaan ini, jadi tidak ada
 *     yang berubah sampai seseorang benar-benar memisah status produk.
 *   - Begitu satu produk diberi status sendiri, status pekerjaan
 *     dihitung otomatis = tahap produk yang PALING LAMBAT. Pekerjaan
 *     baru dianggap "Siap" kalau semua produknya siap, dan "Selesai"
 *     kalau semuanya selesai.
 *
 * Berkas ini murni fungsi hitung, tanpa akses database, supaya aturan
 * bisnis di src/lib/domain.ts tidak perlu diubah.
 */
import { isStatusKey, type StatusKey } from "@/lib/domain";

/** Urutan tahap produksi normal. */
export const ITEM_FLOW = ["antrian", "desain", "cetak", "finishing", "qc", "siap", "selesai"] as const;

export function flowIndex(status: string): number {
  return ITEM_FLOW.indexOf(status as (typeof ITEM_FLOW)[number]);
}

/** Tahap berikutnya dalam alur normal, atau null kalau sudah di ujung / di luar alur. */
export function nextItemStatus(status: string): StatusKey | null {
  const i = flowIndex(status);
  if (i === -1 || i >= ITEM_FLOW.length - 1) return null;
  return ITEM_FLOW[i + 1];
}

/** Status efektif satu produk: miliknya sendiri, atau ikut pekerjaan. */
export function effectiveItemStatus(itemStatus: string | null | undefined, orderStatus: string): string {
  return itemStatus && isStatusKey(itemStatus) ? itemStatus : orderStatus;
}

/**
 * Hitung status pekerjaan dari status semua produknya.
 *   - Produk "batal" diabaikan. Kalau semuanya batal, pekerjaan batal.
 *   - Kalau semua sisa produk selesai, pekerjaan selesai.
 *   - Kalau semua produk yang belum selesai sedang ditunda, pekerjaan ditunda.
 *   - Selain itu: tahap paling awal di antara produk yang masih berjalan.
 */
export function rollupStatus(statuses: string[]): StatusKey | null {
  const valid = statuses.filter(isStatusKey) as StatusKey[];
  if (!valid.length) return null;
  const active = valid.filter((s) => s !== "batal");
  if (!active.length) return "batal";
  const unfinished = active.filter((s) => s !== "selesai");
  if (!unfinished.length) return "selesai";
  const moving = unfinished.filter((s) => s !== "ditunda");
  if (!moving.length) return "ditunda";
  return moving.reduce((slowest, s) => (flowIndex(s) < flowIndex(slowest) ? s : slowest));
}

/** Apakah daftar produk ini sedang memakai status terpisah. */
export function isSplit(items: { status?: string | null }[]): boolean {
  return items.length > 1 && items.some((i) => Boolean(i.status));
}
