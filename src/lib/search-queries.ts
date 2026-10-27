/**
 * PENCARIAN CEPAT (dipakai tombol cari di header)
 * ---------------------------------------------------------------------
 * Satu kotak untuk mencari:
 *   - kode pekerjaan: "PJ-2026-0002", "0002", atau "pj20260002"
 *   - nama pekerjaan atau nama pelanggan: "berkah"
 *   - nomor HP pelanggan: "0812 3456", "+62 812-3456", "8123456"
 *   - nomor dokumen, nama pelanggan di dokumen, dan - yang paling
 *     penting buat kas - NOMINAL TRANSFER: "150000", kode unik
 *     3 digit, atau "akhiran" yang berarti kelipatan tiga digit
 *     ("500000" cocok dengan 1.500.000).
 *
 * Angka yang diketik TIDAK dicari sebagai potongan bebas di dalam nominal.
 * "5000" dulu ikut cocok dengan 75.000 dan 25.000 karena "75000"
 * berakhir dengan "5000" - padahal tidak ada yang membaca "Rp 75.000"
 * sebagai mengandung "5000". Sekarang pencocokan lewat akhiran hanya
 * berlaku kalau jumlah digit habis dibagi 3, yaitu batas kelompok
 * ribuan, sehingga tidak ada kecocokan yang menyeberangi titik. Invoice
 * 5.000 sendiri tetap ditemukan, karena cocok persis. Aturannya di
 * src/lib/invoice-due.ts (bankMatch).
 * Nomor HP dibandingkan hanya angkanya, dan awalan 62 disamakan dengan 0,
 * jadi cara penulisan yang berbeda tetap ketemu.
 *
 * Hasil pekerjaan mencakup yang sudah selesai (sering dicari pelanggan
 * yang datang lagi), tetapi yang masih aktif selalu ditaruh di atas.
 *
 * DOKUMEN IKUT DICARI, TAPI HANYA UNTUK YANG PUNYA IZIN
 * Pencarian dokumen memakai listInvoices, bukan kueri terpisah,
 * supaya aturan pencocokan nominal tidak ditulis ulang di dua tempat.
 * Aturan itu rumit dan diam-diam berubah; kalau diduplikasi, hasil
 * yang dicari di header akan berbeda dari hasil di halaman riwayat.
 *
 * Karyawan yang saklar "Boleh akses Invoice"-nya mati TIDAK mendapat
 * hasil dokumen sama sekali, dan tidak diberi tahu bahwa ada dokumen
 * yang cocok. Bukan disembunyikan saja: kuerinya memang tidak
 * dijalankan, jadi tidak ada yang bisa bocor dari route mana pun.
 */
import "server-only";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { listInvoices } from "@/lib/invoice-queries";
import { getInvoiceSettings } from "@/lib/invoice-settings";

export type SearchOrder = {
  id: number;
  code: string;
  title: string;
  customerName: string;
  status: string;
  dueDate: string;
  dueTime: string;
};

export type SearchCustomer = { id: number; name: string; phone: string | null; orders: number };

export type SearchInvoice = {
  id: number;
  docType: string;
  number: string | null;
  customerName: string;
  status: string;
  payStatus: string;
  total: number;
  issueDate: string;
};

/** Angka saja, awalan 62 diganti 0. Dipakai untuk mencocokkan nomor HP. */
function phoneDigits(value: string): string {
  return value.replace(/\D/g, "").replace(/^62/, "0");
}

export async function quickSearch(
  raw: string,
  opts: { canInvoice: boolean; bulan?: string; tanggal?: string; dari?: string; sampai?: string },
): Promise<{ orders: SearchOrder[]; customers: SearchCustomer[]; invoices: SearchInvoice[] }> {
  const q = raw.trim().slice(0, 60);

  // Filter tanggal DIBATASI ke dokumen saja. Pekerjaan dan pelanggan tetap
  // dicari tanpa dibatasi tanggal, karena kalau ikut dibatasi, cari
  // pekerjaan lama harus memilih ulang rentangnya setiap kali. Kalau
  // nanti ternyata membosankan, aturannya ada di satu tempat: opts ini.
  //
  // Bentuk "yyyy-mm" dan "yyyy-mm-dd" sudah divalidasi di route, tapi dicek
  // sekali lagi di sini supaya fungsi ini aman dipanggil dari mana pun.
  // Nilai rusak diperlakukan sebagai "tanpa filter", bukan sebagai error.
  const bulan = opts.bulan && /^\d{4}-(0[1-9]|1[0-2])$/.test(opts.bulan) ? opts.bulan : undefined;
  const tanggal = opts.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(opts.tanggal) ? opts.tanggal : undefined;
  const dari = opts.dari && /^\d{4}-\d{2}-\d{2}$/.test(opts.dari) ? opts.dari : undefined;
  const sampai = opts.sampai && /^\d{4}-\d{2}-\d{2}$/.test(opts.sampai) ? opts.sampai : undefined;

  if (q.length < 2) return { orders: [], customers: [], invoices: [] };

  const lower = q.toLowerCase();
  const like = `%${lower}%`;
  const compact = lower.replace(/[^a-z0-9]/g, "");
  const likeCompact = `%${compact}%`;
  const digits = phoneDigits(q);
  // Nomor HP baru dicocokkan kalau ada minimal 4 angka dan tidak ada
  // huruf. Spasi, tanda +, -, titik, dan kurung boleh ("+62 812-3456").
  const phoneOk = digits.length >= 4 && !/[a-z]/i.test(q);
  const likePhone = `%${digits}%`;
  const phoneSql = sql`regexp_replace(regexp_replace(coalesce(${customers.phone}, ''), '[^0-9]', '', 'g'), '^62', '0')`;

  // Setting invoice hanya dibaca kalau yang diketik punya angka, karena
  // hanya pencarian nominal yang butuh uniqueCode. Setting yang gagal
  // dibaca tidak menggagalkan pencarian: lebih baik nominal tidak ikut
  // dicocokkan daripada seluruh hasil hilang gara-gara satu baris JSON.
  const digitsForAmount = q.replace(/[^0-9]/g, "");
  const settingsPromise =
    opts.canInvoice && digitsForAmount.length > 0 ? getInvoiceSettings().catch(() => null) : Promise.resolve(null);

  const [orderRows, customerRows, settings] = await Promise.all([
    db
      .select({
        id: orders.id,
        code: orders.code,
        title: orders.title,
        customerName: orders.customerName,
        status: orders.status,
        dueDate: orders.dueDate,
        dueTime: orders.dueTime,
      })
      .from(orders)
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .where(
        or(
          sql`lower(${orders.code}) like ${like}`,
          compact.length >= 2 ? sql`replace(lower(${orders.code}), '-', '') like ${likeCompact}` : sql`false`,
          sql`lower(${orders.title}) like ${like}`,
          sql`lower(${orders.customerName}) like ${like}`,
          phoneOk ? sql`${phoneSql} like ${likePhone}` : sql`false`,
        ),
      )
      .orderBy(
        sql`case when lower(${orders.code}) = ${lower} then 0 else 1 end`,
        sql`case when ${orders.status} in ('selesai', 'batal') then 1 else 0 end`,
        desc(orders.updatedAt),
      )
      .limit(8),
    db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        // Nama tabel ditulis lengkap: di dalam sub-kueri, kolom tanpa nama
        // tabel ("id") akan dibaca sebagai kolom tabel orders, bukan
        // customers. Pekerjaan dihitung dari pelanggan terhubung ATAU nama
        // yang sama, karena pekerjaan untuk pelanggan baru bisa tersimpan
        // hanya dengan nama.
        orders: sql<number>`(select count(*) from orders o where o.customer_id = "customers"."id" or lower(o.customer_name) = lower("customers"."name"))::int`,
      })
      .from(customers)
      .where(and(or(sql`lower(${customers.name}) like ${like}`, phoneOk ? sql`${phoneSql} like ${likePhone}` : sql`false`)))
      .orderBy(asc(customers.name))
      .limit(5),
    settingsPromise,
  ]);

  // Baru setelah settings selesai dibaca. listInvoices membutuhkan
  // nilai uniqueCode, dan tidak bisa menunggu di dalam Promise.all
  // karena nilainya dibaca saat fungsi itu dipanggil.
  // listInvoices mengembalikan { rows, stats }; stats di sini tidak
  // dipakai, dan tanpaStats:true supaya query ringkasan yang
  // menyapu seluruh tabel invoices tidak ikut jalan di setiap ketikan.
  const invoiceRows = opts.canInvoice
    ? (
        await listInvoices({
          q,
          month: bulan,
          tanggal,
          dari,
          sampai,
          uniqueCode: settings?.uniqueCode ?? false,
          limit: 8,
          tanpaStats: true,
        })
      ).rows
    : [];

  return {
    orders: orderRows,
    customers: customerRows.map((c) => ({ ...c, orders: Number(c.orders) })),
    invoices: invoiceRows.map((r) => ({
      id: r.id,
      docType: r.docType,
      number: r.number,
      customerName: r.customerName,
      status: r.status,
      payStatus: r.payStatus,
      total: r.total,
      issueDate: r.issueDate,
    })),
  };
}
