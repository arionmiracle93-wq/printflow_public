/**
 * JATUH TEMPO & PENCOCOKAN MUTASI BANK (diporting dari app lama)
 * Kode murni, aman dipakai di server maupun layar.
 */

/** Selisih hari dari hari ini (WIB, "YYYY-MM-DD") ke tanggal jatuh tempo. null bila tanggal kosong/tidak valid. */
export function daysUntil(dueIso: string | null | undefined, todayIso: string): number | null {
  if (!dueIso || !/^\d{4}-\d{2}-\d{2}$/.test(dueIso)) return null;
  const a = Date.parse(`${dueIso}T00:00:00Z`);
  const b = Date.parse(`${todayIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86_400_000);
}

export type DueStatus = {
  kind: "paid" | "late" | "today" | "soon" | "ok";
  label: string;
  days: number;
};

/** Status tempo: Lunas / Terlambat N hari / Jatuh tempo hari ini / Tinggal N hari (<=3) / Tempo N hari lagi. */
export function dueStatus(dueIso: string | null | undefined, lunas: boolean, todayIso: string): DueStatus | null {
  const n = daysUntil(dueIso, todayIso);
  if (n === null) return null;
  if (lunas) return { kind: "paid", label: "Lunas", days: n };
  if (n < 0) return { kind: "late", label: `Terlambat ${Math.abs(n)} hari`, days: n };
  if (n === 0) return { kind: "today", label: "Jatuh tempo hari ini", days: 0 };
  if (n <= 3) return { kind: "soon", label: `Tinggal ${n} hari`, days: n };
  return { kind: "ok", label: `Tempo ${n} hari lagi`, days: n };
}

export type BankMatch = "nominal" | "kode" | "akhiran" | null;

/**
 * Cocokkan angka yang diketik (dari mutasi bank) dengan sebuah invoice.
 *  - nominal : sama persis dengan nominal transfer (sisa + kode unik) atau total invoice
 *  - kode    : sama dengan kode unik, atau 3 digit terakhir kode unik
 *  - akhiran : >= 4 digit yang cocok dengan akhiran nominal transfer / total,
 *              HANYA kalau jumlah digit habis dibagi 3
 * `digits` adalah angka saja (tanpa titik, koma, atau "Rp").
 */
export function bankMatch(digits: string, doc: { total: number; payable: number; code: number }): BankMatch {
  if (!digits) return null;
  const payStr = String(Math.round(doc.payable));
  const totStr = String(Math.round(doc.total));
  if (payStr === digits || totStr === digits) return "nominal";
  if (doc.code && String(doc.code) === digits) return "kode";
  if (digits.length <= 3 && doc.code && String(doc.code).padStart(3, "0") === digits.padStart(3, "0")) return "kode";
  /* AKHIRAN hanya sah kalau angka yang diketik habis di batas ribuan.

     Tanpa syarat ini, mengetik "5000" cocok dengan invoice 75.000 dan
     25.000 - karena "75000" memang berakhir dengan "5000". Tapi secara
     visual itu salah: orang menulis "5000" karena memang ingin 5.000,
     bukan karena melihat "5|000" di ujung nominal. Tidak ada yang
     membaca "Rp 75.000" sebagai mengandung "5000".

     Syaratnya: jumlah digit habis dibagi 3, sebab tiap kelompok ribuan
     tepat 3 digit ("75.000" = 75 dan 000). Jadi yang boleh dicocokkan
     lewat akhiran hanya "500.000", "1.500.000", dan seterusnya
     - nominal yang memang dibaca orang utuh.

     Invoice 5.000 TIDAK jadi hilang: "5000" akan tetap ditemukan lewat
     cabang "nominal" di atas, yang persis sama. Yang hilang hanya
     kecocokan yang muncul karena namaruf kelompok ribuan, dan itulah
     yang paling bikin orang salah pilih tagihan. */
  if (digits.length >= 4 && digits.length % 3 === 0 && (payStr.endsWith(digits) || totStr.endsWith(digits))) {
    return "akhiran";
  }
  return null;
}

export function onlyDigits(raw: string): string {
  return String(raw ?? "").replace(/[^0-9]/g, "");
}
