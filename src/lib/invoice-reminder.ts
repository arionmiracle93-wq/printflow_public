import { formatDateID, formatRupiah } from "@/lib/domain";
import type { DueStatus } from "@/lib/invoice-due";

/**
 * PESAN PENGINGAT TAGIHAN (diporting dari app lama, 3 nada: halus / biasa / tegas).
 * Kode murni - dipakai di jendela "Tagih" yang menyusun ulang pesan saat nada diganti.
 */
export type ReminderTone = "halus" | "biasa" | "tegas";

export type ReminderCtx = {
  businessName: string;
  customerName: string;
  number: string;
  issueDate: string;
  dueDate: string | null;
  total: number;
  /** DP total (pembayaran berjenis dp). */
  dp: number;
  /** Jumlah cicilan (pembayaran berjenis bayar) dan nilainya. */
  installmentCount: number;
  installmentTotal: number;
  paid: number;
  /** Sisa tagihan sebelum kode unik. */
  base: number;
  code: number;
  payable: number;
  payMethod: string;
  banks: { bank: string; no: string; name: string }[];
  due: DueStatus | null;
};

export const TONES: { key: ReminderTone; label: string }[] = [
  { key: "halus", label: "Halus" },
  { key: "biasa", label: "Biasa" },
  { key: "tegas", label: "Tegas" },
];

export function buildReminderMessage(ctx: ReminderCtx, tone: ReminderTone): string {
  const nama = ctx.customerName.trim();
  const sapaan = nama ? `Bapak/Ibu ${nama}` : "Bapak/Ibu";
  const st = ctx.due;

  let buka: string;
  let tutup: string;
  if (tone === "halus") {
    buka = `Selamat pagi/siang ${sapaan}, mohon maaf mengganggu waktunya.`;
    tutup = "Apabila sudah melakukan pembayaran, mohon abaikan pesan ini. Terima kasih banyak atas kepercayaannya. 🙏";
  } else if (tone === "tegas") {
    buka = `Yth. ${sapaan},`;
    tutup = "Mohon pembayaran segera diselesaikan. Terima kasih atas perhatiannya.";
  } else {
    buka = `Halo ${sapaan},`;
    tutup = "Jika sudah dibayar, mohon abaikan pesan ini. Terima kasih. 🙏";
  }

  let inti: string;
  if (st && st.kind === "late") {
    inti =
      tone === "tegas"
        ? `Kami informasikan bahwa invoice ${ctx.number} telah melewati jatuh tempo ${Math.abs(st.days)} hari.`
        : `Kami ingin mengingatkan mengenai invoice ${ctx.number} yang jatuh temponya sudah lewat ${Math.abs(st.days)} hari.`;
  } else if (st && st.kind === "today") {
    inti = `Kami ingin mengingatkan bahwa invoice ${ctx.number} jatuh tempo hari ini.`;
  } else if (st) {
    inti = `Kami ingin mengingatkan mengenai invoice ${ctx.number} yang akan jatuh tempo dalam ${st.days} hari.`;
  } else {
    inti = `Kami ingin menginformasikan mengenai invoice ${ctx.number} yang belum kami terima pembayarannya.`;
  }

  const lines: string[] = [buka, "", inti, ""];
  lines.push(`No. Invoice : ${ctx.number}`);
  lines.push(`Tanggal     : ${formatDateID(ctx.issueDate)}`);
  if (ctx.dueDate) lines.push(`Jatuh tempo : ${formatDateID(ctx.dueDate)}`);
  lines.push(`Total       : ${formatRupiah(ctx.total)}`);
  if (ctx.paid > 0) {
    if (ctx.dp > 0) lines.push(`Uang muka (DP)     : ${formatRupiah(ctx.dp)}`);
    if (ctx.installmentCount > 0) lines.push(`Cicilan (${ctx.installmentCount}x)      : ${formatRupiah(ctx.installmentTotal)}`);
    lines.push(`Total sudah dibayar: ${formatRupiah(ctx.paid)}`);
    lines.push(`SISA TAGIHAN : ${formatRupiah(ctx.base)}`);
  }

  const banks = ctx.banks.filter((b) => b.no);
  if (ctx.payMethod === "Transfer" && banks.length) {
    lines.push("", "Pembayaran dapat ditransfer ke:");
    banks.forEach((b) => lines.push(`· ${b.bank || "Bank"} ${b.no}${b.name ? ` a.n. ${b.name}` : ""}`));
    if (ctx.code) {
      lines.push("", `Mohon transfer TEPAT sejumlah ${formatRupiah(ctx.payable)} (termasuk kode unik ${ctx.code}) agar pembayaran cepat kami verifikasi.`);
    } else {
      lines.push("", `Nominal transfer: ${formatRupiah(ctx.payable)}`);
    }
  } else if (ctx.payMethod === "QRIS") {
    lines.push("", "Pembayaran dapat dilakukan via QRIS pada invoice yang kami kirimkan sebelumnya.");
  }

  lines.push("", tutup);
  lines.push("", "Hormat kami,", ctx.businessName);
  return lines.join("\n");
}
