"use client";

import { Pencil, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CustomerData = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

export function CustomerForm({
  mode = "create",
  customer,
}: {
  mode?: "create" | "edit";
  customer?: CustomerData;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: customer?.name ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    address: customer?.address ?? "",
    notes: customer?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const isEdit = mode === "edit" && customer;
      const res = await fetch(isEdit ? `/api/customers/${customer.id}` : "/api/customers", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setError(json.error ?? "Gagal menyimpan pelanggan.");
        return;
      }
      if (mode === "create") setForm({ name: "", phone: "", email: "", address: "", notes: "" });
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={mode === "edit" ? "btn-ghost inline-flex items-center gap-1.5" : "btn-primary inline-flex items-center gap-1.5"}>
        {mode === "edit" ? (
          <>
            <Pencil size={14} /> Edit
          </>
        ) : (
          <>
            <Plus size={15} /> Tambah Pelanggan
          </>
        )}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card w-full space-y-3 p-4">
      <h3 className="text-sm font-bold text-slate-900">{mode === "edit" ? "Edit Data Pelanggan" : "Data Pelanggan Baru"}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Nama / Toko *</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">No. WhatsApp</label>
          <input
            value={form.phone ?? ""}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="08xxxxxxxxxx"
            className="input"
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={form.email ?? ""}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Alamat</label>
          <input
            value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="input"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Catatan (kebiasaan order, harga khusus, dll)</label>
          <textarea
            rows={2}
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input"
          />
        </div>
      </div>
      {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary inline-flex items-center gap-1.5">
          {busy ? (
            "Menyimpan…"
          ) : (
            <>
              <Save size={14} /> {mode === "edit" ? "Simpan Perubahan" : "Simpan"}
            </>
          )}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          Tutup
        </button>
      </div>
    </form>
  );
}
