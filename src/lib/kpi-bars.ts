import { ACTIVE_STATUSES, formatRupiah } from "@/lib/domain";
import type { AiOrder } from "@/lib/ai";

/**
 * Garis progres tipis di bawah angka pada enam kartu KPI dashboard.
 * Setiap garis mewakili SATU perbandingan yang bisa dibaca dari angkanya,
 * dan ukurannya tidak membesar/mengecil hanya karena data menumpuk
 * (semuanya dihitung dari pekerjaan AKTIF, bukan seluruh riwayat).
 *
 *   Pekerjaan aktif   rata-rata progres tahap produksi pekerjaan aktif
 *                     (Antrian = 1/6 ... Siap = 6/6; Ditunda tidak dihitung)
 *   Terlambat         porsi pekerjaan aktif yang sudah lewat tenggat
 *   Waspada / risiko  porsi pekerjaan aktif berstatus waspada atau berisiko
 *   Siap diambil      porsi pekerjaan aktif yang siap diambil
 *   Nilai order aktif porsi nilai order aktif yang BELUM terbayar
 *   DP / terbayar     porsi nilai order aktif yang SUDAH terbayar
 *
 * pct   : panjang isi garis (0-100). Nilai kecil tapi > 0 dinaikkan ke 4
 *         supaya isinya tetap kelihatan. Nol tetap kosong.
 * label : kalimat penjelasan yang tampil saat garis di-hover / dibaca
 *         pembaca layar.
 */

const STAGE_FLOW = ["antrian", "desain", "cetak", "finishing", "qc", "siap"] as const;

export type KpiBar = { pct: number; label: string };

export type KpiBars = {
  aktif: KpiBar;
  terlambat: KpiBar;
  risiko: KpiBar;
  siap: KpiBar;
  nilai: KpiBar;
  dp: KpiBar;
};

type Stats = {
  totalActive: number;
  late: number;
  risky: number;
  readyToPickup: number;
};

function ratio(part: number, whole: number): number {
  return whole > 0 ? Math.min(1, Math.max(0, part / whole)) : 0;
}

function visual(r: number): number {
  return r <= 0 ? 0 : Math.max(4, Math.round(r * 100));
}

function percentText(r: number): string {
  if (r > 0 && r < 0.01) return "<1%";
  return `${Math.round(r * 100)}%`;
}

function shareBar(part: number, whole: number, sentence: (pct: string) => string, empty: string): KpiBar {
  if (whole <= 0) return { pct: 0, label: empty };
  const r = ratio(part, whole);
  return { pct: visual(r), label: sentence(percentText(r)) };
}

export function buildKpiBars(orders: AiOrder[], stats: Stats): KpiBars {
  const noActive = "Belum ada pekerjaan aktif";

  // Rata-rata progres tahap produksi.
  const positioned = orders
    .map((o) => STAGE_FLOW.indexOf(o.status as (typeof STAGE_FLOW)[number]))
    .filter((i) => i !== -1);
  const avgProgress = positioned.length
    ? positioned.reduce((sum, i) => sum + (i + 1) / STAGE_FLOW.length, 0) / positioned.length
    : 0;
  const aktif: KpiBar = positioned.length
    ? {
        pct: visual(avgProgress),
        label: `Rata-rata progres tahap produksi ${positioned.length} pekerjaan aktif: ${percentText(avgProgress)}`,
      }
    : { pct: 0, label: noActive };

  // Nilai order aktif dan yang sudah terbayar (per pekerjaan, terbayar
  // dibatasi paling banyak sebesar harganya).
  const activeOrders = orders.filter((o) => (ACTIVE_STATUSES as string[]).includes(o.status));
  const value = activeOrders.reduce((sum, o) => sum + (o.price || 0), 0);
  const paid = activeOrders.reduce((sum, o) => sum + Math.min(o.paidAmount || 0, o.price || 0), 0);
  const unpaid = Math.max(0, value - paid);
  const noValue = "Belum ada nilai order aktif";

  return {
    aktif,
    terlambat: shareBar(
      stats.late,
      stats.totalActive,
      (p) => `${stats.late} dari ${stats.totalActive} pekerjaan aktif terlambat (${p})`,
      noActive,
    ),
    risiko: shareBar(
      stats.risky,
      stats.totalActive,
      (p) => `${stats.risky} dari ${stats.totalActive} pekerjaan aktif berstatus waspada atau berisiko (${p})`,
      noActive,
    ),
    siap: shareBar(
      stats.readyToPickup,
      stats.totalActive,
      (p) => `${stats.readyToPickup} dari ${stats.totalActive} pekerjaan aktif siap diambil (${p})`,
      noActive,
    ),
    nilai: shareBar(
      unpaid,
      value,
      (p) => `${formatRupiah(unpaid)} dari ${formatRupiah(value)} nilai order aktif belum terbayar (${p})`,
      noValue,
    ),
    dp: shareBar(
      paid,
      value,
      (p) => `${formatRupiah(paid)} dari ${formatRupiah(value)} nilai order aktif sudah terbayar (${p})`,
      noValue,
    ),
  };
}
