"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Package, Pencil, Save } from "lucide-react";
import { OrderItemsEditor } from "@/components/OrderItemsEditor";
import { formatNumber } from "@/lib/domain";
import { type OrderItem, type OrderItemInput } from "@/lib/order-items";

/**
 * KARTU "ITEM PEKERJAAN" di halaman detail.
 *
 * Menampilkan semua produk di dalam satu pekerjaan dan memungkinkan
 * pemilik menambah / mengubah / menghapus baris tanpa membuat pekerjaan baru.
 * Perubahan dikirim sebagai satu daftar utuh ke PUT /api/orders/[id]/items.
 *
 * Mode baca dipisah dari mode ubah supaya operator yang cuma ingin melihat
 * "hari ini harus cetak apa saja" tidak sengaja mengubah angka pesanan.
 */
export function OrderItemsManager({
  orderId,
  initialItems,
}: {
  orderId: number;
  initialItems: OrderItem[];
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<OrderItem[]>(initialItems);
  const [draft, setDraft] = useState<OrderItemInput[]>(
    initialItems.map((i) => ({ productType: i.productType, quantity: i.quantity, unit: i.unit })),
  );
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageOk, setMessageOk] = useState(true);

  function startEdit() {
    // Selalu mulai dari data tersimpan terbaru, bukan sisa draft sebelumnya.
    setDraft(
      saved.length
        ? saved.map((i) => ({ productType: i.productType, quantity: i.quantity, unit: i.unit }))
        : [{ productType: "", quantity: 1, unit: "pcs" }],
    );
    setMessage(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setMessage(null);
  }

  async function save() {
    const bersih = draft.filter((i) => i.productType.trim());
    if (!bersih.length) {
      setMessageOk(false);
      setMessage("Minimal harus ada satu baris produk yang terisi.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: bersih }),
      });
      const json = (await res.json()) as { ok: boolean; data?: OrderItem[]; error?: string };
      if (!json.ok || !json.data) {
        setMessageOk(false);
        setMessage(json.error ?? "Gagal menyimpan item pekerjaan.");
        return;
      }
      setSaved(json.data);
      setEditing(false);
      setMessageOk(true);
      setMessage("Item pekerjaan tersimpan. Estimasi jam kerja ikut dihitung ulang.");
      router.refresh();
    } catch {
      setMessageOk(false);
      setMessage("Tidak dapat menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  const totalUnit = saved.reduce((sum, i) => sum + (i.quantity || 0), 0);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Package size={16} className="text-teal-600" /> Item Pekerjaan
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {saved.length} produk · total {formatNumber(totalUnit)} unit — semuanya satu status &amp; satu deadline.
          </p>
        </div>
        {!editing ? (
          <button type="button" onClick={startEdit} className="btn-ghost inline-flex shrink-0 items-center gap-1.5">
            <Pencil size={14} /> Ubah item
          </button>
        ) : null}
      </div>

      {!editing ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-white/[0.04]">
              <tr>
                <th className="w-10 px-3 py-2">#</th>
                <th className="px-3 py-2">Jenis produk</th>
                <th className="px-3 py-2 text-right">Jumlah</th>
                <th className="w-24 px-3 py-2">Satuan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {saved.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-xs text-slate-500">
                    Belum ada rincian produk. Klik &ldquo;Ubah item&rdquo; untuk menambahkan.
                  </td>
                </tr>
              ) : (
                saved.map((item, index) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-xs font-bold text-slate-400">{index + 1}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">{item.productType}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-slate-200">
                      {formatNumber(item.quantity)}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{item.unit}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <OrderItemsEditor items={draft} onChange={setDraft} disabled={busy} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={busy} className="btn-primary">
              <Save size={15} /> {busy ? "Menyimpan…" : "Simpan item"}
            </button>
            <button type="button" onClick={cancelEdit} disabled={busy} className="btn-ghost">
              Batal
            </button>
          </div>
        </div>
      )}

      {message ? (
        <p
          className={`mt-3 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${
            messageOk
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
          }`}
        >
          {messageOk ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
          {message}
        </p>
      ) : null}
    </div>
  );
}
