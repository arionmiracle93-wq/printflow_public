import { createOrder, listOrders } from "@/lib/queries";
import { problemResponse } from "@/lib/dbcheck";
import { getCurrentUser } from "@/lib/auth";
import { notifyInBackground } from "@/lib/push";
import { sanitizeItems, summarizeItems } from "@/lib/order-items";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = (url.searchParams.get("scope") ?? "semua") as "aktif" | "semua" | "selesai";
  const status = url.searchParams.get("status") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const machine = url.searchParams.get("machine") ?? undefined;
  try {
    const rows = await listOrders({ scope, status, q, machine });
    return Response.json({ ok: true, count: rows.length, data: rows });
  } catch (error) {
    console.error("GET /api/orders", error);
    return problemResponse(error);
  }
}

type Body = Record<string, unknown>;

function str(body: Body, key: string, fallback = ""): string {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function num(body: Body, key: string, fallback = 0): number {
  const value = body[key];
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(request: Request) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return Response.json({ ok: false, error: "Sesi login diperlukan." }, { status: 401 });
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "Data yang dikirim tidak terbaca." }, { status: 400 });
  }

  const customerName = str(body, "customerName");
  const title = str(body, "title");
  const dueDate = str(body, "dueDate");
  if (!customerName || !title || !dueDate) {
    return Response.json(
      { ok: false, error: "Nama pelanggan, nama pekerjaan, dan tanggal deadline wajib diisi." },
      { status: 400 },
    );
  }

  // Satu pekerjaan boleh berisi banyak produk. Minimal harus ada satu baris,
  // supaya pesan WhatsApp & halaman lacak punya isi untuk ditampilkan
  // (sejak "jenis produk" dihapus dari pekerjaan, daftar ini satu-satunya
  // sumber data produk).
  const items = sanitizeItems(body.items);
  if (!items.length) {
    return Response.json(
      { ok: false, error: "Minimal isi satu baris produk (jenis + jumlah + satuan) di tabel Item Pekerjaan." },
      { status: 400 },
    );
  }

  try {
    const created = await createOrder({
      customerName,
      customerId: body.customerId ? num(body, "customerId") : null,
      title,
      items,
      machine: str(body, "machine", "Digital Print 1"),
      operator: str(body, "operator") || null,
      priority: str(body, "priority", "normal"),
      price: Math.max(0, num(body, "price", 0)),
      paidAmount: Math.max(0, num(body, "paidAmount", 0)),
      dueDate,
      dueTime: str(body, "dueTime", "17:00"),
      notes: str(body, "notes") || null,
      pic: sessionUser.name,
    });
    notifyInBackground({
      title: "Pekerjaan baru masuk",
      body: `${created.code} — ${created.title} (${summarizeItems(items)}) untuk ${created.customerName}.`,
      url: `/pesanan/${created.id}`,
      tag: `order-${created.id}`,
    });
    return Response.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders", error);
    return problemResponse(error);
  }
}
