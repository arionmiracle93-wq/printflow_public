"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Plus } from "lucide-react";
import { DateFieldID } from "@/components/DateFieldID";
import { TimeFieldID } from "@/components/TimeFieldID";
import { formatNumber, statusMeta } from "@/lib/domain";

export type ProductionAddableItem = {
  lineKey: string;
  productName: string;
  quantity: number;
  unit: string;
  prodDueDate?: string | null;
  prodDueTime?: string | null;
};

type ItemRow = ProductionAddableItem & {
  checked: boolean;
  date: string;
  time: string;
};

/**
 * Kartu "Tambah ke monitoring produksi" untuk invoice yang sudah terbit
 * dan sudah punya pekerjaan produksi.
 *
 * Hanya item invoice yang BELUM ada di pekerjaan yang ditampilkan. Item lama
 * tidak disentuh: status, mitra, dan deadline-nya tetap. Deadline item baru
 * boleh berbeda; kosong = ikut deadline pekerjaan.
 */
export function ProductionAdder({
  invoiceId,
  orderCode,
  orderStatus,
  today,
  items,
}: {
  invoiceId: number;
  orderCode: string;
  orderStatus: string;
  today: string;
  items: ProductionAddableItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ItemRow[]>(() =>
    items.map((item) => ({
      ...item,
      checked: true,
      date: item.prodDueDate ?? "",
      time: item.prodDueTime ?? "",
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!items.length) return null;

  const blocked = orderStatus === "selesai" || orderStatus === "batal" || orderStatus === "siap";
  if (blocked) {
    return (
      <section className="card space-y-1.5 p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[color:var(--pf-ink)]">
          <CalendarDays size={16} className="text-amber-600" /> Tambah item ke produksi
        </h2>
        <p className="text-xs text-slate-500">
          Pekerjaan <b>{orderCode}</b> sudah {statusMeta(orderStatus).label.toLowerCase()}. Tambahan produk perlu dibuat
          sebagai invoice / pekerjaan baru supaya status dan pengambilan tidak tercampur.
        </p>
      </section>
    );
  }

  function patchRow(lineKey: string, patch: Partial<ItemRow>) {
    setRows((list) => list.map((row) => (row.lineKey === lineKey ? { ...row, ...patch } : row)));
  }

  async function submit() {
    setError(null);
    const selected = rows.filter((row) => row.checked);
    if (!selected.length) return setError("Centang minimal satu item yang akan ditambahkan.");
    const pastItem = selected.find((row) => row.date && row.date < today);
    if (pastItem) return setError(`Deadline item "${pastItem.productName}" tidak boleh tanggal yang sudah lewat.`);

    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/production/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selected.map((row) => ({
            lineKey: row.lineKey,
            prodDueDate: row.date || null,
            prodDueTime: row.date && row.time ? row.time : null,
          })),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        penjelasan?: string;
        added?: number;
      };
      if (!json.ok) return setError(json.error ?? json.penjelasan ?? "Gagal menambahkan item. Coba lagi.");
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[color:var(--pf-ink)]">
            <Plus size={16} className="text-teal-600" /> Tambah ke monitoring produksi
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Ada <b>{items.length} item</b> di invoice ini yang belum masuk pekerjaan <b>{orderCode}</b>. Item lama dan statusnya tidak diubah.
          </p>
        </div>
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className="btn-secondary shrink-0 px-3 py-2 text-xs">
            <Plus size={14} /> Pilih item
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="max-h-64 space-y-1.5 overflow-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
            {rows.map((row) => (
              <div key={row.lineKey} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={row.checked}
                    onChange={(e) => patchRow(row.lineKey, { checked: e.target.checked })}
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
                        onChange={(value) => patchRow(row.lineKey, { date: value })}
                        min={today}
                        className="input min-w-0"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="label">Jam item</span>
                      <TimeFieldID
                        value={row.time}
                        onChange={(value) => patchRow(row.lineKey, { time: value })}
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
            Item baru mengikuti status pekerjaan saat ini. Deadline kosong = ikut deadline pekerjaan; deadline item yang lebih
            awal akan memajukan deadline pekerjaan. Kalau produk ini harus mulai dari antrian, ubah status item setelah
            ditambahkan lewat popup update cepat.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void submit()} className="btn-primary px-3 py-2 text-xs">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Tambah ke Produksi
            </button>
            <button type="button" disabled={busy} onClick={() => setOpen(false)} className="btn-ghost px-3 py-2 text-xs">
              Batal
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="break-words rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}
    </section>
  );
}
