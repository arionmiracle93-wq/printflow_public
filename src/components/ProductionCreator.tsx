"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Factory, Loader2 } from "lucide-react";
import { DateFieldID } from "@/components/DateFieldID";
import { TimeFieldID } from "@/components/TimeFieldID";
import { formatNumber } from "@/lib/domain";

type ProductionItem = {
  id: number;
  productName: string;
  quantity: number;
  unit: string;
  needsProduction: boolean;
  prodDueDate?: string | null;
  prodDueTime?: string | null;
};

type ItemRow = ProductionItem & {
  checked: boolean;
  date: string;
  time: string;
};

/**
 * Tombol "Buat Pekerjaan Produksi" untuk Invoice terbit yang belum punya pekerjaan.
 *
 * Sejak monitoring bisa per item, modal ini juga menampilkan daftar item:
 * - hanya item yang dicentang yang disalin ke pekerjaan produksi;
 * - deadline item boleh berbeda dari deadline utama (kosong = ikut utama).
 *
 * 1 invoice tetap = 1 pekerjaan. Item yang tidak dicentang tetap ada di
 * invoice dan tetap ditagih, hanya tidak dipantau produksinya.
 */
export function ProductionCreator({
  invoiceId,
  today,
  items,
}: {
  invoiceId: number;
  today: string;
  items: ProductionItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("17:00");
  const [rows, setRows] = useState<ItemRow[]>(() =>
    items.map((item) => ({
      ...item,
      checked: item.needsProduction,
      date: item.prodDueDate ?? "",
      time: item.prodDueTime ?? "",
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patchRow(id: number, patch: Partial<ItemRow>) {
    setRows((list) => list.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function submit() {
    setError(null);
    if (!date) return setError("Isi tanggal deadline utama dulu.");
    if (date < today) return setError("Deadline utama tidak boleh tanggal yang sudah lewat.");
    const selected = rows.filter((row) => row.checked);
    if (!selected.length) return setError("Centang minimal satu item yang perlu masuk antrian produksi.");
    const pastItem = selected.find((row) => row.date && row.date < today);
    if (pastItem) return setError(`Deadline item "${pastItem.productName}" tidak boleh tanggal yang sudah lewat.`);

    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/production`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dueDate: date,
          dueTime: time,
          items: rows.map((row) => ({
            id: row.id,
            needsProduction: row.checked,
            prodDueDate: row.checked && row.date ? row.date : null,
            prodDueTime: row.checked && row.date && row.time ? row.time : null,
          })),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        penjelasan?: string;
        orderId?: number;
      };
      if (!json.ok) return setError(json.error ?? json.penjelasan ?? "Gagal membuat pekerjaan. Coba lagi.");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Koneksi terputus. Cek internet lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-2 p-4">
      <div className="flex items-center gap-2">
        <Factory size={17} className="text-teal-600" />
        <h2 className="text-sm font-bold text-[color:var(--pf-ink)]">Produksi</h2>
      </div>
      <p className="text-xs text-slate-500">
        Invoice ini belum punya pekerjaan produksi. Buat sekarang kalau perlu dipantau di PrintFlow. Item yang sudah selesai / diserahkan tidak perlu dicentang.
      </p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary px-3 py-2 text-xs">
          <Factory size={14} /> Buat Pekerjaan Produksi
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="label">Deadline utama *</span>
              <DateFieldID value={date} onChange={setDate} className="input min-w-0" />
            </label>
            <label className="block min-w-0">
              <span className="label">Jam</span>
              {/* Dulu <input type="time"> polos, jadi panel jam yang muncul
                  milik sistem operasi dan tidak ikut tema. Sekarang panel
                  milik aplikasi, sama seperti kalender di sebelah kiri. */}
              <TimeFieldID value={time} onChange={setTime} className="input min-w-0" />
            </label>
          </div>

          <div className="max-h-64 space-y-1.5 overflow-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
            {rows.map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={row.checked}
                    onChange={(e) => patchRow(row.id, { checked: e.target.checked })}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {row.productName}
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      {formatNumber(row.quantity)} {row.unit}
                    </span>
                  </span>
                </label>
                {row.checked ? (
                  <div className="mt-2 grid gap-2 pl-6 sm:grid-cols-2">
                    <label className="block min-w-0">
                      <span className="label">Deadline item</span>
                      <DateFieldID
                        value={row.date}
                        onChange={(value) => patchRow(row.id, { date: value })}
                        min={today}
                        className="input min-w-0"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="label">Jam item</span>
                      <TimeFieldID
                        value={row.time}
                        onChange={(value) => patchRow(row.id, { time: value })}
                        disabled={!row.date}
                        className="input min-w-0 disabled:opacity-50"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Item yang tidak dicentang tetap ditagih di invoice, tapi tidak masuk pekerjaan produksi. Deadline item kosong = ikut deadline utama.
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void submit()} className="btn-primary px-3 py-2 text-xs">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Factory size={14} />} Buat Pekerjaan
            </button>
            <button type="button" disabled={busy} onClick={() => setOpen(false)} className="btn-ghost px-3 py-2 text-xs">Batal</button>
          </div>
        </div>
      )}
      {error ? <p className="break-words rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}
    </section>
  );
}
