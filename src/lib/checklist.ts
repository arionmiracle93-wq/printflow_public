import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { checkDatabase, safeDb } from "@/lib/dbcheck";
import { getSettingsMap } from "@/lib/queries";
import { SEED_CUSTOMER_NAMES, SEED_ORDER_TITLES } from "@/lib/seed";

export type ChecklistItem = {
  key: string;
  step: number;
  title: string;
  why: string;
  how: string[];
  done: boolean;
  doneLabel?: string;
  optional?: boolean;
  manual?: boolean;
  settingKey?: string;
  href?: string;
  cta?: string;
};

export type ChecklistState = {
  ready: boolean;
  problem: Awaited<ReturnType<typeof checkDatabase>> | null;
  items: ChecklistItem[];
  progress: { done: number; total: number; percent: number };
  facts: {
    totalOrders: number;
    demoOrders: number;
    realOrders: number;
    customers: number;
    demoCustomers: number;
    lateCount: number;
    activeCount: number;
    aiConfigured: boolean;
  };
};

export async function buildChecklist(): Promise<ChecklistState> {
  const check = await checkDatabase();

  if (!check.ok) {
    return {
      ready: false,
      problem: check,
      items: [],
      progress: { done: 0, total: 1, percent: 0 },
      facts: {
        totalOrders: 0,
        demoOrders: 0,
        realOrders: 0,
        customers: 0,
        demoCustomers: 0,
        lateCount: 0,
        activeCount: 0,
        aiConfigured: false,
      },
    };
  }

  const counts = await safeDb(async () => {
    // Data contoh = pekerjaan/pelanggan yang dibuat oleh /api/setup?seed=1
    const demoOrderRows = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.title, SEED_ORDER_TITLES));
    const demoCustomerRows = await db
      .select({ id: customers.id })
      .from(customers)
      .where(inArray(customers.name, SEED_CUSTOMER_NAMES));

    const [orderAgg] = await db
      .select({
        total: sql<number>`cast(count(*) as int)`,
        active: sql<number>`cast(count(*) filter (where status not in ('selesai','batal')) as int)`,
        late: sql<number>`cast(count(*) filter (where status <> 'selesai' and status <> 'batal' and (due_date + due_time::interval) < now()) as int)`,
      })
      .from(orders);
    const [customerAgg] = await db.select({ total: sql<number>`cast(count(*) as int)` }).from(customers);

    return {
      demoOrders: demoOrderRows.length,
      totalOrders: Number(orderAgg?.total ?? 0),
      lateCount: Number(orderAgg?.late ?? 0),
      activeCount: Number(orderAgg?.active ?? 0),
      customers: Number(customerAgg?.total ?? 0),
      demoCustomers: demoCustomerRows.length,
    };
  });
  if (!counts.ok) {
    // Jangan pernah gagal diam-diam: catat agar mudah dilihat di log Vercel.
    console.error("buildChecklist: gagal menghitung statistik", counts.problem);
  }

  const f = counts.ok
    ? counts.data
    : { demoOrders: 0, totalOrders: 0, lateCount: 0, activeCount: 0, customers: 0, demoCustomers: 0 };

  const prefs = await getSettingsMap();
  const isOn = (key: string) => prefs[key] === "1";
  const realOrders = Math.max(0, f.totalOrders - f.demoOrders);
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);

  const items: ChecklistItem[] = [
    {
      key: "data_bersih",
      step: 1,
      title: f.demoOrders > 0 ? "Hapus data contoh (latihan)" : "Data contoh sudah dibersihkan",
      why:
        f.demoOrders > 0
          ? `Masih ada ${f.demoOrders} pekerjaan contoh (${f.demoCustomers} pelanggan contoh). Data ini bukan pekerjaan Anda, jadi bisa membuat laporan & risiko AI jadi keliru.`
          : "Tidak ada data latihan tersisa. Dashboard Anda sekarang murni berisi pekerjaan percetakan nyata.",
      how:
        f.demoOrders > 0
          ? ["Buka menu Pengaturan.", "Klik tombol 🧹 Hapus Data Contoh.", "Selesai — tidak perlu hapus satu per satu."]
          : ["Tidak ada langkah. Lanjut ke langkah berikutnya. ✅"],
      done: f.demoOrders === 0,
      doneLabel: f.demoOrders === 0 ? "bersih" : `${f.demoOrders} data contoh`,
      href: "/pengaturan",
      cta: f.demoOrders > 0 ? "Buka Pengaturan" : undefined,
    },
    {
      key: "order_pertama",
      step: 2,
      title: realOrders > 0 ? `Masukkan pekerjaan nyata (${realOrders} sudah ada)` : "Masukkan pekerjaan nyata pertama Anda",
      why:
        realOrders > 0
          ? "Bagus! Setiap order baru masuk akan langsung dipantau AI. Biasakan: order masuk = langsung dicatat."
          : "Belum ada pekerjaan sungguhan. Coba masukkan 1 order yang sedang Anda kerjakan hari ini supaya dashboard mulai hidup.",
      how:
        realOrders > 0
          ? [
              "Teruskan kebiasaan ini: pelanggan datang/WA masuk → klik ➕ Pekerjaan Baru → isi 1 menit.",
              "Isi DP di kolom “sudah dibayar” supaya sisa tagihan otomatis terlihat.",
            ]
          : [
              "Klik tombol ➕ Pekerjaan Baru.",
              "Isi: pelanggan, jenis cetak, jumlah, deadline, harga, DP.",
              "Simpan → AI langsung memberi skor risiko & saran.",
            ],
      done: realOrders > 0,
      doneLabel: realOrders > 0 ? `${realOrders} pekerjaan` : "belum ada",
      href: "/pesanan/baru",
      cta: "➕ Pekerjaan Baru",
    },
    {
      key: "pelanggan",
      step: 3,
      title: f.customers > 0 ? `Lengkapi data pelanggan (${f.customers} terdaftar)` : "Daftarkan pelanggan tetap Anda",
      why:
        f.customers > 0
          ? "Data pelanggan membuat halaman Pelanggan bisa menampilkan siapa juru uang Anda dan berapa nilai ordernya."
          : "Dengan buku pelanggan, Anda tahu siapa yang paling sering order dan berapa total transaksinya.",
      how: [
        "Buka menu Pelanggan → ➕ Tambah Pelanggan.",
        "Isi nama/toko + nomor WhatsApp (berguna nanti untuk notifikasi otomatis).",
        "Pelanggan lama cukup dimasukkan sekali, nanti tinggal dipilih saat membuat order.",
      ],
      done: f.customers > 0,
      doneLabel: `${f.customers} pelanggan`,
      href: "/pelanggan",
      cta: "Kelola Pelanggan",
    },
    {
      key: "pasang_hp",
      step: 4,
      title: isOn("checklist.pasang_hp") ? "Pasang aplikasi di HP (selesai)" : "Pasang aplikasi di HP Android/iPhone",
      why:
        "Kegunaan terbesar aplikasi ini adalah saat Anda di luar ruang kerja: bisa cek status semua pekerjaan dari kantong.",
      how: [
        "Buka alamat aplikasi Anda pakai Chrome di HP Android (atau Safari di iPhone).",
        "Android: menu ⋮ → “Tambahkan ke layar utama / Install app”.",
        "iPhone: tombol Bagikan → “Add to Home Screen”.",
        "Setelah ikonnya muncul, centang tombol di bawah.",
      ],
      done: isOn("checklist.pasang_hp"),
      manual: true,
      settingKey: "checklist.pasang_hp",
      doneLabel: isOn("checklist.pasang_hp") ? "sudah dipasang" : "belum",
    },
    {
      key: "update_status",
      step: 5,
      title: f.activeCount > 0 ? "Biasakan klik status setiap pindah tahap" : "Coba ubah status satu pekerjaan",
      why:
        "Nilai AI muncul dari data status. Kalau status selalu diperbarui, peringatan “berisiko telat” jadi akurat dan bisa menyelamatkan order sebelum pelanggan komplain.",
      how: [
        "Buka satu pekerjaan → klik tombol ▶️ “Lanjut ke: …”.",
        "Tulis catatan bila ada hal penting (mis. “tinta habis, pindah mesin”).",
        `Sekarang ada ${f.activeCount} pekerjaan aktif${f.lateCount > 0 ? ` dan ${f.lateCount} sudah lewat deadline — cek dulu yang ini.` : "."}`,
      ],
      done: f.lateCount === 0 && f.activeCount > 0,
      doneLabel: f.lateCount > 0 ? `${f.lateCount} telat` : f.activeCount > 0 ? "terkendali" : "belum ada order",
      href: "/pesanan",
      cta: "Buka Pekerjaan",
    },
    {
      key: "cadangan",
      step: 6,
      title: isOn("checklist.cadangan") ? "Unduh cadangan data (selesai)" : "Unduh cadangan data pertama (Excel/CSV)",
      why:
        "Data Anda tersimpan aman di Neon, tapi menyimpan salinan sendiri memberi ketenangan. Bisa dibuka di Excel untuk laporan bulanan.",
      how: [
        "Buka menu Pengaturan.",
        "Klik “⬇️ Pekerjaan (CSV)” dan “⬇️ Pelanggan (CSV)”.",
        "Simpan file di komputer/Google Drive, lalu centang tombol di bawah.",
        "Ulangi sebulan sekali — cukup 1 menit.",
      ],
      done: isOn("checklist.cadangan"),
      manual: true,
      settingKey: "checklist.cadangan",
      doneLabel: isOn("checklist.cadangan") ? "tersimpan" : "belum",
      href: "/pengaturan",
      cta: "Ke Pengaturan",
    },
    {
      key: "karyawan",
      step: 7,
      optional: true,
      title: isOn("checklist.karyawan") ? "Ajak karyawan memakai aplikasi (selesai)" : "Ajak karyawan ikut memakai (opsional)",
      why:
        "Aplikasi paling berguna kalau operator yang mengubah statusnya sendiri, bukan Anda yang menanyakan terus.",
      how: [
        "Bagikan alamat aplikasi ke operator via WhatsApp.",
        "Minta mereka install di HP masing-masing (langkah 4).",
        "Sepakati aturan sederhana: selesai tahap = klik status. Tidak ada yang perlu dihafal.",
        "Catatan: saat ini semua pengguna punya akses penuh. Login & hak akses ada di roadmap (lihat /panduan bab 18).",
      ],
      done: isOn("checklist.karyawan"),
      manual: true,
      settingKey: "checklist.karyawan",
      doneLabel: isOn("checklist.karyawan") ? "sudah" : "belum",
    },
    {
      key: "ai_bahasa",
      step: 8,
      optional: true,
      title: aiConfigured ? "AI bahasa (GPT/Claude) aktif" : "Aktifkan AI bahasa GPT/Claude (opsional)",
      why: aiConfigured
        ? "Tanya AI sekarang menjawab dengan bahasa yang lebih luwes dari model bahasa, tetap berbasis data produksi Anda."
        : "Tanpa ini pun aplikasi tetap pintar (memakai mesin analisa internal gratis). Ini hanya membuat kalimat AI lebih bebas.",
      how: aiConfigured
        ? ["Sudah aktif. Coba di dashboard: “kerjaan siapa yang paling mepet?”"]
        : [
            "Buat API key di platform.openai.com (atau console.anthropic.com).",
            "Vercel → Settings → Environment Variables → tambah OPENAI_API_KEY (atau ANTHROPIC_API_KEY).",
            "Deployments → ⋯ → Redeploy.",
            "Biaya khas untuk 1 toko: ± Rp 15.000–50.000/bulan. Tidak wajib.",
          ],
      done: aiConfigured,
      doneLabel: aiConfigured ? "aktif" : "tidak aktif (tidak masalah)",
    },
  ];

  const wajib = items.filter((i) => !i.optional);
  const doneCount = wajib.filter((i) => i.done).length;

  return {
    ready: true,
    problem: null,
    items,
    progress: { done: doneCount, total: wajib.length, percent: Math.round((doneCount / wajib.length) * 100) },
    facts: {
      totalOrders: f.totalOrders,
      demoOrders: f.demoOrders,
      realOrders,
      customers: f.customers,
      demoCustomers: f.demoCustomers,
      lateCount: f.lateCount,
      activeCount: f.activeCount,
      aiConfigured,
    },
  };
}
