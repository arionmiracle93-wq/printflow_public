/**
 * PENCARIAN CEPAT (dipakai tombol cari di header)
 * ---------------------------------------------------------------------
 * Satu kotak untuk mencari:
 *   - kode pekerjaan: "PJ-2026-0002", "0002", atau "pj20260002"
 *   - nama pekerjaan atau nama pelanggan: "berkah"
 *   - nomor HP pelanggan: "0812 3456", "+62 812-3456", "8123456"
 * Nomor HP dibandingkan hanya angkanya, dan awalan 62 disamakan dengan 0,
 * jadi cara penulisan yang berbeda tetap ketemu.
 *
 * Hasil pekerjaan mencakup yang sudah selesai (sering dicari pelanggan
 * yang datang lagi), tetapi yang masih aktif selalu ditaruh di atas.
 */
import "server-only";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";

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

/** Angka saja, awalan 62 diganti 0. Dipakai untuk mencocokkan nomor HP. */
function phoneDigits(value: string): string {
  return value.replace(/\D/g, "").replace(/^62/, "0");
}

export async function quickSearch(raw: string): Promise<{ orders: SearchOrder[]; customers: SearchCustomer[] }> {
  const q = raw.trim().slice(0, 60);
  if (q.length < 2) return { orders: [], customers: [] };

  const lower = q.toLowerCase();
  const like = `%${lower}%`;
  const compact = lower.replace(/[^a-z0-9]/g, "");
  const likeCompact = `%${compact}%`;
  const digits = phoneDigits(q);
  // Nomor HP baru dicocokkan kalau ada minimal 4 angka dan tidak ada huruf.
  // Spasi, tanda +, -, titik, dan kurung boleh ("+62 812-3456-7890").
  const phoneOk = digits.length >= 4 && !/[a-z]/i.test(q);
  const likePhone = `%${digits}%`;
  const phoneSql = sql`regexp_replace(regexp_replace(coalesce(${customers.phone}, ''), '[^0-9]', '', 'g'), '^62', '0')`;

  const orderRows = await db
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
    .limit(8);

  const customerRows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      // Nama tabel ditulis lengkap: di dalam sub-kueri, kolom tanpa nama tabel
      // ("id") akan dibaca sebagai kolom tabel orders, bukan customers.
      // Pekerjaan dihitung dari pelanggan terhubung ATAU nama yang sama, karena
      // pekerjaan untuk pelanggan baru bisa tersimpan hanya dengan nama.
      orders: sql<number>`(select count(*) from orders o where o.customer_id = "customers"."id" or lower(o.customer_name) = lower("customers"."name"))::int`,
    })
    .from(customers)
    .where(and(or(sql`lower(${customers.name}) like ${like}`, phoneOk ? sql`${phoneSql} like ${likePhone}` : sql`false`)))
    .orderBy(asc(customers.name))
    .limit(5);

  return {
    orders: orderRows,
    customers: customerRows.map((c) => ({ ...c, orders: Number(c.orders) })),
  };
}
