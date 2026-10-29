import Link from "next/link";
import { Eye } from "lucide-react";
import { customerLabel, formatDateID, formatRupiah } from "@/lib/domain";
import { Chip, historyMeta } from "@/components/InvoiceHistoryCard";
import type { InvoiceHistoryCardRow } from "@/components/InvoiceHistoryCard";

type InvoiceRow = InvoiceHistoryCardRow;

/* Sel tabel: kelas dikumpulkan di konstanta supaya tiap th/td konsisten
   dan tidak ada pita kelas yang berbeda di antara kolom. Semua ukuran
   memakai utility Tailwind, jadi tidak ada kaca ompong @layer yang
   bisa dikalahkan utility lain. */
const TH =
  "whitespace-nowrap px-3 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-[.08em] text-[color:var(--pf-ink-3)]";
const TH_NUM = `${TH} text-right`.replace("text-left", "");
const TD = "px-3 py-2.5 align-middle";
const TD_NUM = `${TD} text-right whitespace-nowrap`;
const DASH = <span className="text-[color:var(--pf-ink-3)]">—</span>;

/**
 * TABEL RIWAYAT DOKUMEN - mode tampilan keempat di halaman Riwayat (/invoice).
 * =====================================================================
 * Diminta owner: daftar berbentuk tabel list modern yang mudah dipindai
 * per kolom (dokumen, tanggal, pelanggan, pekerjaan, status, uang), kena
 * pola tabel POS di acuannya, TAPI kolom dipilih dari data aplikasi ini.
 *
 * Aturan yang dipegang:
 *  - Satu baris = satu dokumen, angka memakai data dan aturan yang sama
 *    dengan Kartu/Padat/Ringkas: status, sisa tagihan, dan tanda lewat
 *    tempo datang dari historyMeta (sumber kebenaran bersama), jadi
 *    keempat mode tidak pernah menceritakan hal berbeda soal satu dokumen.
 *  - Nomor dokumen dan ikon mata = pintu ke halaman detail, sama seperti
 *    kartu; sisanya bukan tautan supaya penyapuan baris tetap nyaman dan
 *    tidak mengalami kesalahan sentuh.
 *  - Murni render: tidak ada state, event, atau query baru - baris yang
 *    dirender sama persis dengan tampilan lain (dipilih setengah vie-
 *    mode), jadi berpindah mode tidak pernah memicu muat ulang data.
 *  - Layar sempit: tabel digeser samping (overflow-x-auto), kepala kolom
 *    menempel supaya label tetap terbaca saat digeser.
 * =====================================================================
 */
export function InvoiceHistoryTable({
  rows,
  today,
  uniqueCodeEnabled,
}: {
  rows: InvoiceRow[];
  today: string;
  uniqueCodeEnabled: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--pf-line-soft)] bg-[color:var(--pf-surface-solid)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-[13px]">
          <thead className="bg-[color:var(--pf-surface-2)]/80">
            <tr>
              <th scope="col" className={TH}>Dokumen</th>
              <th scope="col" className={`${TH} whitespace-nowrap`}>Tanggal</th>
              <th scope="col" className={TH}>Pelanggan</th>
              <th scope="col" className={TH}>Pekerjaan</th>
              <th scope="col" className={TH}>Status</th>
              <th scope="col" className={TH_NUM}>Nilai</th>
              <th scope="col" className={TH_NUM}>Bayar</th>
              <th scope="col" className={TH_NUM}>Sisa</th>
              <th scope="col" className={`${TH} w-12`}><span className="sr-only">Buka detail</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const { rowMode, remaining, unpaid, isLate, st, primary } = historyMeta(row, today, uniqueCodeEnabled);
              const detail = `/invoice/${row.id}`;
              /* Warna nominal mengikuti aturan kartu: biasa, redup untuk
                 draft/batal, dan hijau ketika lunas (atau dokumen tanpa
                 pembayaran, mis. surat jalan). */
              const nilaiTone =
                row.status === "batal" || row.status === "draft"
                  ? "text-[color:var(--pf-ink-3)]"
                  : row.payStatus === "lunas" || !rowMode.hasPayments
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-[color:var(--pf-ink)]";

              return (
                <tr
                  key={row.id}
                  className="border-t border-[color:var(--pf-line-soft)] transition-colors hover:bg-[color:var(--pf-surface-2)]"
                >
                  <td className={`${TD} min-w-[140px]`}>
                    <Link
                      href={detail}
                      className="inline-block max-w-[220px] truncate font-semibold text-[color:var(--pf-accent-strong)] hover:underline"
                    >
                      {row.number ?? `Draft #${row.id}`}
                    </Link>
                    <p className="mt-0.5 text-[10.5px] font-semibold text-[color:var(--pf-ink-3)]">{rowMode.label}</p>
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>{formatDateID(row.issueDate)}</td>
                  <td className={`${TD} max-w-[190px]`}>
                    <span className="block truncate font-medium text-[color:var(--pf-ink)]">
                      {customerLabel(row.customerName)}
                    </span>
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {row.orderCode ? (
                      <span className="truncate font-medium text-[color:var(--pf-ink-2)]">{row.orderCode}</span>
                    ) : (
                      DASH
                    )}
                  </td>
                  <td className={`${TD}`}>
                    <span className="flex flex-wrap items-center gap-1">
                      <Chip tone={primary.tone} icon={primary.icon} className="ihc-chip-sm">
                        {primary.label}
                      </Chip>
                      {st && isLate ? (
                        <Chip tone="rose" className="ihc-chip-sm">
                          {st.label}
                        </Chip>
                      ) : st && st.kind === "soon" ? (
                        <Chip tone="amber" className="ihc-chip-sm">
                          {st.label}
                        </Chip>
                      ) : null}
                    </span>
                  </td>
                  <td className={`${TD_NUM} font-semibold ${nilaiTone}`}>
                    {rowMode.showTotals ? formatRupiah(row.total) : DASH}
                  </td>
                  <td className={`${TD_NUM} tabular-nums text-[color:var(--pf-ink-2)]`}>
                    {rowMode.hasPayments && row.paidAmount > 0 ? formatRupiah(row.paidAmount) : DASH}
                  </td>
                  <td className={`${TD_NUM} tabular-nums`}>
                    {unpaid ? (
                      <span className="font-semibold text-rose-600 dark:text-rose-400">{formatRupiah(remaining)}</span>
                    ) : (
                      DASH
                    )}
                  </td>
                  <td className={`${TD} text-center`}>
                    <Link
                      href={detail}
                      aria-label={`Buka detail ${row.number ?? `Draft #${row.id}`}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--pf-accent-strong)] transition-colors hover:bg-[color:var(--pf-accent-soft)]"
                    >
                      <Eye size={15} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
