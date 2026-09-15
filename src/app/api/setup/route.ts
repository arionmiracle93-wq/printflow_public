import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

const DDL = [
  `CREATE TABLE IF NOT EXISTS customers (
      id serial PRIMARY KEY,
      name text NOT NULL,
      phone text,
      email text,
      address text,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS orders (
      id serial PRIMARY KEY,
      code text NOT NULL UNIQUE,
      customer_id integer REFERENCES customers(id) ON DELETE SET NULL,
      customer_name text NOT NULL,
      title text NOT NULL,
      product_type text NOT NULL DEFAULT 'Lainnya',
      quantity integer NOT NULL DEFAULT 1,
      unit text NOT NULL DEFAULT 'pcs',
      machine text NOT NULL DEFAULT 'Digital Print',
      operator text,
      status text NOT NULL DEFAULT 'antrian',
      priority text NOT NULL DEFAULT 'normal',
      price integer NOT NULL DEFAULT 0,
      paid_amount integer NOT NULL DEFAULT 0,
      due_date date NOT NULL,
      due_time text NOT NULL DEFAULT '17:00',
      est_hours integer NOT NULL DEFAULT 4,
      notes text,
      pic text NOT NULL DEFAULT 'Owner',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS order_events (
      id serial PRIMARY KEY,
      order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      from_status text,
      to_status text NOT NULL,
      note text,
      actor text NOT NULL DEFAULT 'Owner',
      created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS ai_notes (
      id serial PRIMARY KEY,
      order_id integer REFERENCES orders(id) ON DELETE CASCADE,
      kind text NOT NULL DEFAULT 'insight',
      risk_score integer NOT NULL DEFAULT 0,
      risk_level text NOT NULL DEFAULT 'aman',
      message text NOT NULL,
      source text NOT NULL DEFAULT 'engine',
      created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS settings (
      key text PRIMARY KEY,
      value text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS order_photos (
      id serial PRIMARY KEY,
      order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      kind text NOT NULL DEFAULT 'referensi',
      mime text NOT NULL DEFAULT 'image/jpeg',
      size_bytes integer NOT NULL DEFAULT 0,
      caption text,
      data bytea NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
   )`,
  // Migrasi ringan untuk aplikasi yang sudah terlanjur berjalan (aman diulang).
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS share_token text`,
  `CREATE UNIQUE INDEX IF NOT EXISTS orders_share_token_key ON orders (share_token)`,
  `CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status)`,
  `CREATE INDEX IF NOT EXISTS orders_due_date_idx ON orders (due_date)`,
  `CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_id)`,
  `CREATE INDEX IF NOT EXISTS order_photos_order_idx ON order_photos (order_id)`,
  `CREATE TABLE IF NOT EXISTS production_partners (
      id serial PRIMARY KEY,
      name text NOT NULL,
      kind text NOT NULL DEFAULT 'vendor',
      phone text,
      address text,
      notes text,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS outsource_jobs (
      id serial PRIMARY KEY,
      order_id integer NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      partner_id integer REFERENCES production_partners(id) ON DELETE SET NULL,
      partner_name text NOT NULL,
      status text NOT NULL DEFAULT 'belum_dikirim',
      vendor_cost integer NOT NULL DEFAULT 0,
      sent_at timestamptz,
      expected_date date NOT NULL,
      expected_time text NOT NULL DEFAULT '12:00',
      received_at timestamptz,
      qc_result text,
      notes text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS outsource_jobs_status_idx ON outsource_jobs (status)`,
  `CREATE INDEX IF NOT EXISTS outsource_jobs_partner_idx ON outsource_jobs (partner_id)`,
  `CREATE TABLE IF NOT EXISTS users (
      id serial PRIMARY KEY,
      name text NOT NULL,
      username text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      role text NOT NULL DEFAULT 'karyawan',
      active boolean NOT NULL DEFAULT true,
      token_version integer NOT NULL DEFAULT 1,
      last_login_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  // Migrasi role lama tanpa menghapus akun. token_version dinaikkan agar
  // sesi operator/kasir lama login ulang sebagai Karyawan.
  `ALTER TABLE users ALTER COLUMN role SET DEFAULT 'karyawan'`,
  `UPDATE users SET role = 'karyawan', token_version = token_version + 1, updated_at = now()
     WHERE role IN ('operator', 'kasir')`,
  `CREATE TABLE IF NOT EXISTS login_audit (
      id serial PRIMARY KEY,
      username text NOT NULL,
      user_id integer REFERENCES users(id) ON DELETE SET NULL,
      success boolean NOT NULL,
      ip text,
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS login_audit_created_idx ON login_audit (created_at)`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id serial PRIMARY KEY,
      endpoint text NOT NULL UNIQUE,
      p256dh text NOT NULL,
      auth text NOT NULL,
      device_name text,
      operator_name text,
      user_agent text,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id) ON DELETE CASCADE`,
  `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS user_role text`,
  `CREATE INDEX IF NOT EXISTS push_subscriptions_active_idx ON push_subscriptions (active)`,
  `CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id)`,
  `CREATE TABLE IF NOT EXISTS shift_handovers (
      id serial PRIMARY KEY,
      order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      from_operator text NOT NULL,
      to_operator text NOT NULL,
      shift_label text,
      last_position text NOT NULL,
      blocker text,
      next_action text NOT NULL,
      note text,
      status text NOT NULL DEFAULT 'menunggu',
      handed_over_at timestamptz NOT NULL DEFAULT now(),
      accepted_at timestamptz,
      accepted_by text
   )`,
  `ALTER TABLE shift_handovers ADD COLUMN IF NOT EXISTS to_user_id integer REFERENCES users(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS shift_handovers_to_user_idx ON shift_handovers (to_user_id)`,
  `CREATE INDEX IF NOT EXISTS shift_handovers_order_idx ON shift_handovers (order_id)`,
  `CREATE INDEX IF NOT EXISTS shift_handovers_status_idx ON shift_handovers (status)`,
  `CREATE TABLE IF NOT EXISTS business_branding (
      id integer PRIMARY KEY DEFAULT 1,
      mime text NOT NULL DEFAULT 'image/png',
      size_bytes integer NOT NULL DEFAULT 0,
      data bytea NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT business_branding_single_row CHECK (id = 1)
   )`,
  `ALTER TABLE order_photos ADD COLUMN IF NOT EXISTS uploaded_by text`,
  `CREATE TABLE IF NOT EXISTS user_sessions (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip text,
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      revoked_at timestamptz
   )`,
  `CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions (user_id)`,
  `CREATE INDEX IF NOT EXISTS user_sessions_revoked_idx ON user_sessions (revoked_at)`,
];

type SeedCustomer = [string, string | null, string | null, string, string];

const SEED_CUSTOMERS: SeedCustomer[] = [
  ["Toko Berkah Jaya", "081234567890", "berkahjaya@mail.com", "Jl. Pasar Baru 12", "Pelanggan langganan spanduk, harga khusus"],
  ["Kantor Desa Sukamaju", "081298765432", null, "Kantor Desa Sukamaju", "Selalu minta invoice"],
  ["Kopi Senja", "085612345678", "kopisenja@mail.com", "Jl. Merdeka 45", "Order menu & stiker gelas"],
  ["SMP Negeri 3", "081377788899", null, "Jl. Pendidikan 8", "Musiman: awal tahun ajaran"],
  ["Bu Rina (Event Organizer)", "087812345678", "rina.eo@mail.com", "Jl. Cempaka 3", "Urgent biasanya, bayar DP 50%"],
];

type SeedOrder = {
  customer: string;
  title: string;
  productType: string;
  quantity: number;
  unit: string;
  machine: string;
  operator: string | null;
  status: string;
  priority: string;
  price: number;
  paidAmount: number;
  dayOffset: number;
  dueTime: string;
  estHours: number;
  notes: string | null;
};

const SEED_ORDERS: SeedOrder[] = [
  { customer: "Bu Rina (Event Organizer)", title: "Backdrop seminar 3x2 meter", productType: "Spanduk / Banner", quantity: 2, unit: "pcs", machine: "Large Format / Outdoor", operator: "Yoga", status: "cetak", priority: "urgent", price: 900000, paidAmount: 450000, dayOffset: 0, dueTime: "15:00", estHours: 6, notes: "Desain sudah OK. Butuh mata ayam & tali." },
  { customer: "Kopi Senja", title: "Stiker gelas 300 pcs", productType: "Stiker / Label", quantity: 300, unit: "pcs", machine: "Digital Print 1", operator: "Dimas", status: "finishing", priority: "normal", price: 450000, paidAmount: 450000, dayOffset: 1, dueTime: "17:00", estHours: 5, notes: "Bahan vinyl glossy, potong kiss-cut." },
  { customer: "Toko Berkah Jaya", title: "Kartu nama 5 box", productType: "Kartu Nama", quantity: 500, unit: "pcs", machine: "Digital Print 2", operator: "Bu Rina", status: "siap", priority: "normal", price: 175000, paidAmount: 175000, dayOffset: -1, dueTime: "16:00", estHours: 3, notes: "Sudah dilaminasi doff." },
  { customer: "Kantor Desa Sukamaju", title: "Buku profil desa 10 eksemplar", productType: "Buku / Yasinan", quantity: 10, unit: "set", machine: "Mesin Offset", operator: "Pak Andi", status: "antrian", priority: "tinggi", price: 3200000, paidAmount: 1000000, dayOffset: 4, dueTime: "14:00", estHours: 22, notes: "Menunggu file revisi bab 2 dari sekretaris." },
  { customer: "SMP Negeri 3", title: "Sertifikat lomba 120 lembar", productType: "Nota / Kop Surat", quantity: 120, unit: "lembar", machine: "Digital Print 1", operator: "Dimas", status: "desain", priority: "normal", price: 600000, paidAmount: 0, dayOffset: 2, dueTime: "10:00", estHours: 6, notes: "Menunggu daftar nama pemenang." },
  { customer: "Toko Berkah Jaya", title: "Nota NPL 40 blok", productType: "Nota / Kop Surat", quantity: 40, unit: "box", machine: "Mesin Offset", operator: "Pak Andi", status: "selesai", priority: "normal", price: 880000, paidAmount: 880000, dayOffset: -3, dueTime: "17:00", estHours: 9, notes: "Sudah diambil sendiri oleh pemilik toko." },
  { customer: "Bu Rina (Event Organizer)", title: "Undangan pernikahan klien 250 pcs", productType: "Undangan", quantity: 250, unit: "pcs", machine: "Finishing & Binding", operator: "Tim Finishing", status: "ditunda", priority: "tinggi", price: 3750000, paidAmount: 1500000, dayOffset: -1, dueTime: "12:00", estHours: 26, notes: "Menunggu pelunasan DP kedua sebelum produksi." },
  { customer: "Kopi Senja", title: "Banner promo grand opening", productType: "Spanduk / Banner", quantity: 3, unit: "meter", machine: "Large Format / Outdoor", operator: "Yoga", status: "qc", priority: "normal", price: 300000, paidAmount: 300000, dayOffset: 1, dueTime: "17:00", estHours: 4, notes: "Cek hasil warna sebelum diserahkan." },
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = process.env.SETUP_TOKEN;
  if (token) {
    const provided = url.searchParams.get("token");
    if (provided !== token) {
      return Response.json({ ok: false, error: "Token setup salah. Tambahkan ?token=..." }, { status: 401 });
    }
  }

  try {
    for (const statement of DDL) {
      await db.execute(sql.raw(statement));
    }

    let seeded = false;
    if (url.searchParams.get("seed") === "1") {
      const existing = await db.execute<{ count: string }>(sql`select count(*)::text as count from orders`);
      const rows = existing.rows as { count: string }[];
      if (Number.parseInt(rows[0]?.count ?? "0", 10) === 0) {
        const customerIds = new Map<string, number>();
        for (const [name, phone, email, address, notes] of SEED_CUSTOMERS) {
          const result = await db.execute<{ id: number }>(sql`
            insert into customers (name, phone, email, address, notes)
            values (${name}, ${phone}, ${email}, ${address}, ${notes})
            returning id
          `);
          const inserted = (result.rows as { id: number }[])[0];
          if (inserted) customerIds.set(name, inserted.id);
        }

        const year = new Date().getFullYear();
        let index = 1;
        for (const order of SEED_ORDERS) {
          const code = `PJ-${year}-${String(index).padStart(4, "0")}`;
          const result = await db.execute<{ id: number }>(sql`
            insert into orders (
              code, customer_id, customer_name, title, product_type, quantity, unit, machine,
              operator, status, priority, price, paid_amount, due_date, due_time, est_hours, notes
            ) values (
              ${code},
              ${customerIds.get(order.customer) ?? null},
              ${order.customer},
              ${order.title},
              ${order.productType},
              ${order.quantity},
              ${order.unit},
              ${order.machine},
              ${order.operator},
              ${order.status},
              ${order.priority},
              ${order.price},
              ${order.paidAmount},
              (current_date + ${order.dayOffset} * interval '1 day')::date,
              ${order.dueTime},
              ${order.estHours},
              ${order.notes}
            )
            returning id
          `);
          const inserted = (result.rows as { id: number }[])[0];
          if (inserted) {
            await db.execute(sql`
              insert into order_events (order_id, from_status, to_status, note, actor)
              values (${inserted.id}, null, 'antrian', 'Pekerjaan dibuat & masuk antrian.', 'Owner')
            `);
            if (order.status !== "antrian") {
              await db.execute(sql`
                insert into order_events (order_id, from_status, to_status, note, actor)
                values (${inserted.id}, 'antrian', ${order.status}, 'Data contoh untuk belajar.', 'Owner')
              `);
            }
          }
          index += 1;
        }
        seeded = true;
      }
    }

    return Response.json({
      ok: true,
      message: "Database siap dipakai. Semua tabel sudah dibuat.",
      tables: [
        "customers",
        "orders",
        "order_events",
        "ai_notes",
        "settings",
        "order_photos",
        "production_partners",
        "outsource_jobs",
        "users",
        "login_audit",
        "push_subscriptions",
        "shift_handovers",
        "business_branding",
        "user_sessions",
      ],
      seeded,
      hint: seeded ? "Contoh data sudah diisi. Buka halaman utama aplikasi." : "Untuk mengisi contoh data, buka /api/setup?seed=1",
    });
  } catch (error) {
    console.error("GET /api/setup", error);
    return Response.json(
      { ok: false, error: "Gagal menyiapkan database.", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
