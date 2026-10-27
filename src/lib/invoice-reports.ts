import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { jakartaDateISO } from "@/lib/domain";
import { dueStatus } from "@/lib/invoice-due";
import { monthEnd, type Period } from "@/lib/invoice-period";

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

export type PayMethodRow = { name: string; amount: number; count: number };

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
  /** Rekap per metode pembayaran (pay_method), terbesar dulu. */
  methods: PayMethodRow[];
};

/** Bagian peringkat yang boleh dilewati kalau tampilannya tidak butuh (hemat query). */
export type ReportParts = { products?: boolean; customers?: boolean; methods?: boolean };

/** Angka ringkas satu periode: cukup untuk kartu KPI, delta pembanding, dan grafik harian. */
export type ReportLite = Pick<ReportData, "count" | "omzet" | "avg" | "terbayar" | "piutang" | "lunasCount" | "byDay">;

type Rows<T> = { rows: T[] };
const noRows = <T>(): Promise<Rows<T>> => Promise.resolve({ rows: [] });

/**
 * SATU query per-hari menggantikan dua query lama (agregat + per hari).
 * Semua angka ringkas (jumlah, omzet, terbayar, piutang, lunas) cukup
 * dijumlahkan dari baris per-hari di sini, jadi hasilnya identik dengan
 * versi lama tapi hemat satu kali bolak-balik ke database.
 */
async function loadTotals(from: string, to: string): Promise<ReportLite> {
  const r = await db.execute<Record<string, string>>(sql`
    select to_char(issue_date, 'YYYY-MM-DD') as d,
           count(*)::text as c,
           coalesce(sum(total), 0)::text as omzet,
           coalesce(sum(least(paid_amount, total)), 0)::text as terbayar,
           coalesce(sum(case when pay_status <> 'lunas' then total - paid_amount else 0 end), 0)::text as piutang,
           count(*) filter (where pay_status = 'lunas')::text as lunas
      from invoices where ${INV} and issue_date between ${from}::date and ${to}::date
     group by issue_date
  `);
  let count = 0;
  let omzet = 0;
  let terbayar = 0;
  let piutang = 0;
  let lunasCount = 0;
  const byDay: Record<string, number> = {};
  (r.rows as Record<string, string>[]).forEach((x) => {
    const dayOmzet = num(x.omzet);
    count += num(x.c);
    omzet += dayOmzet;
    terbayar += num(x.terbayar);
    piutang += num(x.piutang);
    lunasCount += num(x.lunas);
    byDay[x.d] = dayOmzet;
  });
  return { count, omzet, avg: count ? omzet / count : 0, terbayar, piutang, lunasCount, byDay };
}

/**
 * Versi RINGAN: hanya angka ringkas + omzet per hari (1 query).
 * Dipakai untuk periode PEMBANDING, yang tidak butuh peringkat produk /
 * pelanggan / metode bayar.
 */
export async function getReportLite(from: string, to: string): Promise<ReportLite> {
  return loadTotals(from, to);
}

export async function getReport(
  from: string,
  to: string,
  /* Batas panjang daftar peringkat. Halaman Ringkasan memotong
     lima besar di depan UI, tab khusus Produk/Pelanggan menampilkan
     daftar lebih panjang dari satu pool query yang sama.
     `parts` mematikan peringkat yang tidak dipakai tampilan (bawaan:
     semua menyala, jadi pemanggil lama tidak berubah perilakunya). */
  opts?: { productLimit?: number; customerLimit?: number; parts?: ReportParts },
): Promise<ReportData> {
  const productLimit = opts?.productLimit ?? 6;
  const customerLimit = opts?.customerLimit ?? 5;
  const wantProducts = opts?.parts?.products ?? true;
  const wantCustomers = opts?.parts?.customers ?? true;
  const wantMethods = opts?.parts?.methods ?? true;

  type ProdRow = { name: string; amount: string; qty: string; c: string };
  type CustRow = { name: string; amount: string; c: string };
  type MethodRow = { name: string; amount: string; c: string };

  const [totals, prods, custs, methods] = await Promise.all([
    loadTotals(from, to),
    wantProducts
      ? db.execute<ProdRow>(sql`
      select min(it.product_name) as name, coalesce(sum(it.amount), 0)::text as amount,
             coalesce(sum(it.qty), 0)::text as qty, count(*)::text as c
        from invoice_items it join invoices i on i.id = it.invoice_id
       where i.doc_type = 'invoice' and i.status = 'terbit' and i.issue_date between ${from}::date and ${to}::date
         and btrim(it.product_name) <> ''
       group by lower(btrim(it.product_name))
       order by sum(it.amount) desc limit ${productLimit}
    `)
      : noRows<ProdRow>(),
    wantCustomers
      ? db.execute<CustRow>(sql`
      select coalesce(nullif(min(btrim(customer_name)), ''), 'Tanpa nama') as name, coalesce(sum(total), 0)::text as amount, count(*)::text as c
        from invoices where ${INV} and issue_date between ${from}::date and ${to}::date
       group by lower(btrim(customer_name))
       order by sum(total) desc limit ${customerLimit}
    `)
      : noRows<CustRow>(),
    wantMethods
      ? db.execute<MethodRow>(sql`
      select coalesce(nullif(btrim(pay_method), ''), 'Lainnya') as name,
             coalesce(sum(total), 0)::text as amount, count(*)::text as c
        from invoices where ${INV} and issue_date between ${from}::date and ${to}::date
       group by coalesce(nullif(btrim(pay_method), ''), 'Lainnya')
       order by sum(total) desc limit 6
    `)
      : noRows<MethodRow>(),
  ]);
  return {
    ...totals,
    products: (prods.rows as ProdRow[]).map((r) => ({ name: r.name, amount: num(r.amount), qty: Number(r.qty) || 0, count: num(r.c) })),
    customers: (custs.rows as CustRow[]).map((r) => ({ name: r.name, amount: num(r.amount), qty: 0, count: num(r.c) })),
    methods: (methods.rows as MethodRow[]).map((r) => ({ name: r.name, amount: num(r.amount), count: num(r.c) })),
  };
}

export type PayMethodTx = {
  number: string;
  issueDate: string;
  customer: string;
  amount: number;
  paid: number;
  remaining: number;
  lunas: boolean;
};

export type PayMethodLedger = {
  method: string;
  count: number;
  total: number;
  paid: number;
  due: number;
  rows: PayMethodTx[];
};

/**
 * BUKU TRANSAKSI SATU METODE PEMBAYARAN: rekapjumlah + daftar invoice
 * terbaru pada periode aktif yang memakai metode tsb. Nama metode
 * dinormalisasi dengan pendekatan yang sama dengan rekap metode
 * (kosong -> "Lainnya") supaya selalu nyambung.
 */
export async function getPayMethodLedger(from: string, to: string, method: string): Promise<PayMethodLedger> {
  const [agg, list] = await Promise.all([
    db.execute<Record<string, string>>(sql`
      select count(*)::text as c,
             coalesce(sum(total), 0)::text as total,
             coalesce(sum(least(paid_amount, total)), 0)::text as paid,
             coalesce(sum(greatest(total - least(paid_amount, total), 0)), 0)::text as due
        from invoices
       where ${INV} and issue_date between ${from}::date and ${to}::date
         and coalesce(nullif(btrim(pay_method), ''), 'Lainnya') = ${method}
    `),
    db.execute<Record<string, string | null>>(sql`
      select i.number, to_char(i.issue_date, 'YYYY-MM-DD') as issue_date,
             coalesce(nullif(btrim(i.customer_name), ''), 'Tanpa nama') as customer,
             i.total, i.paid_amount, i.pay_status
        from invoices i
       where i.doc_type = 'invoice' and i.status = 'terbit' and i.issue_date between ${from}::date and ${to}::date
         and coalesce(nullif(btrim(i.pay_method), ''), 'Lainnya') = ${method}
       order by i.issue_date desc, i.id desc
       limit 60
    `),
  ]);
  const a = (agg.rows as Record<string, string>[])[0] ?? {};
  return {
    method,
    count: num(a.c),
    total: num(a.total),
    paid: num(a.paid),
    due: num(a.due),
    rows: (list.rows as Record<string, string | null>[]).map((x) => {
      const total = num(x.total);
      const paidAmt = num(x.paid_amount);
      const lunas = x.pay_status === "lunas";
      return {
        number: x.number ?? "",
        issueDate: x.issue_date ?? "",
        customer: x.customer ?? "",
        amount: total,
        paid: lunas ? total : paidAmt,
        remaining: lunas ? 0 : Math.max(0, total - paidAmt),
        lunas,
      };
    }),
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
export async function getExportRows(opts: {
  from?: string;
  to?: string;
  month?: string;
  /** Samakan dengan filter status di halaman riwayat: belum | sebagian | lunas | lewat. */
  payStatus?: string;
}): Promise<ExportRow[]> {
  const today = jakartaDateISO();
  /* Rentang tanggal biasa (bukan to_char) supaya index issue_date terpakai. */
  const dateCond =
    opts.from && opts.to
      ? sql`and i.issue_date between ${opts.from}::date and ${opts.to}::date`
      : opts.month
        ? sql`and i.issue_date >= ${`${opts.month}-01`}::date and i.issue_date <= ${monthEnd(opts.month)}::date`
        : sql``;
  const statusCond =
    opts.payStatus === "belum" || opts.payStatus === "sebagian" || opts.payStatus === "lunas"
      ? sql`and i.pay_status = ${opts.payStatus}`
      : opts.payStatus === "lewat"
        ? sql`and i.pay_status <> 'lunas' and i.due_date < ${today}::date`
        : sql``;
  const cond = sql`${dateCond} ${statusCond}`;
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
