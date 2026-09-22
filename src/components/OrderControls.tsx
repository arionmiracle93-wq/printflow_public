"use client";

import { ArrowRight, CheckCircle2, Pencil, RefreshCw, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { NEXT_STATUS, STATUSES, statusMeta, type StatusKey } from "@/lib/domain";
import { outsourceStatusMeta } from "@/lib/outsource";
import { STATUS_ICONS } from "@/components/ui";

export function OrderStatusControls({
  orderId,
  currentStatus,
  outsourceStatus,
}: {
  orderId: number;
  currentStatus: string;
  outsourceStatus?: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string>(currentStatus);
  const [note, setNote] = useState("");
  const [actor, setActor] = useState("Owner");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<ReactNode | null>(null);

  const next = NEXT_STATUS[currentStatus as StatusKey] ?? null;

  async function save(target: string, quickNote?: string) {
    // Jaring pengaman: job dengan produksi mitra yang belum "Diterima &
    // Perlu QC" tapi mau ditandai Selesai — kemungkinan besar cuma lupa
    // update status mitra-nya, bukan disengaja. Tanya dulu, jangan blokir
    // paksa (bisa saja memang situasinya beda dari biasanya).
    if (target === "selesai" && outsourceStatus && outsourceStatus !== "diterima") {
      const label = outsourceStatusMeta(outsourceStatus).label;
      const confirmed = window.confirm(
        `Status produksi mitra untuk pekerjaan ini masih "${label}", belum "Diterima & Perlu QC".\n\nYakin mau tandai pekerjaan ini Selesai? Kalau belum, batalkan dulu dan update status mitra di kartu "Produksi Mitra".`,
      );
      if (!confirmed) return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target, note: quickNote ?? note, actor }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setMessage(json.error ?? "Gagal memperbarui status.");
        return;
      }
      setStatus(target);
      setNote("");
      setMessage(
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 size={13} className="shrink-0" /> Status diperbarui ke &quot;{statusMeta(target).label}&quot;.
        </span>,
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
        <RefreshCw size={16} /> Update Status Pekerjaan
      </h3>
      <p className="text-xs text-slate-500">
        Klik tahap yang sedang dikerjakan. Riwayat perubahan otomatis tercatat.
      </p>

      {next ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => save(next, "Lanjut ke tahap berikutnya.")}
          className="btn-primary mt-3 inline-flex w-full items-center justify-center gap-1.5"
        >
          <ArrowRight size={15} /> Lanjut ke: {statusMeta(next).short}
        </button>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => {
          const StatusIcon = STATUS_ICONS[s.key];
          return (
            <button
              key={s.key}
              type="button"
              disabled={busy || s.key === currentStatus}
              onClick={() => save(s.key)}
              className={`chip inline-flex items-center gap-1 transition ${
                s.key === currentStatus
                  ? `${s.badge} cursor-default`
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
              }`}
            >
              {StatusIcon ? <StatusIcon size={12} /> : null} {s.short}
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <label className="label">Catatan (opsional)</label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contoh: desain sudah di-approve pelanggan, mulai cetak."
            className="input"
          />
        </div>
        <div>
          <label className="label">Diupdate oleh</label>
          <input value={actor} onChange={(e) => setActor(e.target.value)} className="input" />
        </div>
        <button type="button" disabled={busy} onClick={() => save(status)} className="btn-ghost inline-flex w-full items-center justify-center gap-1.5">
          <Save size={14} /> Simpan catatan pada status ini
        </button>
      </div>

      {message ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{message}</p>
      ) : null}
    </div>
  );
}

export function OrderQuickEdit({
  order,
}: {
  order: {
    id: number;
    dueDate: string;
    dueTime: string;
    priority: string;
    operator: string | null;
    machine: string;
    price: number;
    paidAmount: number;
    notes: string | null;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    dueDate: order.dueDate,
    dueTime: order.dueTime,
    priority: order.priority,
    operator: order.operator ?? "",
    machine: order.machine,
    price: String(order.price),
    paidAmount: String(order.paidAmount),
    notes: order.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dueDate: form.dueDate,
          dueTime: form.dueTime,
          priority: form.priority,
          operator: form.operator,
          machine: form.machine,
          price: Number.parseInt(form.price || "0", 10),
          paidAmount: Number.parseInt(form.paidAmount || "0", 10),
          notes: form.notes,
        }),
      });
      setSaved(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Hapus pekerjaan ini? Tindakan tidak bisa dibatalkan.")) return;
    setBusy(true);
    await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
    router.push("/pesanan");
    router.refresh();
  }

  return (
    <div className="card p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
        <Pencil size={16} /> Ubah Data Pekerjaan
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Deadline tanggal</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Jam</label>
          <input
            type="time"
            value={form.dueTime}
            onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Prioritas</label>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="input"
          >
            <option value="rendah">Rendah</option>
            <option value="normal">Normal</option>
            <option value="tinggi">Tinggi</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className="label">Operator</label>
          <input
            value={form.operator}
            onChange={(e) => setForm({ ...form, operator: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Harga (Rp)</label>
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Sudah dibayar (Rp)</label>
          <input
            type="number"
            value={form.paidAmount}
            onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
            className="input"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Catatan</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input"
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={busy} className="btn-primary inline-flex items-center gap-1.5">
          {busy ? (
            "Menyimpan…"
          ) : (
            <>
              <Save size={14} /> Simpan Perubahan
            </>
          )}
        </button>
        <button type="button" onClick={remove} disabled={busy} className="btn-danger inline-flex items-center gap-1.5">
          <Trash2 size={14} /> Hapus
        </button>
      </div>
      {saved ? (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-600">
          <CheckCircle2 size={13} /> Perubahan tersimpan.
        </p>
      ) : null}
    </div>
  );
}
