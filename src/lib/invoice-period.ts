/**
 * PERIODE LAPORAN (Bulanan / Harian / Rentang) - diporting dari app lama (patch 016).
 * Semua tanggal berupa teks "YYYY-MM-DD" (WIB). Kode murni.
 */
export type ReportMode = "monthly" | "daily" | "range";

export type Period = {
  mode: ReportMode;
  from: string;
  to: string;
  label: string;
  /** Periode pembanding sebelumnya (bulan lalu / kemarin / rentang sebelumnya yang sama panjang). */
  prevFrom: string;
  prevTo: string;
  prevLabel: string;
  days: number;
};

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && ISO.test(v) && !Number.isNaN(toMs(v));
}
export function isMonthKey(v: unknown): v is string {
  return typeof v === "string" && MONTH_KEY.test(v);
}

export function addDays(iso: string, n: number): string {
  return fromMs(toMs(iso) + n * 86_400_000);
}
export function diffDays(a: string, b: string): number {
  return Math.round((toMs(b) - toMs(a)) / 86_400_000);
}
export function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
export function monthEnd(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return fromMs(Date.UTC(y, m, 0));
}
export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

/** Bangun periode dari parameter halaman. Parameter tidak valid jatuh ke "bulan ini". */
export function buildPeriod(
  q: { mode?: string; bulan?: string; tanggal?: string; dari?: string; sampai?: string },
  todayIso: string,
): Period {
  const thisMonth = todayIso.slice(0, 7);
  if (q.mode === "daily") {
    const day = isIsoDate(q.tanggal) ? q.tanggal : todayIso;
    const prev = addDays(day, -1);
    return { mode: "daily", from: day, to: day, label: dateLabel(day), prevFrom: prev, prevTo: prev, prevLabel: dateLabel(prev), days: 1 };
  }
  if (q.mode === "range") {
    let from = isIsoDate(q.dari) ? q.dari : addDays(todayIso, -29);
    let to = isIsoDate(q.sampai) ? q.sampai : todayIso;
    if (from > to) [from, to] = [to, from];
    const days = diffDays(from, to) + 1;
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(from, -days);
    return {
      mode: "range", from, to, label: `${dateLabel(from)} – ${dateLabel(to)}`,
      prevFrom, prevTo, prevLabel: `${dateLabel(prevFrom)} – ${dateLabel(prevTo)}`, days,
    };
  }
  const key = isMonthKey(q.bulan) ? q.bulan : thisMonth;
  const prevKey = shiftMonthKey(key, -1);
  return {
    mode: "monthly", from: `${key}-01`, to: monthEnd(key), label: monthLabel(key),
    prevFrom: `${prevKey}-01`, prevTo: monthEnd(prevKey), prevLabel: monthLabel(prevKey),
    days: Number(monthEnd(key).slice(8)),
  };
}

export type Shortcut = { key: string; label: string; params: Record<string, string> };

/** Pintasan periode (Hari Ini, Kemarin, 7 Hari, 30 Hari, Bulan Ini, Bulan Lalu). */
export function shortcuts(todayIso: string): Shortcut[] {
  const thisMonth = todayIso.slice(0, 7);
  return [
    { key: "today", label: "Hari Ini", params: { mode: "daily", tanggal: todayIso } },
    { key: "yesterday", label: "Kemarin", params: { mode: "daily", tanggal: addDays(todayIso, -1) } },
    { key: "7d", label: "7 Hari", params: { mode: "range", dari: addDays(todayIso, -6), sampai: todayIso } },
    { key: "30d", label: "30 Hari", params: { mode: "range", dari: addDays(todayIso, -29), sampai: todayIso } },
    { key: "thisMonth", label: "Bulan Ini", params: { mode: "monthly", bulan: thisMonth } },
    { key: "lastMonth", label: "Bulan Lalu", params: { mode: "monthly", bulan: shiftMonthKey(thisMonth, -1) } },
  ];
}

export type Bucket = { label: string; title: string; value: number };

/**
 * Batang grafik: harian untuk bulan/rentang <= 60 hari; per MINGGU (Senin-Minggu) untuk rentang lebih panjang.
 * `byDay` = peta tanggal -> omzet.
 */
export function buildBuckets(period: Period, byDay: Record<string, number>): { buckets: Bucket[]; weekly: boolean } {
  const out: Bucket[] = [];
  if (period.mode === "daily") return { buckets: out, weekly: false };
  const weekly = period.days > 60;
  if (!weekly) {
    for (let i = 0; i < period.days; i += 1) {
      const d = addDays(period.from, i);
      out.push({ label: String(Number(d.slice(8))), title: dateLabel(d), value: byDay[d] ?? 0 });
    }
    return { buckets: out, weekly };
  }
  // Mingguan: kelompokkan ke hari Senin.
  const mondayOf = (iso: string) => {
    const dow = (new Date(toMs(iso)).getUTCDay() + 6) % 7; // 0 = Senin
    return addDays(iso, -dow);
  };
  const sums = new Map<string, number>();
  for (let i = 0; i < period.days; i += 1) {
    const d = addDays(period.from, i);
    const k = mondayOf(d);
    sums.set(k, (sums.get(k) ?? 0) + (byDay[d] ?? 0));
  }
  Array.from(sums.keys()).sort().forEach((k) => {
    out.push({ label: dateLabel(k).slice(0, -5), title: `Minggu ${dateLabel(k)} – ${dateLabel(addDays(k, 6))}`, value: sums.get(k) ?? 0 });
  });
  return { buckets: out, weekly };
}

/* =========================================================================
   PERIODE DAFTAR RIWAYAT DOKUMEN (chip di atas daftar /invoice)
   Terpisah dari buildPeriod (laporan): laporan selalu punya satu periode
   (jatuh ke "bulan ini"), sedangkan daftar riwayat boleh TANPA periode
   ("Semua"). Param URL:  ?p=hari|kemarin|7h|bulan|semua  atau
   ?dari=&sampai=  atau ?bulan=yyyy-mm (tautan lama dari panel cari).
   Tanpa param apa pun = bawaan (DEFAULT_LIST_PERIOD).
   ========================================================================= */
export type ListPeriodKey = "hari" | "kemarin" | "7h" | "bulan" | "semua" | "tanggal";

/** Periode bawaan kalau filter status = Semua dan orang belum memilih apa pun.
 *  Ganti ke "hari" atau "7h" kalau mau daftar mendarat lebih pendek. */
export const DEFAULT_LIST_PERIOD: ListPeriodKey = "semua";

const PRESET_KEYS: ListPeriodKey[] = ["hari", "kemarin", "7h", "bulan", "semua"];

export type ListPeriod = {
  key: ListPeriodKey;
  dari?: string;
  sampai?: string;
  /** Teks panjang, mis. "Hari ini", "Oktober 2026", "18 Okt 2026 – 26 Okt 2026". */
  label: string;
  /** Teks pendek untuk tombol, mis. "Hari ini", "7 hari". */
  short: string;
  /** true = dipilih orang lewat URL; false = bawaan. */
  explicit: boolean;
};

export const LIST_PRESETS: { key: ListPeriodKey; label: string }[] = [
  { key: "hari", label: "Hari Ini" },
  { key: "kemarin", label: "Kemarin" },
  { key: "7h", label: "7 Hari" },
  { key: "bulan", label: "Bulan Ini" },
  { key: "semua", label: "Semua" },
];

function presetPeriod(key: ListPeriodKey, todayIso: string, explicit: boolean): ListPeriod {
  const thisMonth = todayIso.slice(0, 7);
  switch (key) {
    case "hari":
      return { key, dari: todayIso, sampai: todayIso, label: "Hari ini", short: "Hari ini", explicit };
    case "kemarin": {
      const y = addDays(todayIso, -1);
      return { key, dari: y, sampai: y, label: "Kemarin", short: "Kemarin", explicit };
    }
    case "7h":
      return { key, dari: addDays(todayIso, -6), sampai: todayIso, label: "7 hari terakhir", short: "7 hari", explicit };
    case "bulan":
      return { key, dari: `${thisMonth}-01`, sampai: monthEnd(thisMonth), label: monthLabel(thisMonth), short: "Bulan ini", explicit };
    default:
      return { key: "semua", label: "Semua tanggal", short: "Semua", explicit };
  }
}

/**
 * Tentukan periode daftar. Urutan: rentang eksplisit (dari+sampai) >
 * ?bulan= > ?p= > bawaan. Bawaan HANYA berlaku saat filter status =
 * Semua; status lain (Belum bayar, Sebagian, Lewat tempo, Lunas, Draft,
 * Batal) otomatis semua tanggal. Pilihan eksplisit selalu dipakai.
 */
export function resolveListPeriod(
  q: { p?: string; bulan?: string; dari?: string; sampai?: string },
  todayIso: string,
  statusIsSemua: boolean,
): ListPeriod {
  if (isIsoDate(q.dari) && isIsoDate(q.sampai)) {
    let dari = q.dari;
    let sampai = q.sampai;
    if (dari > sampai) [dari, sampai] = [sampai, dari];
    const label = dari === sampai ? dateLabel(dari) : `${dateLabel(dari)} – ${dateLabel(sampai)}`;
    return { key: "tanggal", dari, sampai, label, short: label, explicit: true };
  }
  if (isMonthKey(q.bulan)) {
    if (q.bulan === todayIso.slice(0, 7)) return presetPeriod("bulan", todayIso, true);
    const label = monthLabel(q.bulan);
    return { key: "tanggal", dari: `${q.bulan}-01`, sampai: monthEnd(q.bulan), label, short: label, explicit: true };
  }
  const p = PRESET_KEYS.find((k) => k === q.p);
  if (p) return presetPeriod(p, todayIso, true);
  return presetPeriod(statusIsSemua ? DEFAULT_LIST_PERIOD : "semua", todayIso, false);
}

/** Param URL untuk mempertahankan periode PILIHAN orang (bawaan tidak ditulis). */
export function listPeriodQuery(period: ListPeriod): Record<string, string> {
  if (!period.explicit) return {};
  if (period.key === "tanggal") return { dari: period.dari ?? "", sampai: period.sampai ?? "" };
  return { p: period.key };
}
