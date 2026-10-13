/**
 * ANTREAN PEMBAYARAN OFFLINE (khusus browser)
 *
 * Catat Pembayaran / Tandai Lunas tetap bisa dipakai saat internet putus: aksi disimpan di perangkat
 * lalu dikirim otomatis begitu online. Aman dari pencatatan dobel karena TIAP aksi membawa kode unik
 * (clientRef) yang dikenali server: kiriman yang sama dua kali hanya tercatat sekali.
 * Waktu pembayaran adalah waktu saat kasir menekan tombol, bukan waktu terkirim.
 *
 * Yang TIDAK offline (butuh internet): upload foto, notifikasi, login ulang, kirim WhatsApp.
 */
export type QueuedPayment = {
  ref: string;
  invoiceId: number;
  /** Nomor invoice / pelanggan untuk ditampilkan di daftar antrean. */
  label: string;
  amount: number;
  method: string;
  kind: "dp" | "bayar";
  note: string;
  /** Waktu pembayaran sebenarnya (ISO). */
  paidAt: string;
  createdAt: string;
  confirmOverpay: boolean;
  /** pending = menunggu dikirim; failed = ditolak server dan perlu ditinjau. */
  status: "pending" | "failed";
  error?: string;
  code?: string;
  attempts: number;
};

export const QUEUE_KEY = "pf_payment_queue_v1";
export const QUEUE_EVENT = "pf-payment-queue";

export function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function readRaw(): string {
  try {
    return localStorage.getItem(QUEUE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function parseQueue(raw: string): QueuedPayment[] {
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr as QueuedPayment[]).filter((x) => x && typeof x.ref === "string" && Number.isInteger(x.invoiceId)) : [];
  } catch {
    return [];
  }
}

export function readQueue(): QueuedPayment[] {
  return parseQueue(readRaw());
}

function write(list: QueuedPayment[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(QUEUE_EVENT));
  } catch {
    /* penyimpanan penuh/dimatikan */
  }
}

export function subscribeQueue(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(QUEUE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(QUEUE_EVENT, cb);
  };
}

export function enqueue(item: QueuedPayment) {
  const list = readQueue().filter((x) => x.ref !== item.ref);
  write([...list, item]);
}
export function removeFromQueue(ref: string) {
  write(readQueue().filter((x) => x.ref !== ref));
}
export function patchQueueItem(ref: string, patch: Partial<QueuedPayment>) {
  write(readQueue().map((x) => (x.ref === ref ? { ...x, ...patch } : x)));
}

type PostResult = { status: number; json: { ok?: boolean; error?: string; code?: string; duplicate?: boolean } };

async function postPayment(item: Pick<QueuedPayment, "invoiceId" | "ref" | "amount" | "method" | "kind" | "note" | "paidAt" | "confirmOverpay">): Promise<PostResult> {
  const res = await fetch(`/api/invoices/${item.invoiceId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: item.amount,
      method: item.method,
      kind: item.kind,
      note: item.note,
      paidAt: item.paidAt,
      clientRef: item.ref,
      confirmOverpay: item.confirmOverpay,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as PostResult["json"];
  return { status: res.status, json };
}

export type SubmitInput = {
  invoiceId: number;
  label: string;
  amount: number;
  method: string;
  kind?: "dp" | "bayar";
  note?: string;
  /** Waktu pembayaran (ISO); bawaan: sekarang. */
  paidAt?: string;
  confirmOverpay?: boolean;
  /** Pakai ulang kode yang sama untuk percobaan ulang (mis. setelah konfirmasi kelebihan bayar). */
  ref?: string;
};

export type SubmitResult =
  | { kind: "ok"; duplicate: boolean; ref: string }
  | { kind: "queued"; reason: "offline" | "network" | "server" | "login"; ref: string }
  | { kind: "rejected"; error: string; code?: string; ref: string };

/** Kirim pembayaran; bila offline / jaringan bermasalah, simpan ke antrean dan kirim otomatis nanti. */
export async function submitPaymentOrQueue(input: SubmitInput): Promise<SubmitResult> {
  const item: QueuedPayment = {
    ref: input.ref ?? uuid(),
    invoiceId: input.invoiceId,
    label: input.label,
    amount: Math.round(input.amount),
    method: input.method,
    kind: input.kind ?? "bayar",
    note: input.note ?? "",
    paidAt: input.paidAt ?? new Date().toISOString(),
    createdAt: new Date().toISOString(),
    confirmOverpay: Boolean(input.confirmOverpay),
    status: "pending",
    attempts: 0,
  };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    enqueue(item);
    return { kind: "queued", reason: "offline", ref: item.ref };
  }
  try {
    const r = await postPayment(item);
    if (r.json.ok) return { kind: "ok", duplicate: Boolean(r.json.duplicate), ref: item.ref };
    if (r.status === 401) {
      enqueue(item);
      return { kind: "queued", reason: "login", ref: item.ref };
    }
    if (r.status >= 500 || !r.json.error) {
      enqueue(item);
      return { kind: "queued", reason: "server", ref: item.ref };
    }
    return { kind: "rejected", error: r.json.error, code: r.json.code, ref: item.ref };
  } catch {
    enqueue(item);
    return { kind: "queued", reason: "network", ref: item.ref };
  }
}

let flushing = false;

/** Kirim semua yang menunggu, berurutan. Berhenti bila jaringan/server bermasalah (dicoba lagi nanti). */
export async function flushQueue(): Promise<{ sent: number; needLogin: boolean; remaining: number }> {
  if (flushing) return { sent: 0, needLogin: false, remaining: readQueue().filter((x) => x.status === "pending").length };
  flushing = true;
  let sent = 0;
  let needLogin = false;
  try {
    for (const it of readQueue().filter((x) => x.status === "pending")) {
      let r: PostResult;
      try {
        r = await postPayment(it);
      } catch {
        break; // jaringan putus lagi
      }
      if (r.json.ok) {
        removeFromQueue(it.ref);
        sent += 1;
        continue;
      }
      if (r.status === 401) {
        needLogin = true;
        break;
      }
      if (r.status >= 500 || !r.json.error) {
        patchQueueItem(it.ref, { attempts: it.attempts + 1 });
        break;
      }
      // Ditolak server karena aturan bisnis (mis. kelebihan bayar, invoice dibatalkan): perlu ditinjau manusia.
      patchQueueItem(it.ref, { status: "failed", error: r.json.error, code: r.json.code, attempts: it.attempts + 1 });
    }
  } finally {
    flushing = false;
  }
  return { sent, needLogin, remaining: readQueue().filter((x) => x.status === "pending").length };
}
