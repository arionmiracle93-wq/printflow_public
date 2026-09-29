import { sql } from "drizzle-orm";
import { db, databaseHost, databaseUrl, isLocalDatabase } from "@/db";

export const REQUIRED_TABLES = [
  "customers",
  "orders",
  "order_items",
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
] as const;

/**
 * Kolom yang ditambahkan oleh pembaruan aplikasi (lewat /api/setup).
 * Kalau salah satunya belum ada, berarti kode sudah versi baru tetapi
 * /api/setup belum dibuka setelah deploy. Tambahkan di sini setiap kali
 * ada kolom baru, supaya /api/health dan layar error langsung memberi tahu.
 */
export const REQUIRED_COLUMNS: { table: string; column: string }[] = [
  { table: "order_items", column: "status" },
  { table: "order_items", column: "outsource_job_id" },
  { table: "order_photos", column: "blob_url" },
];

/**
 * Gabungkan pesan error beserta penyebab di dalamnya. Drizzle membungkus
 * error asli PostgreSQL (misalnya: column "blob_url" does not exist) di
 * dalam error "Failed query: ...". Kalau hanya pesan luarnya yang dibaca,
 * error kolom yang belum ada salah dikira masalah koneksi.
 */
function errorText(error: unknown): { text: string; pgCode: string | null } {
  const parts: string[] = [];
  let pgCode: string | null = null;
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current instanceof Error) parts.push(current.message);
    else parts.push(String(current));
    const code = (current as { code?: unknown }).code;
    if (!pgCode && typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) pgCode = code;
    current = (current as { cause?: unknown }).cause;
  }
  return { text: parts.join(" | "), pgCode };
}

export type DbCheck = {
  ok: boolean;
  code:
    | "siap"
    | "env_kosong"
    | "env_tidak_valid"
    | "gagal_koneksi"
    | "autentikasi_gagal"
    | "tabel_belum_ada"
    | "timeout"
    | "ssl";
  title: string;
  message: string;
  steps: string[];
  env: { ada: boolean; host: string | null; pakaiPooler: boolean | null; local: boolean; pakaiSsl: boolean };
  tables: { name: string; ada: boolean }[];
  counts?: { orders: number; customers: number };
};

/** Terjemahkan error teknis PostgreSQL menjadi bahasa awam + langkah perbaikan. */
export function explainDbError(error: unknown): DbCheck {
  const { text: fullText, pgCode } = errorText(error);
  const raw = error instanceof Error ? error.message : String(error);
  const lowered = fullText.toLowerCase();
  const env = {
    ada: Boolean(databaseUrl()),
    host: databaseHost(),
    pakaiPooler: databaseHost()?.includes("pooler") ?? null,
    local: isLocalDatabase(databaseHost()),
    pakaiSsl: Boolean(databaseUrl()?.includes("sslmode=")),
  };
  const base = { env };

  if (!env.ada) {
    return {
      ...base,
      ok: false,
      code: "env_kosong",
      title: "DATABASE_URL belum diisi di Vercel",
      message:
        "Aplikasi sudah berhasil di-deploy, tetapi tidak tahu ke mana harus menyimpan data. Ini penyebab paling umum halaman tampil kosong/hitam.",
      steps: [
        "Buka dashboard Vercel → pilih project Anda.",
        "Menu Settings → Environment Variables.",
        "Klik Add New → isikan Name: DATABASE_URL",
        "Value: tempel connection string Pooled dari Neon (yang berisi tulisan -pooler dan diakhiri ?sslmode=require)",
        "Centang semua Environment (Production, Preview, Development) → Save.",
        "Menu Deployments → klik ⋯ pada paling atas → Redeploy → tunggu selesai.",
      ],
      tables: [],
    };
  }

  if (lowered.includes("invalid") && (lowered.includes("connection string") || lowered.includes("parse"))) {
    return {
      ...base,
      ok: false,
      code: "env_tidak_valid",
      title: "Format DATABASE_URL salah",
      message: "Connection string tidak bisa dibaca. Biasanya karena ada spasi, enter, atau tanda kutip ikut ter-tempel.",
      steps: [
        "Buka Neon → project Anda → tombol Connect.",
        "Copy connection string yang bertanda Pooled (mengandung -pooler).",
        "Tempel di Notepad dulu, pastikan 1 baris penuh tanpa spasi di awal/akhir.",
        "Paste ulang ke Vercel → Environment Variables → DATABASE_URL → Save → Redeploy.",
      ],
      tables: [],
    };
  }

  if (
    lowered.includes("password authentication failed") ||
    lowered.includes("role") && lowered.includes("does not exist") ||
    lowered.includes("authentication failed")
  ) {
    return {
      ...base,
      ok: false,
      code: "autentikasi_gagal",
      title: "Username atau password database salah",
      message: "Server Neon berhasil dihubungi, tetapi kredensialnya tidak cocok.",
      steps: [
        "Pastikan tidak ada spasi di awal/akhir saat menempel connection string.",
        "Buka Neon → Dashboard → Roles → Reset password (jika ragu).",
        "Copy ulang connection string Pooled yang baru.",
        "Perbarui nilai DATABASE_URL di Vercel → Save → Redeploy.",
      ],
      tables: [],
    };
  }

  // Kolom belum ada (kode PostgreSQL 42703): aplikasi sudah versi baru,
  // tetapi /api/setup belum dibuka setelah deploy.
  if (pgCode === "42703" || (lowered.includes("column") && lowered.includes("does not exist"))) {
    const column = fullText.match(/column "?([\w.]+)"? does not exist/i)?.[1];
    return {
      ...base,
      ok: false,
      code: "tabel_belum_ada",
      title: "Database perlu diperbarui",
      message: `Koneksi database BERHASIL. Aplikasi sudah versi baru, tetapi database belum diperbarui${
        column ? ` (kolom "${column}" belum ada)` : ""
      }. Ini terjadi kalau /api/setup belum dibuka setelah deploy. Data Anda aman dan tidak ada yang hilang.`,
      steps: [
        "Tekan tombol \"Perbarui database sekarang\" di bawah (membuka /api/setup).",
        "Tunggu sampai muncul tulisan \"ok\": true.",
        "Kembali ke halaman ini, lalu tekan \"Saya sudah perbaiki, cek lagi\".",
      ],
      tables: [],
    };
  }

  if (lowered.includes("does not exist") && (lowered.includes("relation") || lowered.includes("table"))) {
    return {
      ...base,
      ok: false,
      code: "tabel_belum_ada",
      title: "Tabel database belum dibuat",
      message:
        "Koneksi database BERHASIL. Hanya saja tabel-tabelnya belum ada. Ini penyebab nomor dua yang paling sering terjadi setelah deploy.",
      steps: [
        "Buka alamat ini di browser: https://app-anda.vercel.app/api/setup",
        "Tunggu sampai muncul tulisan { \"ok\": true, ... }",
        "Kembali ke halaman utama aplikasi, lalu tekan Refresh.",
      ],
      tables: [],
    };
  }

  if (lowered.includes("enotfound") || lowered.includes("getaddrinfo") || lowered.includes("dns")) {
    return {
      ...base,
      ok: false,
      code: "gagal_koneksi",
      title: "Alamat server database tidak ditemukan",
      message: "Nama host di DATABASE_URL keliru atau project Neon sudah dihapus.",
      steps: [
        "Cek apakah project Neon masih ada (bisa saja terhapus/tersuspend).",
        "Copy ulang connection string dari tombol Connect di Neon.",
        "Perbarui DATABASE_URL di Vercel → Save → Redeploy.",
      ],
      tables: [],
    };
  }

  if (lowered.includes("ssl") || lowered.includes("tls") || lowered.includes("certificate")) {
    return {
      ...base,
      ok: false,
      code: "ssl",
      title: "Koneksi terenkripsi (SSL) gagal",
      message: "Neon mewajibkan koneksi SSL. Biasanya connection string yang dipakai bukan milik Neon atau terpotong.",
      steps: [
        "Pastikan connection string diakhiri ?sslmode=require",
        "Gunakan host yang mengandung -pooler (koneksi pooled, cocok untuk Vercel).",
        "Simpan lalu Redeploy.",
      ],
      tables: [],
    };
  }

  if (lowered.includes("timeout") || lowered.includes("etimedout") || lowered.includes("econnrefused")) {
    return {
      ...base,
      ok: false,
      code: "timeout",
      title: "Koneksi ke database habis waktu",
      message: "Server database tidak menjawab dalam waktu wajar. Sering karena region Neon terlalu jauh atau koneksi Direct (bukan Pooled) dipakai di Vercel.",
      steps: [
        "Pastikan memakai connection string bertanda -pooler (Pooled), bukan Direct.",
        "Idealnya project Neon dibuat di region Singapore agar dekat dengan Vercel.",
        "Perbarui DATABASE_URL → Save → Redeploy.",
      ],
      tables: [],
    };
  }

  return {
    ...base,
    ok: false,
    code: "gagal_koneksi",
    title: "Gagal menghubungi database",
    message: raw,
    steps: [
      "Buka /api/health di browser untuk melihat status singkat.",
      "Periksa kembali DATABASE_URL di Vercel (harus connection string Pooled dari Neon).",
      "Setelah mengubah Environment Variables, WAJIB klik Redeploy.",
    ],
    tables: [],
  };
}

/** Cek koneksi + kelengkapan tabel. Aman dipanggil dari halaman mana pun. */
export async function checkDatabase(): Promise<DbCheck> {
  const env = {
    ada: Boolean(databaseUrl()),
    host: databaseHost(),
    pakaiPooler: databaseHost()?.includes("pooler") ?? null,
    local: isLocalDatabase(databaseHost()),
    pakaiSsl: Boolean(databaseUrl()?.includes("sslmode=")),
  };

  if (!env.ada) return explainDbError(new Error("DATABASE_URL kosong"));

  try {
    const result = await db.execute<{ table_name: string }>(sql`
      select table_name from information_schema.tables
      where table_schema = 'public'
    `);
    const existing = new Set((result.rows as { table_name: string }[]).map((r) => r.table_name));
    const tables = REQUIRED_TABLES.map((name) => ({ name, ada: existing.has(name) }));
    const missing = tables.some((t) => !t.ada);

    // Tabel lengkap, tetapi kolom dari pembaruan terbaru belum ada?
    if (!missing) {
      const cols = await db.execute<{ table_name: string; column_name: string }>(sql`
        select table_name, column_name from information_schema.columns
        where table_schema = 'public'
      `);
      const have = new Set((cols.rows as { table_name: string; column_name: string }[]).map((r) => `${r.table_name}.${r.column_name}`));
      const absent = REQUIRED_COLUMNS.filter((c) => !have.has(`${c.table}.${c.column}`));
      if (absent.length) {
        return {
          ok: false,
          code: "tabel_belum_ada",
          title: "Database perlu diperbarui",
          message: `Koneksi BERHASIL, tetapi ${absent.length} kolom dari pembaruan terbaru belum ada (${absent
            .map((c) => `${c.table}.${c.column}`)
            .join(", ")}). Buka /api/setup sekali. Data tidak berubah.`,
          steps: [
            "Buka /api/setup di browser.",
            "Tunggu sampai muncul { \"ok\": true, ... }.",
            "Kembali ke aplikasi lalu Refresh.",
          ],
          env,
          tables,
        };
      }
    }

    let counts: { orders: number; customers: number } | undefined;
    if (!missing) {
      const c = await db.execute<{ orders: string; customers: string }>(sql`
        select (select count(*) from orders)::text as orders,
               (select count(*) from customers)::text as customers
      `);
      const row = (c.rows as { orders: string; customers: string }[])[0];
      counts = {
        orders: Number.parseInt(row?.orders ?? "0", 10),
        customers: Number.parseInt(row?.customers ?? "0", 10),
      };
    }

    return {
      ok: !missing,
      code: missing ? "tabel_belum_ada" : "siap",
      title: missing ? "Tabel database belum dibuat" : "Database siap dipakai ✅",
      message: missing
        ? "Koneksi database BERHASIL, tetapi tabelnya belum ada. Cukup buka /api/setup sekali."
        : "Semua tabel sudah ada dan aplikasi siap dipakai.",
      steps: missing
        ? [
            "Buka https://app-anda.vercel.app/api/setup di browser.",
            "Tunggu sampai muncul { \"ok\": true, ... }.",
            "Kembali ke aplikasi lalu Refresh.",
          ]
        : ["Tidak ada yang perlu diperbaiki. Selamat bekerja! 🎉"],
      env,
      tables,
      counts,
    };
  } catch (error) {
    return explainDbError(error);
  }
}

export type Result<T> = { ok: true; data: T } | { ok: false; problem: DbCheck };

/** Response JSON untuk API route ketika database bermasalah (tidak pernah 500 gelap). */
export function problemResponse(error: unknown) {
  const problem = explainDbError(error);
  return Response.json(
    {
      ok: false,
      kode: problem.code,
      judul: problem.title,
      penjelasan: problem.message,
      langkahPerbaikan: problem.steps,
      perbaikiSekali: "/api/setup",
      statusPage: "/status",
    },
    { status: 503 },
  );
}

/** Jalankan query dengan aman; bila gagal, kembalikan penjelasan bahasa awam. */
export async function safeDb<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, problem: explainDbError(error) };
  }
}
