"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Factory, Loader2 } from "lucide-react";
import { DateFieldID } from "@/components/DateFieldID";

/**
 * Tombol "Buat Pekerjaan Produksi" untuk Invoice terbit yang belum punya pekerjaan.
 * Satu-satunya isian: DEADLINE. Pekerjaan dibuat berstatus Antrian, tanpa operator,
 * dengan pelanggan dan item dari invoice. 1 invoice = 1 pekerjaan.
 */
export function ProductionCreator({ invoiceId, today }: { invoiceId: number; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("17:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!date) return setError("Isi tanggal deadline dulu.");
    if (date < today) return setError("Deadline tidak boleh tanggal yang sudah lewat.");
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/production`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: date, dueTime: time }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; penjelasan?: string; orderId?: number };
      if (!json.ok) return setError(json.error ?? json.penjelasan ?? "Gagal membuat pekerjaan. Coba lagi.");
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
      <p className="text-xs text-slate-500">Invoice ini belum punya pekerjaan produksi. Buat sekarang kalau perlu dipantau di PrintFlow.</p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary px-3 py-2 text-xs">
          <Factory size={14} /> Buat Pekerjaan Produksi
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="label">Deadline *</span>
              <DateFieldID value={date} onChange={setDate} className="input min-w-0" />
            </label>
            <label className="block min-w-0">
              <span className="label">Jam</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input min-w-0" />
            </label>
          </div>
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
