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
      const result = await db.execute<Record<string, unknown>>(sql`
        select code, customer_name, title, product_type, quantity, unit, price, paid_amount,
               (price - paid_amount) as sisa_tagihan, status, priority, due_date, due_time, created_at
        from orders order by due_date asc
      `);
      const rows = result.rows as Record<string, unknown>[];
      return csvResponse(
        `keuangan-${stamp}.csv`,
        [
          "Kode", "Pelanggan", "Pekerjaan", "Jenis", "Jumlah", "Satuan",
          "Harga (Rp)", "Dibayar (Rp)", "Sisa Tagihan (Rp)", "Status", "Prioritas", "Deadline", "Jam", "Dibuat",
        ],
        rows.map((r) => [
          r.code, r.customer_name, r.title, r.product_type, r.quantity, r.unit,
          r.price, r.paid_amount, r.sisa_tagihan, r.status, r.priority, r.due_date, r.due_time, r.created_at,
        ]),
      );
    }

    const result = await db.execute<Record<string, unknown>>(sql`
      select id, code, customer_name, title, product_type, quantity, unit, machine, operator,
             status, priority, price, paid_amount, due_date, due_time, est_hours, notes, pic, created_at, updated_at
      from orders order by id asc
    `);
    const rows = result.rows as Record<string, unknown>[];
    return csvResponse(
      `pekerjaan-${stamp}.csv`,
      [
        "ID", "Kode", "Pelanggan", "Pekerjaan", "Jenis", "Jumlah", "Satuan", "Mesin", "Operator",
        "Status", "Prioritas", "Harga (Rp)", "Dibayar (Rp)", "Deadline", "Jam", "Estimasi Jam Kerja",
        "Catatan", "PIC", "Dibuat", "Diubah",
      ],
      rows.map((r) => [
        r.id, r.code, r.customer_name, r.title, r.product_type, r.quantity, r.unit, r.machine, r.operator,
        r.status, r.priority, r.price, r.paid_amount, r.due_date, r.due_time, r.est_hours, r.notes, r.pic,
        r.created_at, r.updated_at,
      ]),
    );
  } catch (error) {
    console.error("GET /api/export", error);
    return problemResponse(error);
  }
}
