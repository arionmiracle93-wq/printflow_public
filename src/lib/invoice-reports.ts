import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { jakartaDateISO } from "@/lib/domain";
import { dueStatus } from "@/lib/invoice-due";
import type { Period } from "@/lib/invoice-period";

/**
 * RINGKASAN PIUTANG & LAPORAN (diporting dari app lama)
 * Hanya dokumen berjenis Invoice yang sudah TERBIT (draft/batal/estimasi/SJ/PO tidak dihitung).
 * Nilai "belum dibayar" memakai sisa tagihan DASAR (tanpa kode unik: kode unik bukan pendapatan).
 */

const INV = sql`doc_type = 'invoice' and status = 'terbit'`;
const num = (v: unknown) => Number.parseInt(String(v ?? "0"), 10) || 0;

export type ARSummary = {
  due: number;
  dueCount: number;
  late: number;
  lateCount: number;
  paid: number;
};

/** Ringkasan di atas Riwayat: Belum Dibayar, Lewat Tempo, Sudah Dibayar. */
export async function getARSummary(): Promise<ARSummary> {
  const today = jakartaDateISO();
  const r = await db.execute<Record<string, string>>(sql`
    select
      coalesce(sum(case when pay_status <> 'lunas' then total - paid_amount else 0 end), 0)::text as due,
      count(*) filter (where pay_status <> 'lunas')::text as due_count,
      coalesce(sum(case when pay_status <> 'lunas' and due_date < ${today}::date then total - paid_amount else 0 end), 0)::text as late,
      count(*) filter (where pay_status <> 'lunas' and due_date < ${today}::date)::text as late_count,
      coalesce(sum(least(paid_amount, total)), 0)::text as paid
    from invoices where ${INV}
  `);
  const x = (r.rows as Record<string, string>[])[0] ?? {};
  return { due: num(x.due), dueCount: num(x.due_count), late: num(x.late), lateCount: num(x.late_count), paid: num(x.paid) };
}

export type RankRow = { name: string; amount: number; qty: number; count: number };

export type ReportData = {
  count: number;
  omzet: number;
  avg: number;
  terbayar: number;
  piutang: number;
  lunasCount: number;
  byDay: Record<string, number>;
  products: RankRow[];
  customers: RankRow[];
};

export type Totals = Pick<ReportData, "count" | "omzet">;

export async function getReport(from: string, to: string): Promise<ReportData> {
  const [agg, days, prods, custs] = await Promise.all([
    db.execute<Record<string, string>>(sql`
      select count(*)::text as c,
             coalesce(sum(total), 0)::text as omzet,
             coalesce(sum(least(paid_amount, total)), 0)::text as terbayar,
             coalesce(sum(case when pay_status <> 'lunas' then total - paid_amount else 0 end), 0)::text as piutang,
             count(*) filter (where pay_status = 'lunas')::text as lunas
        from invoices where ${INV} and issue_date between ${from}::date and ${to}::date
    `),
    db.execute<{ d: string; omzet: string }>(sql`
      select to_char(issue_date, 'YYYY-MM-DD') as d, coalesce(sum(total), 0)::text as omzet
        from invoices where ${INV} and issue_date between ${from}::date and ${to}::date
       group by issue_date
    `),
    db.execute<{ name: string; amount: string; qty: string; c: string }>(sql`
      select min(it.product_name) as name, coalesce(sum(it.amount), 0)::text as amount,
             coalesce(sum(it.qty), 0)::text as qty, count(*)::text as c
        from invoice_items it join invoices i on i.id = it.invoice_id
       where i.doc_type = 'invoice' and i.status = 'terbit' and i.issue_date between ${from}::date and ${to}::date
         and btrim(it.product_name) <> ''
       group by lower(btrim(it.product_name))
       order by sum(it.amount) desc limit 6
    `),
    db.execute<{ name: string; amount: string; c: string }>(sql`
      select coalesce(nullif(min(btrim(customer_name)), ''), 'Tanpa nama') as name, coalesce(sum(total), 0)::text as amount, count(*)::text as c
        from invoices where ${INV} and issue_date between ${from}::date and ${to}::date
       group by lower(btrim(customer_name))
       order by sum(total) desc limit 5
    `),
  ]);
  const a = (agg.rows as Record<string, string>[])[0] ?? {};
  const count = num(a.c);
  const omzet = num(a.omzet);
  const byDay: Record<string, number> = {};
  (days.rows as { d: string; omzet: string }[]).forEach((r) => {
    byDay[r.d] = num(r.omzet);
  });
  return {
    count,
    omzet,
    avg: count ? omzet / count : 0,
    terbayar: num(a.terbayar),
    piutang: num(a.piutang),
    lunasCount: num(a.lunas),
    byDay,
    products: (prods.rows as { name: string; amount: string; qty: string; c: string }[]).map((r) => ({ name: r.name, amount: num(r.amount), qty: Number(r.qty) || 0, count: num(r.c) })),
    customers: (custs.rows as { name: string; amount: string; c: string }[]).map((r) => ({ name: r.name, amount: num(r.amount), qty: 0, count: num(r.c) })),
  };
}

export type ExportRow = {
  number: string;
  issueDate: string;
  dueDate: string;
  customer: string;
  phone: string;
  method: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  dp: number;
  installment: number;
  installmentCount: number;
  paid: number;
  remaining: number;
  status: string;
  dueNote: string;
};

/** Baris rincian Invoice terbit (untuk Export CSV rekap & laporan). Opsional dibatasi tanggal / bulan. */
export async function getExportRows(opts: { from?: string; to?: string; month?: string }): Promise<ExportRow[]> {
  const today = jakartaDateISO();
  const cond =
    opts.from && opts.to
      ? sql`and i.issue_date between ${opts.from}::date and ${opts.to}::date`
      : opts.month
        ? sql`and to_char(i.issue_date, 'YYYY-MM') = ${opts.month}`
        : sql``;
  const r = await db.execute<Record<string, string | null>>(sql`
    select i.number, to_char(i.issue_date,'YYYY-MM-DD') as issue_date, to_char(i.due_date,'YYYY-MM-DD') as due_date,
           i.customer_name, i.customer_phone, i.pay_method, i.subtotal, i.discount_amount, i.tax_amount, i.total,
           i.paid_amount, i.pay_status,
           coalesce((select sum(amount) from payments p where p.invoice_id = i.id and p.voided_at is null and p.kind = 'dp'), 0) as dp,
           coalesce((select sum(amount) from payments p where p.invoice_id = i.id and p.voided_at is null and p.kind <> 'dp'), 0) as inst,
           coalesce((select count(*) from payments p where p.invoice_id = i.id and p.voided_at is null and p.kind <> 'dp'), 0) as inst_n
      from invoices i
     where i.doc_type = 'invoice' and i.status = 'terbit' ${cond}
     order by i.issue_date, i.id
  `);
  return (r.rows as Record<string, string | null>[]).map((x) => {
    const total = num(x.total);
    const paid = num(x.paid_amount);
    const lunas = x.pay_status === "lunas";
    const st = dueStatus(x.due_date, lunas, today);
    return {
      number: x.number ?? "",
      issueDate: x.issue_date ?? "",
      dueDate: x.due_date ?? "",
      customer: x.customer_name ?? "",
      phone: x.customer_phone ?? "",
      method: x.pay_method ?? "",
      subtotal: num(x.subtotal),
      discount: num(x.discount_amount),
      tax: num(x.tax_amount),
      total,
      dp: num(x.dp),
      installment: num(x.inst),
      installmentCount: num(x.inst_n),
      paid: lunas ? total : paid,
      remaining: lunas ? 0 : Math.max(0, total - paid),
      status: lunas ? "LUNAS" : paid > 0 ? "SEBAGIAN" : "BELUM",
      dueNote: st ? st.label : "",
    };
  });
}

/** Satu sel CSV (titik koma sebagai pemisah, sama seperti app lama). */
export function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return `\uFEFF${rows.map((r) => r.map(csvCell).join(";")).join("\r\n")}`;
}

export function periodLabelForCsv(p: Period): string {
  return p.mode === "monthly" ? "LAPORAN BULANAN" : p.mode === "daily" ? "LAPORAN HARIAN" : "LAPORAN RENTANG";
}
