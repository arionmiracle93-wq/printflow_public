import { sql } from "drizzle-orm";
import { db } from "@/db";
import { problemResponse } from "@/lib/dbcheck";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  // Escape agar aman dibuka di Excel (terutama koma & tanda kutip)
  return `"${text.replace(/"/g, '""')}"`;
}

function csvResponse(filename: string, headers: string[], rows: unknown[][]): Response {
  const lines = [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))];
  // \uFEFF (BOM) supaya karakter Indonesia tampil benar saat dibuka di Excel
  const body = `\uFEFF${lines.join("\r\n")}`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "orders";
  const stamp = new Date().toISOString().slice(0, 10);

  try {
    if (type === "pelanggan") {
      const result = await db.execute<Record<string, unknown>>(sql`
        select c.id, c.name, c.phone, c.email, c.address, c.notes, c.created_at,
               (select count(*) from orders o where o.customer_id = c.id)::int as total_pesanan,
               (select coalesce(sum(o.price),0) from orders o where o.customer_id = c.id)::int as total_nilai
        from customers c order by c.name asc
      `);
      const rows = result.rows as Record<string, unknown>[];
      return csvResponse(
        `pelanggan-${stamp}.csv`,
        ["ID", "Nama", "WhatsApp", "Email", "Alamat", "Catatan", "Terdaftar", "Total Pesanan", "Total Nilai (Rp)"],
        rows.map((r) => [r.id, r.name, r.phone, r.email, r.address, r.notes, r.created_at, r.total_pesanan, r.total_nilai]),
      );
    }

    if (type === "riwayat") {
      const result = await db.execute<Record<string, unknown>>(sql`
        select e.id, o.code, o.title, e.from_status, e.to_status, e.note, e.actor, e.created_at
        from order_events e join orders o on o.id = e.order_id
        order by e.created_at desc
      `);
      const rows = result.rows as Record<string, unknown>[];
      return csvResponse(
        `riwayat-produksi-${stamp}.csv`,
        ["ID", "Kode", "Pekerjaan", "Dari Status", "Ke Status", "Catatan", "Oleh", "Waktu"],
        rows.map((r) => [r.id, r.code, r.title, r.from_status, r.to_status, r.note, r.actor, r.created_at]),
      );
    }

    if (type === "keuangan") {
      // Isi produk digabung jadi satu sel ("Spanduk 2 pcs; Stiker 500 lembar")
      // supaya satu baris CSV tetap = satu pekerjaan, sama seperti kartu di
      // aplikasi. Untuk rincian per produk, pakai type=item.
      const result = await db.execute<Record<string, unknown>>(sql`
        select o.code, o.customer_name, o.title,
               coalesce((
                 select string_agg(i.product_type || ' ' || i.quantity || ' ' || i.unit, '; '
                        order by i.position, i.id)
                 from order_items i where i.order_id = o.id
               ), '') as isi_pesanan,
               coalesce((select count(*) from order_items i where i.order_id = o.id), 0)::int as jumlah_item,
               o.price, o.paid_amount,
               (o.price - o.paid_amount) as sisa_tagihan, o.status, o.priority, o.due_date, o.due_time, o.created_at
        from orders o order by o.due_date asc
      `);
      const rows = result.rows as Record<string, unknown>[];
      return csvResponse(
        `keuangan-${stamp}.csv`,
        [
          "Kode", "Pelanggan", "Pekerjaan", "Isi Pesanan", "Jumlah Item",
          "Harga (Rp)", "Dibayar (Rp)", "Sisa Tagihan (Rp)", "Status", "Prioritas", "Deadline", "Jam", "Dibuat",
        ],
        rows.map((r) => [
          r.code, r.customer_name, r.title, r.isi_pesanan, r.jumlah_item,
          r.price, r.paid_amount, r.sisa_tagihan, r.status, r.priority, r.due_date, r.due_time, r.created_at,
        ]),
      );
    }

    // Rincian per produk: satu baris CSV = satu item produk. Berguna untuk
    // menghitung "bulan ini cetak berapa spanduk" lintas semua pekerjaan.
    if (type === "item") {
      const result = await db.execute<Record<string, unknown>>(sql`
        select o.code, o.customer_name, o.title, o.status, o.due_date, o.due_time,
               i.position, i.product_type, i.quantity, i.unit
        from order_items i join orders o on o.id = i.order_id
        order by o.due_date asc, o.id asc, i.position asc, i.id asc
      `);
      const rows = result.rows as Record<string, unknown>[];
      return csvResponse(
        `item-pekerjaan-${stamp}.csv`,
        ["Kode", "Pelanggan", "Pekerjaan", "Status", "Deadline", "Jam", "Urutan", "Jenis Produk", "Jumlah", "Satuan"],
        rows.map((r) => [
          r.code, r.customer_name, r.title, r.status, r.due_date, r.due_time,
          Number(r.position ?? 0) + 1, r.product_type, r.quantity, r.unit,
        ]),
      );
    }

    const result = await db.execute<Record<string, unknown>>(sql`
      select o.id, o.code, o.customer_name, o.title,
             coalesce((
               select string_agg(i.product_type || ' ' || i.quantity || ' ' || i.unit, '; '
                      order by i.position, i.id)
               from order_items i where i.order_id = o.id
             ), '') as isi_pesanan,
             coalesce((select count(*) from order_items i where i.order_id = o.id), 0)::int as jumlah_item,
             o.machine, o.operator,
             o.status, o.priority, o.price, o.paid_amount, o.due_date, o.due_time, o.est_hours,
             o.notes, o.pic, o.created_at, o.updated_at
      from orders o order by o.id asc
    `);
    const rows = result.rows as Record<string, unknown>[];
    return csvResponse(
      `pekerjaan-${stamp}.csv`,
      [
        "ID", "Kode", "Pelanggan", "Pekerjaan", "Isi Pesanan", "Jumlah Item", "Mesin", "Operator",
        "Status", "Prioritas", "Harga (Rp)", "Dibayar (Rp)", "Deadline", "Jam", "Estimasi Jam Kerja",
        "Catatan", "PIC", "Dibuat", "Diubah",
      ],
      rows.map((r) => [
        r.id, r.code, r.customer_name, r.title, r.isi_pesanan, r.jumlah_item, r.machine, r.operator,
        r.status, r.priority, r.price, r.paid_amount, r.due_date, r.due_time, r.est_hours, r.notes, r.pic,
        r.created_at, r.updated_at,
      ]),
    );
  } catch (error) {
    console.error("GET /api/export", error);
    return problemResponse(error);
  }
}
