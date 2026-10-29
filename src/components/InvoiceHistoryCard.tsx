import Link from "next/link";
import type { ReactNode } from "react";
import {
  Ban,
  BellRing,
  Briefcase,
  CalendarClock,
  CalendarDays,
  CircleCheck,
  CircleDashed,
  Clock,
  FileText,
  Hammer,
  Landmark,
  PencilLine,
  Wallet,
} from "lucide-react";
import { customerLabel, formatDateID, formatRupiah, statusMeta } from "@/lib/domain";
import { dueStatus } from "@/lib/invoice-due";
import { DOC_MODES, isDocType, type DocMode, type DocType } from "@/lib/invoice-modes";
import { computePayInfo } from "@/lib/invoice-pay";
import type { listInvoices } from "@/lib/invoice-queries";

export type InvoiceHistoryCardRow = Awaited<ReturnType<typeof listInvoices>>["rows"][number];

type InvoiceRow = InvoiceHistoryCardRow;

export type Tone = "green" | "teal" | "blue" | "rose" | "amber" | "slate" | "sky" | "violet";

/* Warna lencana jenis dokumen. Invoice biru (seperti referensi desain),
   sisanya mengikuti warna lama tiap mode supaya Estimasi / Surat Jalan / PO
   tetap mudah dibedakan sekilas. */
const DOC_TONE: Record<DocType, Tone> = {
  invoice: "blue",
  estimasi: "amber",
  suratjalan: "sky",
  po: "violet",
};

export function Chip({ tone, icon, children, className = "" }: { tone: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={`ihc-chip ihc-tone-${tone} ${className}`.trim()}>
      {icon}
      {children}
    </span>
  );
}

function Row({ icon, label, children, tone }: { icon: ReactNode; label: string; children: ReactNode; tone?: "rose" }) {
  return (
    <div className="ihc-row">
      <dt className="ihc-row-label">
        <span className="ihc-row-ico" aria-hidden="true">
          {icon}
        </span>
        {label}
      </dt>
      <dd className={`ihc-row-value${tone === "rose" ? " ihc-row-value-rose" : ""}`}>{children}</dd>
    </div>
  );
}

/**
 * Angka dan status yang dipakai bersama oleh kartu (Kartu / Padat) dan
 * baris daftar (Ringkas). Dihitung sekali di satu tempat supaya ketiga
 * tampilan tidak pernah berbeda soal status bayar, sisa tagihan, atau
 * warna nominal.
 */
export function historyMeta(row: InvoiceRow, today: string, uniqueCodeEnabled: boolean) {
  const docType: DocType = isDocType(row.docType) ? row.docType : "invoice";
  const rowMode: DocMode = DOC_MODES[docType];
  const isInv = docType === "invoice";
  const remaining = Math.max(0, row.total - row.paidAmount);
  const unpaid = isInv && row.status === "terbit" && row.payStatus !== "lunas";
  const pay = computePayInfo({
    total: row.total,
    paid: row.paidAmount,
    method: row.payMethod,
    number: row.number,
    uniqueCodeEnabled,
  });
  const st = unpaid ? dueStatus(row.dueDate, false, today) : null;
  const isLate = st?.kind === "late" || st?.kind === "today";

  /* Status utama (pojok kanan atas). */
  let primary: { tone: Tone; icon: ReactNode; label: string };
  let primaryIsPay = false;
  if (row.status === "batal") primary = { tone: "rose", icon: <Ban size={13} />, label: "Batal" };
  else if (row.status === "draft") primary = { tone: "slate", icon: <PencilLine size={13} />, label: "Draft" };
  else if (rowMode.hasPayments) {
    primaryIsPay = true;
    if (row.payStatus === "lunas") primary = { tone: "green", icon: <CircleCheck size={13} />, label: "Lunas" };
    else if (row.payStatus === "sebagian") primary = { tone: "amber", icon: <Clock size={13} />, label: "Sebagian" };
    else primary = { tone: "rose", icon: <CircleDashed size={13} />, label: "Belum bayar" };
  } else primary = { tone: "teal", icon: <CircleCheck size={13} />, label: "Terbit" };

  const totalClass =
    row.status === "batal" || row.status === "draft"
      ? "ihc-total ihc-total-muted"
      : row.payStatus === "lunas" || !rowMode.hasPayments
        ? "ihc-total ihc-total-ok"
        : "ihc-total";

  /* Status produksi dari pekerjaan yang tertaut (cermin, read-only). */
  const prod = row.orderStatus ? statusMeta(row.orderStatus) : null;
  const prodDone = row.orderStatus === "selesai" || row.orderStatus === "siap";

  return { docType, rowMode, isInv, remaining, unpaid, pay, st, isLate, primary, primaryIsPay, totalClass, prod, prodDone };
}

/**
 * Kartu satu dokumen di halaman Riwayat (/invoice).
 *
 * Dua bentuk:
 *  - "kartu" (bawaan): kepala + baris info + deretan lencana, seperti
 *    desain referensi.
 *  - "padat": hanya kepala + satu baris meta (tanggal, pekerjaan, sisa).
 *    Dipakai oleh pilihan tampilan Padat supaya lebih banyak dokumen
 *    terlihat sekaligus.
 *
 * Komponen murni (tanpa state / event handler), jadi aman dipakai dari
 * Server Component maupun Client Component.
 */
export function InvoiceHistoryCard({
  row,
  today,
  uniqueCodeEnabled,
  variant = "kartu",
}: {
  row: InvoiceRow;
  today: string;
  uniqueCodeEnabled: boolean;
  /** "padat" = kartu kecil tanpa baris detail. Bawaan: kartu lengkap. */
  variant?: "kartu" | "padat";
}) {
  const { docType, rowMode, isInv, remaining, unpaid, pay, st, isLate, primary, primaryIsPay, totalClass, prod, prodDone } = historyMeta(
    row,
    today,
    uniqueCodeEnabled,
  );
  const dense = variant === "padat";

  return (
    <div className={`ihc${dense ? " ihc-dense" : ""}`}>
      <Link href={`/invoice/${row.id}`} className="ihc-link">
        <div className="ihc-head">
          <span className="ihc-doc-ico" aria-hidden="true">
            <FileText size={18} strokeWidth={2.1} />
          </span>
          <div className="ihc-id">
            <p className="ihc-number">{row.number ?? `Draft #${row.id}`}</p>
            <p className="ihc-name">{customerLabel(row.customerName)}</p>
          </div>
          <div className="ihc-side">
            <Chip tone={primary.tone} icon={primary.icon}>
              {primary.label}
            </Chip>
            {rowMode.showTotals ? <p className={totalClass}>{formatRupiah(row.total)}</p> : null}
          </div>
        </div>

        {dense ? (
          <div className="ihc-dense-meta">
            <span>
              <CalendarDays size={11} aria-hidden="true" /> {formatDateID(row.issueDate)}
            </span>
            {row.orderCode ? (
              <span>
                <Briefcase size={11} aria-hidden="true" /> {row.orderCode}
              </span>
            ) : null}
            {unpaid ? (
              <span className="ihc-dense-remaining">
                <Wallet size={11} aria-hidden="true" /> Sisa {formatRupiah(remaining)}
              </span>
            ) : null}
          </div>
        ) : (
          <>
            <div className="ihc-rule" aria-hidden="true" />

            <dl className="ihc-rows">
              <Row icon={<CalendarDays size={13} />} label="Tanggal">
                {formatDateID(row.issueDate)}
              </Row>
              {row.orderCode ? (
                <Row icon={<Briefcase size={13} />} label="Pekerjaan">
                  {row.orderCode}
                </Row>
              ) : null}
              {rowMode.hasPayments && row.dueDate && unpaid ? (
                <Row icon={<CalendarClock size={13} />} label="Jatuh tempo" tone={isLate ? "rose" : undefined}>
                  {formatDateID(row.dueDate)}
                </Row>
              ) : null}
              {unpaid ? (
                <Row icon={<Wallet size={13} />} label="Sisa tagihan" tone="rose">
                  {formatRupiah(remaining)}
                </Row>
              ) : null}
              {isInv && row.status === "terbit" && row.paidAmount > 0 && row.payStatus !== "lunas" ? (
                <Row icon={<CircleCheck size={13} />} label="Sudah dibayar">
                  {formatRupiah(row.paidAmount)}
                </Row>
              ) : null}
              {unpaid && row.payMethod === "Transfer" && pay.code > 0 ? (
                <Row icon={<Landmark size={13} />} label="Transfer">
                  {formatRupiah(pay.payable)} <span className="ihc-row-note">(kode unik {pay.code})</span>
                </Row>
              ) : null}
            </dl>

            <div className="ihc-pills">
              <Chip tone={DOC_TONE[docType]}>{rowMode.label}</Chip>
              {row.status === "terbit" && primaryIsPay ? <Chip tone="teal">Terbit</Chip> : null}
              {st && isLate ? (
                <Chip tone="rose">{st.label}</Chip>
              ) : st && st.kind === "soon" ? (
                <Chip tone="amber">{st.label}</Chip>
              ) : null}
              {prod ? (
                prodDone ? (
                  <Chip tone="green" icon={<CircleCheck size={13} />}>
                    {prod.short}
                  </Chip>
                ) : (
                  <span className={`ihc-chip ${prod.badge}`} title="Status produksi (dari PrintFlow)">
                    <Hammer size={12} />
                    {prod.short}
                  </span>
                )
              ) : null}
            </div>
          </>
        )}
      </Link>

      {unpaid && !dense ? (
        <Link
          href={`/invoice/${row.id}?tagih=1`}
          className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
        >
          <BellRing size={13} /> Tagih lewat WhatsApp
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Satu baris dokumen untuk tampilan "Ringkas".
 *
 * Hanya memuat informasi yang dipakai memindai daftar: nomor, pelanggan,
 * tanggal, pekerjaan, nominal, dan status. Detail lain tetap tersedia
 * setelah kartu/baris diklik. Lebih rapat dari kartu Padat, dan di layar
 * lebar disusun dua kolom supaya tidak memanjang sia-sia.
 */
export function InvoiceHistoryRow({
  row,
  today,
  uniqueCodeEnabled,
}: {
  row: InvoiceRow;
  today: string;
  uniqueCodeEnabled: boolean;
}) {
  const { rowMode, primary, totalClass } = historyMeta(row, today, uniqueCodeEnabled);

  return (
    <Link href={`/invoice/${row.id}`} className="ihc-list-row">
      <span className="ihc-doc-ico ihc-doc-ico-sm" aria-hidden="true">
        <FileText size={15} strokeWidth={2.1} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <p className="truncate text-[12px] font-semibold text-[color:var(--pf-ink)]">{row.number ?? `Draft #${row.id}`}</p>
          <p className="truncate text-[10.5px] text-[color:var(--pf-ink-2)]">{customerLabel(row.customerName)}</p>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10.5px] text-[color:var(--pf-ink-3)]">
          <CalendarDays size={10} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{formatDateID(row.issueDate)}</span>
          {row.orderCode ? (
            <>
              <span aria-hidden="true">·</span>
              <Briefcase size={10} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{row.orderCode}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {rowMode.showTotals ? <p className={totalClass}>{formatRupiah(row.total)}</p> : null}
        <Chip tone={primary.tone} icon={primary.icon} className="ihc-chip-sm">
          {primary.label}
        </Chip>
      </div>
    </Link>
  );
}
