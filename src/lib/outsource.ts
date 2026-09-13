export const OUTSOURCE_STATUSES = [
  { key: "belum_dikirim", label: "Belum Dikirim", short: "Belum dikirim", color: "border-slate-200 bg-slate-50 text-slate-600" },
  { key: "dikirim", label: "Sudah Dikirim ke Mitra", short: "Dikirim", color: "border-sky-200 bg-sky-50 text-sky-700" },
  { key: "proses", label: "Sedang Diproduksi Mitra", short: "Proses mitra", color: "border-amber-200 bg-amber-50 text-amber-700" },
  { key: "siap_diambil", label: "Siap Diambil dari Mitra", short: "Siap diambil", color: "border-teal-200 bg-teal-50 text-teal-700" },
  { key: "diterima", label: "Sudah Diterima & Perlu QC", short: "Diterima / QC", color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { key: "revisi", label: "Dikembalikan / Revisi Mitra", short: "Revisi", color: "border-rose-200 bg-rose-50 text-rose-700" },
] as const;

export type OutsourceStatus = (typeof OUTSOURCE_STATUSES)[number]["key"];

export const PARTNER_KINDS = [
  { key: "vendor", label: "Percetakan Mitra" },
  { key: "pusat", label: "Percetakan Pusat / Cabang Utama" },
  { key: "spesialis", label: "Vendor Spesialis (finishing, laser, dll.)" },
] as const;

export function outsourceStatusMeta(key: string) {
  return OUTSOURCE_STATUSES.find((s) => s.key === key) ?? OUTSOURCE_STATUSES[0];
}

export function partnerKindLabel(key: string) {
  return PARTNER_KINDS.find((k) => k.key === key)?.label ?? "Percetakan Mitra";
}

export function isOutsourceStatus(value: string): value is OutsourceStatus {
  return OUTSOURCE_STATUSES.some((s) => s.key === value);
}
