/**
 * Konstanta & tipe foto yang AMAN dipakai di komponen klien (browser).
 * Jangan mengimpor database di file ini.
 */

export const KIND_LABELS: Record<string, string> = {
  referensi: "Desain / Referensi",
  hasil: "Hasil Jadi",
  nota: "Nota / Bukti",
};

export const PHOTO_KINDS = Object.keys(KIND_LABELS);

export function photoKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

/** Batas jumlah foto per pekerjaan supaya kuota database tetap hemat. */
export const MAX_PHOTOS_PER_ORDER = 8;

/** Batas ukuran berkas per foto sebelum dikompres (4 MB). */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

export type PhotoItem = {
  id: number;
  kind: string;
  caption: string | null;
  sizeBytes: number;
  url: string;
  createdAt: string;
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
