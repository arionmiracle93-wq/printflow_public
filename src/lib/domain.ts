export type StatusKey =
  | "antrian"
  | "desain"
  | "cetak"
  | "finishing"
  | "qc"
  | "siap"
  | "selesai"
  | "ditunda"
  | "batal";

export type StatusMeta = {
  key: StatusKey;
  label: string;
  short: string;
  progress: number;
  emoji: string;
  badge: string;
  dot: string;
  bar: string;
  done: boolean;
};

export const STATUSES: StatusMeta[] = [
  {
    key: "antrian",
    label: "Antrian / Menunggu",
    short: "Antrian",
    progress: 5,
    emoji: "📥",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
    bar: "bg-slate-400",
    done: false,
  },
  {
    key: "desain",
    label: "Desain / Proof",
    short: "Desain",
    progress: 18,
    emoji: "🎨",
    badge: "bg-violet-100 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
    bar: "bg-violet-500",
    done: false,
  },
  {
    key: "cetak",
    label: "Proses Cetak",
    short: "Cetak",
    progress: 45,
    emoji: "🖨️",
    badge: "bg-sky-100 text-sky-700 border-sky-200",
    dot: "bg-sky-500",
    bar: "bg-sky-500",
    done: false,
  },
  {
    key: "finishing",
    label: "Finishing",
    short: "Finishing",
    progress: 70,
    emoji: "✂️",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    done: false,
  },
  {
    key: "qc",
    label: "Quality Control",
    short: "QC",
    progress: 85,
    emoji: "🔍",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
    bar: "bg-indigo-500",
    done: false,
  },
  {
    key: "siap",
    label: "Siap Diambil / Dikirim",
    short: "Siap",
    progress: 95,
    emoji: "📦",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    done: false,
  },
  {
    key: "selesai",
    label: "Selesai / Diserahkan",
    short: "Selesai",
    progress: 100,
    emoji: "✅",
    badge: "bg-teal-100 text-teal-800 border-teal-200",
    dot: "bg-teal-600",
    bar: "bg-teal-600",
    done: true,
  },
  {
    key: "ditunda",
    label: "Ditunda (Menunggu Aproval)",
    short: "Ditunda",
    progress: 10,
    emoji: "⏸️",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
    bar: "bg-orange-500",
    done: false,
  },
  {
    key: "batal",
    label: "Dibatalkan",
    short: "Batal",
    progress: 0,
    emoji: "⛔",
    badge: "bg-rose-100 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
    bar: "bg-rose-500",
    done: true,
  },
];

const STATUS_MAP = new Map<string, StatusMeta>(STATUSES.map((s) => [s.key, s]));

export const ACTIVE_STATUSES: StatusKey[] = [
  "antrian",
  "desain",
  "cetak",
  "finishing",
  "qc",
  "siap",
  "ditunda",
];

export function statusMeta(key: string): StatusMeta {
  return STATUS_MAP.get(key) ?? STATUS_MAP.get("antrian")!;
}

export function isStatusKey(value: string): value is StatusKey {
  return STATUS_MAP.has(value);
}

export type PriorityKey = "rendah" | "normal" | "tinggi" | "urgent";

export const PRIORITIES: { key: PriorityKey; label: string; badge: string }[] = [
  { key: "rendah", label: "Rendah", badge: "bg-slate-100 text-slate-600 border-slate-200" },
  { key: "normal", label: "Normal", badge: "bg-sky-50 text-sky-700 border-sky-200" },
  { key: "tinggi", label: "Tinggi", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "urgent", label: "Urgent", badge: "bg-rose-50 text-rose-700 border-rose-200" },
];

const PRIORITY_MAP = new Map(PRIORITIES.map((p) => [p.key, p]));

export function priorityMeta(key: string) {
  return PRIORITY_MAP.get(key as PriorityKey) ?? PRIORITY_MAP.get("normal")!;
}

export const PRODUCT_TYPES = [
  "Kartu Nama",
  "Spanduk / Banner",
  "Stiker / Label",
  "Brosur / Flyer",
  "Buku / Yasinan",
  "Undangan",
  "Nota / Kop Surat",
  "Merchandise / Sablon",
  "Packaging / Box",
  "Cetak Foto / Poster",
  "Lainnya",
];

export const MACHINES = [
  "Digital Print 1",
  "Digital Print 2",
  "Mesin Offset",
  "Large Format / Outdoor",
  "Cutter / Plotter",
  "Sablon Manual",
  "Finishing & Binding",
];

export const UNITS = ["pcs", "rim", "box", "lembar", "meter", "pack", "set"];

export const OPERATOR_SUGGESTIONS = ["Pak Andi", "Bu Rina", "Dimas", "Yoga", "Tim Finishing"];

export const NEXT_STATUS: Record<StatusKey, StatusKey | null> = {
  antrian: "desain",
  desain: "cetak",
  cetak: "finishing",
  finishing: "qc",
  qc: "siap",
  siap: "selesai",
  selesai: null,
  ditunda: "antrian",
  batal: null,
};

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value || 0);
}

/** Gabungkan dueDate (YYYY-MM-DD) + dueTime (HH:MM) menjadi Date lokal. */
export function deadlineOf(dueDate: string, dueTime: string): Date {
  const [y, m, d] = dueDate.split("-").map((n) => Number.parseInt(n, 10));
  const [hh, mm] = (dueTime || "17:00").split(":").map((n) => Number.parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

export function formatDateID(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTimeID(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  // PENTING: harus set timeZone eksplisit. Fungsi ini dipanggil di server
  // component (dirender di server Vercel yang jalan di UTC), jadi kalau
  // timeZone tidak diset, Intl.DateTimeFormat memakai zona waktu SERVER
  // (UTC) — bukan zona waktu perangkat pengguna — dan jamnya kegeser 7 jam
  // dari WIB. Di-hardcode ke Asia/Jakarta karena ini aplikasi percetakan
  // lokal Indonesia, supaya jam yang tampil konsisten WIB untuk semua
  // pengguna, di device apa pun dan di mana pun server-nya di-deploy.
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 3_600_000;
}

export function humanDuration(hours: number): string {
  const abs = Math.abs(hours);
  if (abs < 1) return `${Math.max(1, Math.round(abs * 60))} menit`;
  if (abs < 48) return `${Math.round(abs)} jam`;
  return `${(abs / 24).toFixed(abs < 240 ? 1 : 0)} hari`;
}

export function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDaysISO(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const PRODUCT_EFFORT: Record<string, number> = {
  "Kartu Nama": 0.6,
  "Spanduk / Banner": 1.2,
  "Stiker / Label": 1,
  "Brosur / Flyer": 1,
  "Buku / Yasinan": 2.2,
  Undangan: 1.4,
  "Nota / Kop Surat": 0.8,
  "Merchandise / Sablon": 1.8,
  "Packaging / Box": 1.9,
  "Cetak Foto / Poster": 0.7,
  Lainnya: 1,
};

/** Perkiraan jam kerja untuk SATU baris produk. */
export function estimateHours(productType: string, quantity: number): number {
  const factor = PRODUCT_EFFORT[productType] ?? 1;
  const qty = Math.max(1, quantity || 1);
  const raw = 1.5 + factor * Math.log2(qty + 1) * 1.6;
  return Math.min(96, Math.max(1, Math.round(raw)));
}

/**
 * Perkiraan jam kerja untuk SATU PEKERJAAN yang berisi beberapa produk.
 *
 * Bukan penjumlahan lurus: baris pertama dihitung penuh, baris berikutnya
 * diberi bobot 70%. Alasannya praktis — kalau spanduk, stiker, dan kartu nama
 * dikerjakan dalam satu order yang sama, sebagian pekerjaan (menyiapkan file,
 * setting mesin, finishing, packing, serah terima) cuma dilakukan sekali,
 * bukan diulang penuh tiap produk. Kalau dijumlah lurus, estimasinya jadi
 * terlalu pesimis dan semua order multi-produk kelihatan "berisiko telat"
 * padahal tidak.
 */
export function estimateHoursForItems(
  items: { productType: string; quantity: number }[],
): number {
  if (!items.length) return 1;
  const perItem = items
    .map((item) => estimateHours(item.productType, item.quantity))
    .sort((a, b) => b - a);
  const total = perItem.reduce(
    (sum, hours, index) => sum + (index === 0 ? hours : hours * 0.7),
    0,
  );
  return Math.min(120, Math.max(1, Math.round(total)));
}

export function orderCode(seed: number): string {
  const year = new Date().getFullYear();
  return `PJ-${year}-${String(seed).padStart(4, "0")}`;
}
